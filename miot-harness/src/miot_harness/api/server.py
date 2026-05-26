from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from pathlib import Path
from typing import Any
from uuid import uuid4

from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from traceloop.sdk import Traceloop

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.api.auth import AuthError, JwksCache, verify_token
from miot_harness.config import HarnessSettings, get_settings
from miot_harness.integrations.nexo.boot import load_nexo_tools
from miot_harness.integrations.nexo.pool import create_nexo_pool
from miot_harness.integrations.nexo.primer import COORDINADOR_PRIMER
from miot_harness.observability.otel import configure_tracing, shutdown_tracing
from miot_harness.runtime.agentic_graph import build_agentic_graph
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.factory import build_harness
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.nexo_graph import build_nexo_graph
from miot_harness.runtime.router import IntentRouter
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
        # Streaming state: harness ref for endpoint access (tests inject
        # controlled graphs by mutating this), event bus the SSE handler
        # subscribes to, and the in-flight task table the stream uses to
        # decide whether to keep listening or treat the run as final.
        app.state.harness = harness
        app.state.event_bus = harness.event_bus
        app.state.in_flight = {}
        # Parallel map from in-flight run_id → tenant_id, populated by
        # /runs:start and cleared in the task's done-callback. Lets
        # /stream refuse a cross-tenant subscriber before the record
        # ever lands on disk.
        app.state.in_flight_tenants = {}

        # Auth (defense-in-depth behind the Quarkus proxy): instantiate
        # a JwksCache when enabled; require_auth reads it from
        # app.state. validate_auth_config has the explicit checks —
        # call it here so any misconfig surfaces at boot, not on the
        # first request. When auth is disabled in prod, log loudly so
        # the operator notices the open surface.
        settings.validate_auth_config()
        if settings.auth_enabled:
            assert settings.auth0_jwks_url is not None  # narrowed by validate
            app.state.jwks = JwksCache(settings.auth0_jwks_url)
            logger.info(
                "Auth: enabled (issuer=%s, audience=%s)",
                settings.auth0_issuer,
                settings.auth0_rs256_audience,
            )
        else:
            app.state.jwks = None
            if settings.env == "production":
                logger.warning(
                    "Auth: DISABLED in production env — /runs* is "
                    "unauthenticated. Set MIOT_HARNESS_AUTH_ENABLED=true."
                )

        # Telemetry: configure_tracing installs the global TracerProvider so
        # NexoTelemetryCallback's spans (per-agent) and Traceloop's
        # auto-instrumented child spans (per LLM SDK call) flow to the same
        # collector. No-op when MIOT_HARNESS_OTEL_ENABLED is false.
        tracer_provider = configure_tracing(
            enabled=settings.otel_enabled,
            service_name=settings.otel_service_name,
            endpoint=settings.otel_endpoint,
            environment=settings.otel_environment,
        )
        if tracer_provider is not None:
            Traceloop.init(
                app_name=settings.otel_service_name,
                api_endpoint=settings.otel_endpoint,
                disable_batch=False,
                telemetry_enabled=False,  # do not phone home; we self-host
            )
            # HTTP request spans parent the per-run `nexo.run` span so the
            # full request → graph → LLM tree shows up in Langfuse.
            FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
            logger.info(
                "OTel: tracing enabled (service=%s, env=%s, endpoint=%s)",
                settings.otel_service_name,
                settings.otel_environment,
                settings.otel_endpoint,
            )
        app.state.tracer_provider = tracer_provider

        if settings.nexo_dsn is None:
            logger.info("Nexo: disabled (MIOT_HARNESS_NEXO_DSN is not set)")
            try:
                yield
            finally:
                try:
                    shutdown_tracing(tracer_provider)
                except Exception as exc:  # noqa: BLE001
                    logger.warning("OTel: shutdown_tracing raised %s", exc)
            return

        pool = None
        try:
            logger.info("Nexo: connecting via MIOT_HARNESS_NEXO_DSN")
            pool = await create_nexo_pool(settings.nexo_dsn)
            result = await load_nexo_tools(harness.tools, settings=settings, pool=pool)
            app.state.nexo_enabled = result.enabled
            app.state.nexo_registered = list(result.registered)
            app.state.nexo_snapshot_age_minutes = result.snapshot_age_minutes
            if result.enabled:
                app.state.nexo_pool = pool
                logger.info("Nexo: %d tools registered", len(result.registered))
                # Build the conversational graph and inject into the
                # supervisor. Per-agent models come from settings.
                try:
                    synth_thinking_budget = (
                        settings.nexo_synthesizer_thinking_budget
                        if settings.nexo_synthesizer_stream
                        else None
                    )
                    models = {
                        "filter_expert": get_chat_model(settings.nexo_filter_expert_model),
                        "domain_analyst": get_chat_model(settings.nexo_analyst_model),
                        "synthesizer": get_chat_model(
                            settings.nexo_synthesizer_model,
                            thinking_budget_tokens=synth_thinking_budget,
                        ),
                        "critic": get_chat_model(settings.nexo_critic_model),
                        "summarizer": get_chat_model(settings.nexo_summarizer_model),
                    }
                    harness.nexo_graph = build_nexo_graph(
                        registry=harness.tools, settings=settings, models=models
                    )

                    # Phase E wiring: tenant_lock + agentic_graph + meta
                    # agent + LLM intent router. All optional on the
                    # supervisor — falling back to keyword routing if any
                    # of these aren't injected.
                    harness.tenant_lock = settings.nexo_tenant_lock
                    harness.agentic_graph = build_agentic_graph(
                        settings=settings,
                        models={
                            **models,
                            # Agentic graph uses the analyst model as its
                            # planner; same model pool, same callbacks.
                            "planner": get_chat_model(settings.nexo_analyst_model),
                        },
                        provenance_log=None,  # wired in F-phase when executor lands
                    )
                    harness.meta_model = get_chat_model(
                        settings.intent_router_model,
                        thinking_budget_tokens=synth_thinking_budget,
                    )
                    harness.meta_primer = COORDINADOR_PRIMER
                    harness.meta_catalog = [
                        MetaAgentCatalogEntry(
                            name=name,
                            layer="L*",
                            title=name,
                            body=f"Auto-registered curated function `{name}`.",
                        )
                        for name in result.registered
                    ]
                    harness.llm_router = LLMIntentRouter(
                        get_chat_model(settings.intent_router_model),
                        confidence_threshold=settings.intent_router_confidence_threshold,
                        keyword_fallback=IntentRouter(),
                    )
                    logger.info(
                        "Nexo: Phase E wired (LLM router=%s, agentic_graph, meta_agent)",
                        settings.intent_router_model,
                    )
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
            try:
                shutdown_tracing(tracer_provider)
            except Exception as exc:  # noqa: BLE001
                logger.warning("OTel: shutdown_tracing raised %s", exc)

    return lifespan


