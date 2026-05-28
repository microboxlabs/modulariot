from __future__ import annotations

import asyncio
import logging
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from pathlib import Path
from typing import Literal
from uuid import uuid4

from fastapi import FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from pydantic import BaseModel
from traceloop.sdk import Traceloop

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.api.identity import (
    IdentityVerificationError,
    verify_signed_identity,
)
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


class ApprovalDecision(BaseModel):
    """Body schema for POST /runs/{run_id}/approvals/{approval_id}.

    Only `approve` and `deny` are valid; the Pydantic Literal validation
    rejects anything else with a 422 before the route handler runs.
    """

    decision: Literal["approve", "deny"]


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

    @app.middleware("http")
    async def identity_middleware(request: Request, call_next):  # type: ignore[no-untyped-def]
        # Plan 07 gap 8. When `identity_signing_key` is set, an
        # `X-MIOT-Identity` header is verified and the parsed claims are
        # attached to request.state for the run handlers to consume.
        # When the key is unset (dev / evals) the middleware is a no-op
        # and body-supplied tenant_id/user_id pass through unchanged.
        request.state.identity = None
        if settings.identity_signing_key is not None:
            header = request.headers.get("X-MIOT-Identity")
            if header is not None:
                try:
                    request.state.identity = verify_signed_identity(
                        header,
                        settings.identity_signing_key,
                        skew_seconds=settings.identity_skew_seconds,
                    )
                except IdentityVerificationError:
                    # 401 with a generic message: don't leak whether the
                    # header was expired, malformed, or signed with the
                    # wrong key — those are all "not authenticated".
                    return Response(status_code=401, content="invalid identity")
        return await call_next(request)

    def _resolve_request_identity(
        request: Request, body: UserRequest
    ) -> UserRequest:
        """Reconcile the verified header (if any) with the request body.

        - Header present and verified: header wins, body-supplied
          tenant_id/user_id are overwritten.
        - No header but signing key configured: 401. The middleware
          only rejects malformed headers — *missing* headers fail
          here so callers can't omit identity entirely.
        - Signing key unset (dev / evals): body values pass through.
        """
        identity = getattr(request.state, "identity", None)
        if identity is not None:
            return body.model_copy(
                update={
                    "tenant_id": identity.tenant_id,
                    "user_id": identity.user_id,
                }
            )
        if settings.identity_signing_key is not None:
            raise HTTPException(
                status_code=401, detail="X-MIOT-Identity required"
            )
        return body

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
        http_request: Request,
        debug: bool = Query(False),
    ) -> HarnessRunRecord:
        # Read harness from app.state so tests that inject a controlled
        # graph (via app.state.harness.nexo_graph = ...) see their patch.
        # Explicit annotation narrows `app.state` (Any) for mypy.
        harness: HarnessSupervisor = app.state.harness
        request = _resolve_request_identity(http_request, request)
        if debug:
            request = request.model_copy(update={"debug": True})
        _enforce_debug_allowlist(request, settings)
        return await harness.run(request)

    @app.get("/runs/{run_id}", response_model=HarnessRunRecord)
    async def get_run(run_id: str) -> HarnessRunRecord:
        harness: HarnessSupervisor = app.state.harness
        return harness.run_store.load(run_id)

    @app.post("/runs:start", status_code=202)
    async def start_run(
        request: UserRequest,
        http_request: Request,
        debug: bool = Query(False),
    ) -> dict[str, str]:
        request = _resolve_request_identity(http_request, request)
        if debug:
            request = request.model_copy(update={"debug": True})
        _enforce_debug_allowlist(request, settings)
        run_id = f"run_{uuid4().hex}"
        task = asyncio.create_task(
            app.state.harness.run(request, run_id_override=run_id)
        )
        app.state.in_flight[run_id] = task

        def _cleanup(_task: asyncio.Task[HarnessRunRecord]) -> None:
            app.state.in_flight.pop(run_id, None)

        task.add_done_callback(_cleanup)
        return {"run_id": run_id}

    @app.post("/runs/{run_id}/approvals/{approval_id}", status_code=204)
    async def resolve_approval(
        run_id: str, approval_id: str, body: ApprovalDecision
    ) -> Response:
        # The approval registry is keyed by approval_id alone — run_id is
        # in the path for symmetry with the rest of the API and for audit
        # logs, not as part of the lookup. A 404 here means the approval
        # is unknown: never requested, already resolved, or discarded.
        registry = app.state.harness.approval_registry
        if registry is None or not registry.resolve(approval_id, body.decision):
            raise HTTPException(status_code=404, detail="Approval not pending")
        return Response(status_code=204)

    @app.post("/runs/{run_id}/cancel", status_code=204)
    async def cancel_run(run_id: str) -> Response:
        # The in-flight registry is populated by POST /runs:start. A
        # caller can't cancel a synchronous POST /runs (it never enters
        # in_flight). Missing entry → 404 is the right answer; the run
        # either never started, already terminated, or was cancelled.
        task = app.state.in_flight.get(run_id)
        if task is None:
            raise HTTPException(status_code=404, detail="Run not in flight")
        task.cancel()
        return Response(status_code=204)

    @app.get("/runs/{run_id}/stream")
    async def stream_run(run_id: str, request: Request) -> StreamingResponse:
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
