from __future__ import annotations

import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.config import HarnessSettings, get_settings
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.credentials import load_nexo_credentials
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.factory import build_harness
from miot_harness.runtime.nexo_graph import build_nexo_graph
from miot_harness.runtime.run_store import HarnessRunRecord
from miot_harness.runtime.supervisor import HarnessSupervisor

logger = logging.getLogger(__name__)


def _make_lifespan(
    harness: HarnessSupervisor, settings: HarnessSettings
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.nexo_enabled = False
        app.state.nexo_pool = None
        app.state.nexo_registered = []
        app.state.nexo_snapshot_age_minutes = None

        if settings.nexo_dsn is None and settings.nexo_db_scripts_root is None:
            logger.info(
                "Nexo: disabled (neither MIOT_HARNESS_NEXO_DSN nor "
                "MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT is set)"
            )
            try:
                yield
            finally:
                pass
            return

        pool = None
        try:
            if settings.nexo_dsn is not None:
                logger.info(
                    "Nexo: using MIOT_HARNESS_NEXO_DSN (db-scripts file lookup bypassed)"
                )
                pool = await create_nexo_pool(dsn=settings.nexo_dsn)
            else:
                # Guarded above: when nexo_dsn is None, db_scripts_root is
                # not None (otherwise the early-return would have fired).
                assert settings.nexo_db_scripts_root is not None
                creds = load_nexo_credentials(
                    db_scripts_root=settings.nexo_db_scripts_root,
                    alias=settings.nexo_db_alias,
                )
                pool = await create_nexo_pool(creds)
            result = await load_nexo_tools(harness.tools, settings=settings, pool=pool)
            app.state.nexo_enabled = result.enabled
            app.state.nexo_registered = list(result.registered)
            app.state.nexo_snapshot_age_minutes = result.snapshot_age_minutes
            if result.enabled:
                app.state.nexo_pool = pool
                logger.info(
                    "Nexo: %d tools registered (alias=%s)",
                    len(result.registered),
                    settings.nexo_db_alias,
                )
                # Build the conversational graph and inject into the
                # supervisor. Per-agent models come from settings.
                try:
                    models = {
                        "filter_expert": get_chat_model(settings.nexo_filter_expert_model),
                        "domain_analyst": get_chat_model(settings.nexo_analyst_model),
                        "synthesizer": get_chat_model(settings.nexo_synthesizer_model),
                        "critic": get_chat_model(settings.nexo_critic_model),
                        "summarizer": get_chat_model(settings.nexo_summarizer_model),
                    }
                    harness.nexo_graph = build_nexo_graph(
                        registry=harness.tools, settings=settings, models=models
                    )
                    logger.info("Nexo: conversational graph wired")
                except Exception as exc:  # noqa: BLE001
                    logger.critical(
                        "Nexo: failed to build chat models / graph (%s); "
                        "falling back to Nexo disabled",
                        exc,
                    )
                    # Tools registered fine but the supervisor can't reach
                    # them without the graph — clear the public state so
                    # /health reports the disabled-and-empty truth, not a
                    # tool list that is unreachable. The pool is closed by
                    # the outer `finally` below; we just drop the public
                    # reference here.
                    app.state.nexo_enabled = False
                    app.state.nexo_pool = None
                    app.state.nexo_registered = []
                    app.state.nexo_snapshot_age_minutes = None
                    harness.nexo_graph = None
        except Exception as exc:  # noqa: BLE001 — boot must not die
            logger.critical(
                "Nexo: lifespan boot failed (%s); harness continues with Nexo disabled", exc
            )

        try:
            yield
        finally:
            if pool is not None:
                try:
                    await pool.close()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Nexo: pool close raised %s", exc)

    return lifespan


def create_app() -> FastAPI:
    settings = get_settings()
    harness = build_harness(Path(settings.workspace_dir))
    app = FastAPI(
        title="MIOT Harness",
        version="0.1.0",
        lifespan=_make_lifespan(harness, settings),
    )

    @app.get("/health")
    async def health() -> dict[str, object]:
        return {
            "status": "ok",
            "env": settings.env,
            "nexo": {
                "enabled": app.state.nexo_enabled,
                "tools": list(app.state.nexo_registered),
                "snapshot_age_minutes": app.state.nexo_snapshot_age_minutes,
            },
        }

    @app.post("/runs", response_model=HarnessRunRecord)
    async def create_run(request: UserRequest) -> HarnessRunRecord:
        return await harness.run(request)

    @app.get("/runs/{run_id}", response_model=HarnessRunRecord)
    async def get_run(run_id: str) -> HarnessRunRecord:
        return harness.run_store.load(run_id)

    return app