def create_app() -> FastAPI:
    settings = get_settings()
    harness = build_harness(Path(settings.workspace_dir))
    app = FastAPI(
        title="MIOT Harness",
        version="0.1.0",
        lifespan=_make_lifespan(harness, settings),
    )

    async def require_auth(request: Request) -> Mapping[str, Any]:
        """Auth0 RS256 verification gate for /runs* endpoints.

        Short-circuits to a blank context when auth is disabled (the
        legacy unauthenticated mode used by unit tests and local
        dev). When enabled:

        - Enforces Bearer-token + JWKS RS256 sig/iss/aud/exp checks.
        - Resolves the caller's tenant from the
          `X-Miot-Tenant-Client-Id` header set by the Quarkus proxy.
        - Refuses requests missing that header, no exceptions —
          the proxy is the only trusted source of tenancy in prod.

        Returns ``{"claims": <decoded JWT>, "tenant_id": <header value
        or None>}``. Handlers use the tenant to override the body's
        deprecated `UserRequest.tenant_id`; a future release removes
        the body field entirely once staging soak confirms no caller
        still depends on it.
        """
        if not settings.auth_enabled:
            return {"claims": {}, "tenant_id": None}

        auth_header = request.headers.get("Authorization") or ""
        if not auth_header.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail="missing Bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token = auth_header[len("Bearer ") :].strip()
        if not token:
            raise HTTPException(
                status_code=401,
                detail="empty Bearer token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        jwks: JwksCache | None = request.app.state.jwks
        if jwks is None:  # pragma: no cover — guarded by validate_auth_config
            raise HTTPException(
                status_code=500,
                detail="auth enabled but JwksCache not configured",
            )

        # `auth0_issuer` and `auth0_rs256_audience` are guaranteed
        # non-None when `auth_enabled` is true (validated at startup).
        # The cast is just so mypy understands the narrowing.
        assert settings.auth0_issuer is not None
        assert settings.auth0_rs256_audience is not None

        try:
            claims = await verify_token(
                token,
                issuer=settings.auth0_issuer,
                audiences=[settings.auth0_rs256_audience],
                jwks=jwks,
            )
        except AuthError as exc:
            raise HTTPException(
                status_code=401,
                detail=f"auth_failed:{exc.code}",
                headers={"WWW-Authenticate": "Bearer"},
            ) from exc

        header_tenant = (
            request.headers.get("X-Miot-Tenant-Client-Id") or ""
        ).strip() or None
        if header_tenant is None:
            raise HTTPException(
                status_code=401,
                detail="auth_failed:tenant_unresolved",
                headers={"WWW-Authenticate": "Bearer"},
            )
        return {"claims": claims, "tenant_id": header_tenant}

    def _apply_tenant_override(
        user_request: UserRequest, auth: Mapping[str, Any]
    ) -> UserRequest:
        """If the verified header carried a tenant, that value wins
        over whatever the body declared. Body-only flow (auth
        disabled, i.e. local dev / unit tests) keeps the body value.
        The body field itself is deprecated; a future release will
        delete it from the schema once staging soak confirms no
        caller still depends on it.
        """
        header_tenant = auth.get("tenant_id")
        if not header_tenant:
            return user_request
        if user_request.tenant_id != header_tenant:
            logger.info(
                "Auth: overriding body tenant %r with header tenant %r",
                user_request.tenant_id,
                header_tenant,
            )
        return user_request.model_copy(update={"tenant_id": header_tenant})

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

    @app.get("/health/ready")
    async def health_ready(response: Response) -> dict[str, object]:
        # Readiness contract (kubelet readinessProbe target): Nexo is
        # "required" iff a DSN is configured. When required-but-not-enabled
        # the lifespan logs critical and continues serving, but the pod
        # should not receive traffic until tools register and the snapshot
        # passes the refuse-gate.
        nexo_required = settings.nexo_dsn is not None
        nexo_enabled = bool(app.state.nexo_enabled)
        ready = (not nexo_required) or nexo_enabled
        if not ready:
            response.status_code = 503
        return {
            "status": "ready" if ready else "not_ready",
            "env": settings.env,
            "nexo": {
                "required": nexo_required,
                "enabled": nexo_enabled,
                "tools": list(app.state.nexo_registered),
                "snapshot_age_minutes": app.state.nexo_snapshot_age_minutes,
            },
        }

    @app.post("/runs", response_model=HarnessRunRecord)
    async def create_run(
        request: UserRequest,
        debug: bool = Query(False),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> HarnessRunRecord:
        # Read harness from app.state so tests that inject a controlled
        # graph (via app.state.harness.nexo_graph = ...) see their patch.
        # Explicit annotation narrows `app.state` (Any) for mypy.
        harness: HarnessSupervisor = app.state.harness
        if debug:
            request = request.model_copy(update={"debug": True})
        request = _apply_tenant_override(request, auth)
        _enforce_debug_allowlist(request, settings)
        return await harness.run(request)

    @app.get("/runs/{run_id}", response_model=HarnessRunRecord)
    async def get_run(
        run_id: str,
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> HarnessRunRecord:
        harness: HarnessSupervisor = app.state.harness
        record = harness.run_store.load(run_id)
        _enforce_tenant_owns_run(record, auth, run_id)
        return record

    @app.post("/runs:start", status_code=202)
    async def start_run(
        request: UserRequest,
        debug: bool = Query(False),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, str]:
        if debug:
            request = request.model_copy(update={"debug": True})
        request = _apply_tenant_override(request, auth)
        _enforce_debug_allowlist(request, settings)
        run_id = f"run_{uuid4().hex}"
        task = asyncio.create_task(
            app.state.harness.run(request, run_id_override=run_id)
        )
        app.state.in_flight[run_id] = task
        # Track the tenant for in-flight runs so /stream can reject
        # cross-tenant subscribers even before the record lands on
        # disk. Cleared in the done-callback alongside in_flight.
        app.state.in_flight_tenants[run_id] = request.tenant_id

        def _cleanup(_task: asyncio.Task[HarnessRunRecord]) -> None:
            app.state.in_flight.pop(run_id, None)
            app.state.in_flight_tenants.pop(run_id, None)

        task.add_done_callback(_cleanup)
        return {"run_id": run_id}

    @app.get("/runs/{run_id}/stream")
    async def stream_run(
        run_id: str,
        request: Request,
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> StreamingResponse:
        # `event_bus` is the live channel for in-flight runs; without it
        # _sse_iterator can only ship the disk record and would close the
        # stream silently, which the client can't distinguish from a real
        # terminal run. Fail fast with 501 so the misconfiguration is
        # explicit rather than masquerading as an empty completed run.
        if app.state.event_bus is None:
            raise HTTPException(
                status_code=501,
                detail="SSE streaming is not configured on this harness instance.",
            )
        _enforce_tenant_owns_stream(app, run_id, auth)
        last_event_id = request.headers.get("Last-Event-ID")
        return StreamingResponse(
            _sse_iterator(app, run_id, last_event_id),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                # Disable any upstream proxy buffering (nginx, etc.) so
                # events reach the client as they're produced.
                "X-Accel-Buffering": "no",
            },
        )

    return app


def _enforce_tenant_owns_run(
    record: HarnessRunRecord, auth: Mapping[str, Any], run_id: str
) -> None:
    """Refuse to return a persisted run that belongs to a different
    tenant than the verified caller. No-op when auth resolved no
    tenant (auth disabled — local dev / unit tests).

    Older records persisted before #522 don't carry `tenant_id` —
    those are treated as legacy and allowed through; the new field
    only forbids new cross-tenant attempts.
    """
    caller = auth.get("tenant_id")
    if not caller:
        return
    if record.tenant_id is None:
        return
    if record.tenant_id != caller:
        raise HTTPException(
            status_code=403,
            detail=f"cross_tenant_replay:run {run_id!r} belongs to a different tenant",
        )


def _enforce_tenant_owns_stream(
    app: FastAPI, run_id: str, auth: Mapping[str, Any]
) -> None:
    """SSE-side counterpart to ``_enforce_tenant_owns_run``: checks
    the in-flight tenant tracker first (for runs that have not yet
    persisted) and falls back to the on-disk record. An unknown
    run_id is left to ``_sse_iterator`` to handle with its own
    `unknown_run_id` SSE error — replay protection only triggers
    when we actually know who the run belongs to.
    """
    caller = auth.get("tenant_id")
    if not caller:
        return
    in_flight_tenant = app.state.in_flight_tenants.get(run_id)
    if in_flight_tenant is not None:
        if in_flight_tenant != caller:
            raise HTTPException(
                status_code=403,
                detail=f"cross_tenant_replay:run {run_id!r} belongs to a different tenant",
            )
        return
    harness: HarnessSupervisor = app.state.harness
    try:
        record = harness.run_store.load(run_id)
    except FileNotFoundError:
        return
    if record.tenant_id is None:
        return
    if record.tenant_id != caller:
        raise HTTPException(
            status_code=403,
            detail=f"cross_tenant_replay:run {run_id!r} belongs to a different tenant",
        )


def _enforce_debug_allowlist(request: UserRequest, settings: HarnessSettings) -> None:
    """Refuse debug=true for tenants that aren't on the allow-list.

    Debug-flagged runs surface full tool inputs and truncated outputs over
    the SSE stream. On coordinador-touching routes that exposes real
    Mintral fleet data, so the gate is secure-by-default: with no
    `MIOT_HARNESS_ALLOW_DEBUG_TENANTS` configured, no tenant can opt in.
    """
    if not request.debug:
        return
    if settings.debug_tenant_allowed(request.tenant_id):
        return
    raise HTTPException(
        status_code=403,
        detail=(
            f"debug=true is not permitted for tenant {request.tenant_id!r}. "
            "Add the tenant to MIOT_HARNESS_ALLOW_DEBUG_TENANTS to enable."
        ),
    )


def _format_sse_event(evt: HarnessEvent) -> bytes:
    return (
        f"id: {evt.id}\n"
        f"event: {evt.type}\n"
        f"data: {evt.model_dump_json()}\n\n"
    ).encode()


def _format_sse_error(run_id: str, error: str) -> bytes:
    payload = f'{{"error": "{error}", "run_id": "{run_id}"}}'
    return f"event: error\ndata: {payload}\n\n".encode()


async def _sse_iterator(
    app: FastAPI, run_id: str, last_event_id: str | None
) -> AsyncIterator[bytes]:
    """Replay persisted events past `Last-Event-ID`, then drain live
    events from the bus until the run terminates.

    The bus is subscribed BEFORE the disk replay so events emitted
    between replay and subscribe don't get lost; the seq filter
    (`> last_seq`) dedupes any overlap.
    """

    harness: HarnessSupervisor = app.state.harness
    event_bus = app.state.event_bus
    in_flight: dict[str, asyncio.Task[HarnessRunRecord]] = app.state.in_flight

    last_seq = -1

    # Resolve Last-Event-ID → seq via the persisted record (if any).
    if last_event_id:
        try:
            record = harness.run_store.load(run_id)
            for evt in record.events:
                if evt.id == last_event_id:
                    last_seq = evt.seq
                    break
        except FileNotFoundError:
            pass

    # Subscribe BEFORE replay so we don't miss events that fire between
    # the disk read and the subscribe call.
    bus_iter = event_bus.subscribe(run_id) if event_bus is not None else None

    # Replay every persisted event past the cursor.
    record_existed = False
    try:
        record = harness.run_store.load(run_id)
        record_existed = True
        for evt in record.events:
            if evt.seq > last_seq:
                yield _format_sse_event(evt)
                last_seq = evt.seq
    except FileNotFoundError:
        pass

    # If neither the record exists nor the run is in-flight, this is an
    # unknown run_id — emit an error and close.
    if not record_existed and run_id not in in_flight:
        yield _format_sse_error(run_id, "unknown_run_id")
        if bus_iter is not None:
            await bus_iter.aclose()
        return

    # If the run is terminal (record on disk, not in-flight), there's
    # nothing more coming on the bus — close and return. This also
    # covers the cross-process resume case where a fresh app instance
    # reads a previously-persisted run: the new RunEventBus has no
    # `_closed` entry for this run_id, so subscribe wouldn't queue the
    # sentinel and the async-for below would block forever.
    if run_id not in in_flight:
        if bus_iter is not None:
            await bus_iter.aclose()
        return

    # Drain live events. If close fires between this check and the
    # first __anext__ (race: run terminates inline), RunEventBus's
    # `_closed` tracking queues the sentinel on our subscribe and the
    # iterator ends immediately.
    if bus_iter is not None:
        async for evt in bus_iter:
            if evt.seq > last_seq:
                yield _format_sse_event(evt)
                last_seq = evt.seq
