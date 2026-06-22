from __future__ import annotations

import asyncio
import json
import logging
from collections.abc import AsyncIterator, Callable, Mapping
from contextlib import AbstractAsyncContextManager, asynccontextmanager
from dataclasses import replace
from pathlib import Path
from typing import Any, Literal
from uuid import uuid4

import httpx
from fastapi import Depends, FastAPI, HTTPException, Query, Request, Response
from fastapi.responses import StreamingResponse
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor
from pydantic import BaseModel
from traceloop.sdk import Traceloop

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.api.auth import AuthError, JwksCache, verify_token
from miot_harness.api.identity import (
    IdentityVerificationError,
    verify_signed_identity,
)
from miot_harness.config import HarnessSettings, get_settings
from miot_harness.context_skills.loader import boot_context_skills
from miot_harness.datasource.registry import resolve as resolve_datasource
from miot_harness.observability.otel import configure_tracing, shutdown_tracing
from miot_harness.observability.provenance import ProvenanceLog
from miot_harness.runtime.agentic_graph import build_agentic_graph
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.data_graph import build_data_graph
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.factory import build_harness
from miot_harness.runtime.intent_router import LLMIntentRouter
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


class DecisionResolution(BaseModel):
    """Body for POST /runs/{run_id}/decisions/{decision_id}."""

    resolution: Literal["approve", "deny", "edit", "choose"]
    updated_input: dict[str, Any] | None = None
    option_id: str | None = None


