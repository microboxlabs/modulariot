from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI

from miot_harness.config import HarnessSettings, get_settings
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.credentials import load_nexo_credentials
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.factory import build_harness
from miot_harness.runtime.run_store import HarnessRunRecord
from miot_harness.runtime.supervisor import HarnessSupervisor

logger = logging.getLogger(__name__)


def _make_lifespan(harness: HarnessSupervisor, settings: HarnessSettings):
    @asynccontextmanager
    async def lifespan(app: FastAPI):
        app.state.nexo_enabled = False
        app.state.nexo_pool = None
        app.state.nexo_registered = []

        if settings.nexo_db_scripts_root is None:
            logger.info("Nexo: disabled (MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT not set)")
            try:
                yield
            finally:
                pass
            return

        pool = None
        try:
            creds = load_nexo_credentials(
                db_scripts_root=settings.nexo_db_scripts_root,
                alias=settings.nexo_db_alias,
            )
            pool = await create_nexo_pool(creds)
            result = await load_nexo_tools(harness.tools, settings=settings, pool=pool)
            app.state.nexo_enabled = result.enabled
            app.state.nexo_registered = list(result.registered)
            if result.enabled:
                app.state.nexo_pool = pool
                logger.info(
                    "Nexo: %d tools registered (alias=%s)",
                    len(result.registered),
                    settings.nexo_db_alias,
                )
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
    async def health() -> dict[str, str]:
        return {"status": "ok", "env": settings.env}

    @app.post("/runs", response_model=HarnessRunRecord)
    async def create_run(request: UserRequest) -> HarnessRunRecord:
        return await harness.run(request)

    @app.get("/runs/{run_id}", response_model=HarnessRunRecord)
    async def get_run(run_id: str) -> HarnessRunRecord:
        return harness.run_store.load(run_id)

    return app