def _make_lifespan(
    harness: HarnessSupervisor, settings: HarnessSettings
) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(app: FastAPI) -> AsyncIterator[None]:
        app.state.datasource_enabled = False
        app.state.datasource_registered = []
        app.state.datasource_snapshot_age_minutes = None
        app.state.datasource_provider = None
        # Context & Skills subsystem state (populated by its boot below).
        app.state.context_skills_registered = []
        app.state.context_skills_diagnostics = []
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
        # AgentTelemetryCallback's spans (per-agent) and Traceloop's
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
            # HTTP request spans parent the per-run `<datasource>.run` span so
            # the full request → graph → LLM tree shows up in Langfuse.
            FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)
            logger.info(
                "OTel: tracing enabled (service=%s, env=%s, endpoint=%s)",
                settings.otel_service_name,
                settings.otel_environment,
                settings.otel_endpoint,
            )
        app.state.tracer_provider = tracer_provider

        provider = resolve_datasource(settings.datasource_kind)
        app.state.datasource_provider = provider
        harness.profile = provider.profile
        # The base keyword router ships with no vocabulary; the profile
        # supplies it. Wired BEFORE boot so that a disabled datasource
        # still routes its keywords to the data path (where the
        # "integration disabled" answer lives) instead of DIRECT/OTHER.
        harness.router = IntentRouter(
            data_keywords=provider.profile.router_keywords
        )
        # Tenant lock likewise resolves regardless of boot outcome so
        # mode gating (mode_resolver) keeps refusing off-lock tenants
        # even while the datasource is disabled.
        resolved_lock = (
            settings.datasource_tenant_lock or provider.profile.tenant_lock
        )
        if resolved_lock is not None:
            harness.tenant_lock = resolved_lock
        result = await provider.boot(harness.tools, settings)
        app.state.datasource_enabled = result.enabled
        app.state.datasource_registered = list(result.registered)
        app.state.datasource_snapshot_age_minutes = result.snapshot_age_minutes
        # Per-function freshness survey (Gap 2) — JSON-ready for /health.
        app.state.datasource_freshness = {
            name: {
                "status": probe.status,
                "age_minutes": probe.age_minutes,
                "refreshed_at": (
                    probe.refreshed_at.isoformat() if probe.refreshed_at else None
                ),
            }
            for name, probe in result.freshness.items()
        }

        # Context & Skills subsystem (file-backed now; API-backed later).
        # Loaded AFTER the datasource boot (so connector tool names can
        # collide-check against datasource tools) but OUTSIDE the
        # enabled/disabled branch — it describes the *surrounding* system
        # and must load even when the datasource is down. Boot isolation
        # mirrors the datasource: boot_context_skills never raises on bad
        # files; we log diagnostics and continue. The global context block
        # is folded into the profile primer (a frozen-dataclass `replace`)
        # so it reaches every agent path while staying byte-stable across
        # tenants — keeping the Anthropic cache prefix hot. The per-tenant
        # overlay is applied per request on the meta path (see supervisor).
        effective_profile = provider.profile
        try:
            cs = boot_context_skills(harness.tools, settings)
            harness.context_skills = cs.bundle
            app.state.context_skills_registered = list(cs.registered_tools)
            app.state.context_skills_diagnostics = list(cs.diagnostics)
            global_block = cs.bundle.global_primer()
            if global_block:
                effective_profile = replace(
                    provider.profile,
                    primer=(
                        f"{provider.profile.primer}\n\n"
                        f"# System context\n{global_block}"
                    ),
                )
            for diag in cs.diagnostics:
                (logger.error if diag.level == "error" else logger.warning)(
                    "Context/Skills: %s (%s)", diag.message, diag.path
                )
            logger.info(
                "Context/Skills: %d contexts, %d connector tools registered",
                len(cs.bundle.contexts),
                len(cs.registered_tools),
            )
        except Exception as exc:  # noqa: BLE001 — defense in depth; loader shouldn't raise
            logger.critical(
                "Context/Skills: subsystem boot failed (%s); continuing without it",
                exc,
            )
            harness.context_skills = None

        if not result.enabled:
            logger.info(
                "Datasource %s: disabled (%s)", provider.profile.name, result.reason
            )
        else:
            logger.info(
                "Datasource %s: %d tools registered",
                provider.profile.name,
                len(result.registered),
            )
            # Build the conversational graph and inject into the
            # supervisor. Per-agent models come from settings.
            try:
                synth_thinking_budget = (
                    settings.agents_synthesizer_thinking_budget
                    if settings.agents_synthesizer_stream
                    else None
                )
                models = {
                    "filter_expert": get_chat_model(settings.agents_filter_expert_model),
                    "domain_analyst": get_chat_model(settings.agents_analyst_model),
                    "synthesizer": get_chat_model(
                        settings.agents_synthesizer_model,
                        thinking_budget_tokens=synth_thinking_budget,
                    ),
                    "critic": get_chat_model(settings.agents_critic_model),
                    "summarizer": get_chat_model(settings.agents_summarizer_model),
                }
                harness.data_graph = build_data_graph(
                    registry=harness.tools,
                    settings=settings,
                    models=models,
                    # effective_profile = provider.profile with the global
                    # system-context block folded into its primer.
                    profile=effective_profile,
                )

                # Phase E wiring: agentic_graph + meta agent + LLM
                # intent router. All optional on the supervisor —
                # falling back to keyword routing if any of these
                # aren't injected. (tenant_lock + keyword router are
                # wired above, before boot, so the disabled path keeps
                # routing and mode gating intact.)
                harness.agentic_graph = build_agentic_graph(
                    settings=settings,
                    models={
                        **models,
                        # Agentic graph uses the analyst model as its
                        # planner; same model pool, same callbacks.
                        "planner": get_chat_model(settings.agents_analyst_model),
                    },
                    provenance_log=ProvenanceLog(
                        settings.provenance_log_dir,
                        enabled=settings.provenance_log_enabled,
                    ),
                    # effective_profile = provider.profile with the global
                    # system-context block folded into its primer.
                    profile=effective_profile,
                    registry=harness.tools,
                )
                harness.meta_model = get_chat_model(
                    settings.intent_router_model,
                    thinking_budget_tokens=synth_thinking_budget,
                )
                harness.meta_primer = effective_profile.primer
                # Descriptor-derived entries (title/layer/body + freshness
                # suffix) when the provider supplies them; generic
                # fallback otherwise so the meta agent never goes blind.
                harness.meta_catalog = list(result.catalog_entries) or [
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
                    keyword_fallback=IntentRouter(data_keywords=provider.profile.router_keywords),
                    profile=provider.profile,
                )
                logger.info(
                    "Datasource %s: Phase E wired "
                    "(LLM router=%s, agentic_graph, meta_agent)",
                    provider.profile.name,
                    settings.intent_router_model,
                )
            except Exception as exc:  # noqa: BLE001
                logger.critical(
                    "Datasource %s: failed to build chat models / graph (%s); "
                    "falling back to datasource disabled",
                    provider.profile.name,
                    exc,
                )
                # Tools registered fine but the supervisor can't reach
                # them without the graph — clear the public state so
                # /health reports the disabled-and-empty truth, not a
                # tool list that is unreachable. Every graph/meta entry
                # point is cleared (the failure may have struck after
                # some were already wired — a live agentic_graph behind
                # a disabled /health would silently keep serving), and
                # the provider is closed NOW so its pool doesn't stay
                # allocated for an app that can't use it (close() is
                # idempotent; the outer `finally` re-close is a no-op).
                # harness.router (keyword routing) is intentionally
                # kept: it powers the disabled-path "integration
                # disabled" answer.
                app.state.datasource_enabled = False
                app.state.datasource_registered = []
                app.state.datasource_snapshot_age_minutes = None
                app.state.datasource_freshness = {}
                harness.data_graph = None
                harness.agentic_graph = None
                harness.meta_model = None
                harness.meta_primer = ""  # meta path gates on meta_model
                harness.meta_catalog = []
                harness.llm_router = None
                try:
                    await provider.close()
                except Exception as close_exc:  # noqa: BLE001
                    logger.warning(
                        "Datasource: provider close raised %s", close_exc
                    )

        try:
            yield
        finally:
            if provider is not None:
                try:
                    await provider.close()
                except Exception as exc:  # noqa: BLE001
                    logger.warning("Datasource: provider close raised %s", exc)
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
        except httpx.HTTPError as exc:
            # JWKS endpoint unreachable / erroring: verification could
            # not run, so this is "auth temporarily unavailable", not
            # "token rejected". Return a retryable 503 instead of leaking
            # an opaque 500 (which also carries no Retry-After signal).
            raise HTTPException(
                status_code=503,
                detail="auth_unavailable:jwks_fetch_failed",
                headers={"Retry-After": "5"},
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
        provider = getattr(app.state, "datasource_provider", None)
        ds_name = (
            provider.profile.name if provider is not None else settings.datasource_kind
        )
        diagnostics = getattr(app.state, "context_skills_diagnostics", [])
        return {
            "status": "ok",
            "env": settings.env,
            "datasource": {
                "name": ds_name,
                "enabled": app.state.datasource_enabled,
                "tools": list(app.state.datasource_registered),
                "snapshot_age_minutes": app.state.datasource_snapshot_age_minutes,
                "freshness": getattr(app.state, "datasource_freshness", {}),
            },
            "context_skills": {
                "connector_tools": list(
                    getattr(app.state, "context_skills_registered", [])
                ),
                "diagnostics": [
                    {"level": d.level, "path": d.path, "message": d.message}
                    for d in diagnostics
                ],
            },
        }

    @app.get("/health/ready")
    async def health_ready(response: Response) -> dict[str, object]:
        # Readiness contract (kubelet readinessProbe target): the datasource
        # is "required" iff a DSN is configured. When required-but-not-enabled
        # the lifespan logs critical and continues serving, but the pod
        # should not receive traffic until tools register and the snapshot
        # passes the refuse-gate.
        required = settings.datasource_dsn is not None
        enabled = bool(app.state.datasource_enabled)
        ready = (not required) or enabled
        # Strict mode: an ERROR-level context/skills diagnostic (malformed
        # manifest, unsafe connector) fails readiness so a bad ConfigMap is
        # caught before the pod takes traffic. Default off = log-and-serve.
        cs_errors = [
            d
            for d in getattr(app.state, "context_skills_diagnostics", [])
            if d.level == "error"
        ]
        if settings.context_skills_strict and cs_errors:
            ready = False
        if not ready:
            response.status_code = 503
        provider = getattr(app.state, "datasource_provider", None)
        ds_name = (
            provider.profile.name if provider is not None else settings.datasource_kind
        )
        return {
            "status": "ready" if ready else "not_ready",
            "env": settings.env,
            "datasource": {
                "name": ds_name,
                "required": required,
                "enabled": enabled,
                "tools": list(app.state.datasource_registered),
                "snapshot_age_minutes": app.state.datasource_snapshot_age_minutes,
                "freshness": getattr(app.state, "datasource_freshness", {}),
            },
        }

    @app.post("/runs", response_model=HarnessRunRecord)
    async def create_run(
        request: UserRequest,
        http_request: Request,
        debug: bool = Query(False),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> HarnessRunRecord:
        # Read harness from app.state so tests that inject a controlled
        # graph (via app.state.harness.data_graph = ...) see their patch.
        # Explicit annotation narrows `app.state` (Any) for mypy.
        harness: HarnessSupervisor = app.state.harness
        request = _resolve_request_identity(http_request, request)
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
        try:
            record = harness.run_store.load(run_id)
        except FileNotFoundError as exc:
            # An unknown run is a 404, not a 500 leaked from the store.
            raise HTTPException(
                status_code=404, detail=f"unknown run_id {run_id!r}"
            ) from exc
        _enforce_tenant_owns_run(record, auth, run_id)
        return record

    @app.post("/runs:start", status_code=202)
    async def start_run(
        request: UserRequest,
        http_request: Request,
        debug: bool = Query(False),
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> dict[str, str]:
        request = _resolve_request_identity(http_request, request)
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

    @app.post("/runs/{run_id}/approvals/{approval_id}", status_code=204)
    async def resolve_approval(
        run_id: str,
        approval_id: str,
        body: ApprovalDecision,
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> Response:
        # Tenant scoping (#522): a pending approval only exists while
        # its run is in flight, so the in-flight tenant tracker is the
        # authoritative owner map. A cross-tenant caller gets the same
        # 404 as an unknown approval — no ownership leak.
        caller = auth.get("tenant_id")
        if caller and app.state.in_flight_tenants.get(run_id) != caller:
            raise HTTPException(status_code=404, detail="Approval not pending")
        # Run-scoped lookup: registry.resolve refuses to set the decision
        # if the approval was registered for a different run. A 404 here
        # means the approval is unknown OR belongs to another run —
        # collapsed into the same response so leaked approval_ids don't
        # leak ownership through differential 403/404 responses.
        registry = app.state.harness.approval_registry
        if registry is None or not registry.resolve(
            approval_id, body.decision, run_id
        ):
            raise HTTPException(status_code=404, detail="Approval not pending")
        return Response(status_code=204)

    @app.post("/runs/{run_id}/decisions/{decision_id}", status_code=204)
    async def resolve_decision(
        run_id: str,
        decision_id: str,
        body: DecisionResolution,
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> Response:
        from miot_harness.runtime.control import Resolution

        caller = auth.get("tenant_id")
        if caller and app.state.in_flight_tenants.get(run_id) != caller:
            raise HTTPException(status_code=404, detail="Decision not pending")
        registry = app.state.harness.approval_registry
        resolution = Resolution(
            action=body.resolution,
            updated_input=body.updated_input,
            option_id=body.option_id,
        )
        if registry is None or not registry.resolve(decision_id, resolution, run_id):
            raise HTTPException(status_code=404, detail="Decision not pending")
        return Response(status_code=204)

    @app.post("/runs/{run_id}/cancel", status_code=204)
    async def cancel_run(
        run_id: str,
        auth: Mapping[str, Any] = Depends(require_auth),
    ) -> Response:
        # The in-flight registry is populated by POST /runs:start. A
        # caller can't cancel a synchronous POST /runs (it never enters
        # in_flight). Missing entry → 404 is the right answer; the run
        # either never started, already terminated, or was cancelled.
        # Tenant scoping (#522): a cross-tenant caller gets the same
        # 404 as a missing run — no existence leak.
        task = app.state.in_flight.get(run_id)
        caller = auth.get("tenant_id")
        if task is None or (
            caller and app.state.in_flight_tenants.get(run_id) != caller
        ):
            raise HTTPException(status_code=404, detail="Run not in flight")
        task.cancel()
        return Response(status_code=204)

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
    the SSE stream. On data-touching routes that exposes real tenant
    data, so the gate is secure-by-default: with no
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
    # Serialize with json.dumps: run_id is URL-derived (Starlette
    # percent-decodes path params, so it can contain `"` or `\n`).
    # Hand-building this JSON would let a crafted run_id break out of the
    # payload or inject a forged SSE frame; json.dumps escapes both.
    payload = json.dumps({"error": error, "run_id": run_id})
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
