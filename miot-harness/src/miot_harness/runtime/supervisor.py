"""HarnessSupervisor — top-level run orchestrator.

Routes incoming requests via either:
- the **LLM intent router** (`LLMIntentRouter`) when injected — the
  Phase-E surface; or
- the **keyword router** (`IntentRouter`) — the Plan 12 default and the
  fallback for "auto" mode below the LLM's confidence threshold.

Then dispatches to:
- `data_graph` (DATA_QUERY, canned data path)
- `agentic_graph` (DATA_AGENTIC, composable-primitive exploration)
- `meta_agent_node` (DATA_META, schema/primer questions; no SQL)
- `storytelling` module (STORYTELLING_RUN, mocked narrative path)
- `direct_agent_node` (DIRECT / OTHER, small talk — the harness
  composes the reply; the old "client renders" contract left
  ``answer`` null and no client implemented it, see #628)

`conversation_id` is hydrated/appended via `ConversationStore` so
multi-turn chats accumulate context across `/runs` calls.
"""

from __future__ import annotations

import asyncio
import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage

from miot_harness.agents.direct_agent import (
    FALLBACK_DIRECT_ANSWER,
    direct_agent_node,
)
from miot_harness.agents.meta_agent import (
    MetaAgentCatalogEntry,
    meta_agent_node,
)
from miot_harness.config import HarnessSettings, get_settings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.spans import agent_span
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.conversation import (
    ConversationStore,
    ConversationTurn,
    to_messages,
)
from miot_harness.runtime.conversation_policy import ConversationPolicyStore
from miot_harness.runtime.data_graph import instrument_model
from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.mode_resolver import ModeAccessDenied, resolve_mode
from miot_harness.runtime.permissions import (
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
)
from miot_harness.runtime.policy import resolve_effective_mode
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


class HarnessSupervisor:
    def __init__(
        self,
        router: IntentRouter,
        tools: ToolRegistry,
        stories: StorytellingModule,
        run_store: JsonRunStore,
        data_graph: Any | None = None,
        *,
        llm_router: LLMIntentRouter | None = None,
        agentic_graph: Any | None = None,
        meta_model: BaseChatModel | None = None,
        meta_primer: str = "",
        meta_catalog: list[MetaAgentCatalogEntry] | None = None,
        conversation_store: ConversationStore | None = None,
        conversation_token_budget: int = 24_000,
        # Empty default = no lock configured yet; the lifespan overwrites
        # this from the active datasource profile at boot. An empty lock
        # refuses gated (agentic/canned) modes until configured — secure by
        # default rather than hardcoding any one datasource's tenant here.
        tenant_lock: str = "",
        event_bus: RunEventBus | None = None,
        checkpoint_every_n_events: int = 10,
        approval_registry: ApprovalRegistry | None = None,
        conversation_policy_store: ConversationPolicyStore | None = None,
    ) -> None:
        self.router = router
        self.tools = tools
        self.stories = stories
        self.run_store = run_store
        self.data_graph = data_graph
        self.llm_router = llm_router
        self.agentic_graph = agentic_graph
        self.meta_model = meta_model
        self.meta_primer = meta_primer
        self.meta_catalog: list[MetaAgentCatalogEntry] = meta_catalog or []
        self.conversation_store = conversation_store
        self.conversation_token_budget = conversation_token_budget
        self.tenant_lock = tenant_lock
        self.event_bus = event_bus
        self.checkpoint_every_n_events = checkpoint_every_n_events
        self.approval_registry = approval_registry
        self.conversation_policy_store = conversation_policy_store
        # Set by the lifespan after boot; None = legacy defaults.
        self.profile: DataSourceProfile | None = None
        # Set by the lifespan after the context/skills boot; None when the
        # subsystem is disabled or failed to load. The global context
        # block is already folded into `meta_primer` at boot — this bundle
        # supplies the per-request tenant overlay and the queryable facts.
        self.context_skills: ContextSkillsBundle | None = None

    def _meta_primer_for(self, tenant_id: str) -> str:
        """meta_primer (datasource primer + global context) plus this
        tenant's overlay block, if any."""
        if self.context_skills is None:
            return self.meta_primer
        tenant_block = self.context_skills.primer_for(tenant_id).tenant_block
        if not tenant_block:
            return self.meta_primer
        return f"{self.meta_primer}\n\n# System context (tenant)\n{tenant_block}"

    def _meta_catalog_for(self, tenant_id: str) -> list[MetaAgentCatalogEntry]:
        """The datasource catalog plus this tenant's system facts and the
        available-skills index."""
        if self.context_skills is None:
            return self.meta_catalog
        return self.meta_catalog + self.context_skills.facts_for(tenant_id)

    async def run(
        self,
        request: UserRequest,
        *,
        run_id_override: str | None = None,
    ) -> HarnessRunRecord:
        ctx = request.to_context()
        if run_id_override is not None:
            # The SSE endpoint pre-mints a run_id so it can return it
            # immediately and the caller can subscribe to
            # /runs/{id}/stream before any events are emitted.
            ctx = ctx.model_copy(update={"run_id": run_id_override})
        if self.approval_registry is not None:
            # Plumb the in-process approval registry into the context
            # so HarnessTool.invoke can await on it when a tool's
            # check_permission returns "ask".
            ctx = ctx.model_copy(
                update={"approval_registry": self.approval_registry}
            )
        settings = get_settings()
        effective_policy, mode_denied = self._resolve_policy(request, settings=settings)
        ctx = ctx.model_copy(update={"permission_policy": effective_policy})
        record = HarnessRunRecord(
            run_id=ctx.run_id,
            status="running",
            conversation_id=request.conversation_id,
            tenant_id=ctx.tenant_id,
            user_id=ctx.user_id,
        )

        def progress(event: HarnessEvent) -> None:
            self._emit(record, event)

        progress(HarnessEvent(run_id=ctx.run_id, type="run.started", message="Run started"))
        if mode_denied:
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="steering.mode_denied",
                    message="bypass not permitted in this deployment; using default",
                    data={"requested": "bypass", "effective": "default"},
                )
            )

        # Route via the LLM router when injected; else fall back to the
        # keyword router (Plan 12 default; the "auto" mode confidence
        # fallback also lands here under the hood).
        try:
            route = await self._resolve_route(request)
        except ModeAccessDenied as exc:
            record.answer = str(exc)
            record.status = "completed"
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message=f"Mode refused: {exc}",
                    data={
                        "mode": request.mode,
                        "tenant_id": request.tenant_id,
                        "reason": "mode_access_denied",
                    },
                )
            )
            self.run_store.save(record)
            self._close_bus(ctx.run_id)
            return record

        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="route.selected",
                message=route.reason,
                data={"route": route.route},
            )
        )

        # Hydrate prior turns from `ConversationStore` so LLM-bearing agents
        # actually carry context across `/runs` calls (plan 13 §E5). Empty
        # list when no store, no conversation_id, or no prior history.
        prior_messages = self._hydrate_history(request)

        try:
            if route.route == HarnessRoute.DATA_QUERY:
                await self._run_data_query(
                    request, ctx, record, progress, route.route, prior_messages
                )
            elif route.route == HarnessRoute.DATA_META:
                await self._run_data_meta(
                    request, ctx, record, progress, route.route, prior_messages
                )
            elif route.route == HarnessRoute.DATA_AGENTIC:
                await self._run_data_agentic(
                    request, ctx, record, progress, route.route, prior_messages
                )
            elif route.route == HarnessRoute.STORYTELLING_RUN:
                await self._run_storytelling(ctx, record, progress)
            else:
                # DIRECT / OTHER (and any future unrouted kind): the
                # harness composes the reply (#628). Leaving answer
                # null here surfaced as "(no answer recorded)" in every
                # client.
                await self._run_direct(
                    request, ctx, record, progress, route.route, prior_messages
                )
        except asyncio.CancelledError:
            # POST /runs/{id}/cancel cancelled this task. Surface a
            # terminal `run.failed` with `reason=cancelled` so SSE
            # subscribers get an explicit terminator (not a silent close),
            # persist the partial record, then re-raise so the asyncio
            # task transitions to CANCELLED.
            record.status = "failed"
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="run.failed",
                    message="Run cancelled",
                    data={"error": "cancelled", "reason": "cancelled"},
                )
            )
            self.run_store.save(record)
            self._close_bus(ctx.run_id)
            raise
        except Exception as exc:  # noqa: BLE001 — supervisor must not propagate
            logger.exception("HarnessSupervisor.run failed")
            record.status = "failed"
            # Drain any agent-boundary events the lifecycle wrapper
            # stashed on the exception (see runtime/node_lifecycle.py).
            # These are emitted BEFORE run.failed so the SSE stream's
            # ordering keeps agent.started / agent.completed inside the
            # owning run's event sequence.
            for ev in getattr(exc, "_harness_lifecycle_events", None) or []:
                progress(ev)
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="run.failed",
                    message=f"Run failed: {exc}",
                    data={"error": str(exc)},
                )
            )
            self.run_store.save(record)
            self._close_bus(ctx.run_id)
            return record

        # Persist the turn so the next call in this conversation sees it.
        if self.conversation_store is not None and request.conversation_id and record.answer:
            self.conversation_store.append(
                request.conversation_id,
                ConversationTurn(
                    user_message=request.message,
                    assistant_answer=record.answer,
                ),
            )

        record.status = "completed"
        progress(HarnessEvent(run_id=ctx.run_id, type="run.completed", message="Run completed"))
        self.run_store.save(record)
        self._close_bus(ctx.run_id)
        return record

    def _emit(self, record: HarnessRunRecord, event: HarnessEvent) -> None:
        """Single funnel for landing a `HarnessEvent` on a run record.

        Stamps a monotonic `seq` on the event the moment it lands. Graph-
        emitted events arrive with the default `seq=0` (graphs don't know
        record state); rewriting here keeps the supervisor as the single
        source of truth for run-wide ordering — what the SSE stream's
        `Last-Event-ID` replay leans on.

        When an `event_bus` is injected, the event is also published to
        every live subscriber for this run. The debounced run_store
        checkpoint (A6) will hang off this funnel too.
        """

        event.seq = len(record.events)
        record.events.append(event)
        if self.event_bus is not None:
            self.event_bus.publish(record.run_id, event)
            # Periodic mid-flight checkpoint so SSE reconnects find a
            # recent on-disk snapshot. Skipped when no bus is wired
            # (eval / demo-CLI path) to avoid extra writes that the
            # caller never reads back. The terminal save inside run()
            # always fires regardless.
            if (
                self.checkpoint_every_n_events > 0
                and len(record.events) % self.checkpoint_every_n_events == 0
            ):
                self.run_store.save(record)

    def _close_bus(self, run_id: str) -> None:
        """Tell the event bus this run is done. No-op when no bus is
        injected. Called at every terminal point in `run()` so SSE
        subscribers' iterators always end — even on mode refusal and
        graph exceptions.
        """

        if self.event_bus is not None:
            self.event_bus.close(run_id)

    def _hydrate_history(self, request: UserRequest) -> list[BaseMessage]:
        """Read prior turns from `ConversationStore` and trim them to fit the
        `conversation_token_budget` (via `trim_messages`).

        Returns an empty list when:
        - no `conversation_store` injected (Plan 12 deploys),
        - request has no `conversation_id`,
        - the store has no prior history for that id (first turn of a chat).

        This is the read-half of the `ConversationStore` contract — the
        write-half (append after each run) already lives at the bottom of
        `run()`. Together they make multi-turn chats actually accumulate
        context across `/runs` calls. The token budget is the right knob
        (not turn count) because our synthesizer's long Markdown answers
        make per-turn cost wildly variable.
        """

        if self.conversation_store is None or not request.conversation_id:
            return []
        history = self.conversation_store.get(request.conversation_id)
        if history is None:
            return []
        return to_messages(history, max_tokens=self.conversation_token_budget)

    def _root_span_kwargs(
        self, ctx: HarnessContext, route: HarnessRoute | None
    ) -> dict[str, Any]:
        """Common kwargs for `agent_span("run", ...)` across all dispatch paths.

        Centralizes the Langfuse first-class field mapping (E10) so every
        route's root span carries `user_id`, `session_id`, and `tags`
        identically. `tags` includes the resolved route when known.

        When a profile is set on the supervisor, ``span_prefix`` is taken
        from ``profile.name``; otherwise it falls back to ``"datasource"``
        as a neutral default.
        """

        tags: list[str] = [f"tenant:{ctx.tenant_id}", f"mode:{ctx.mode}"]
        if route is not None:
            tags.append(f"route:{route.value}")
        return {
            "run_id": ctx.run_id,
            "tenant_id": ctx.tenant_id,
            "mode": ctx.mode,
            "user_id": ctx.user_id,
            "session_id": ctx.conversation_id or ctx.thread_id,
            "tags": tags,
            "span_prefix": self.profile.name if self.profile is not None else "datasource",
        }

    def _resolve_policy(
        self,
        request: UserRequest,
        *,
        settings: HarnessSettings,
    ) -> tuple[PermissionPolicy, bool]:
        """Resolve the effective permission policy for this run.

        Precedence: request (mode+rules) -> sticky conversation policy ->
        DEFAULT. The chosen mode passes through the bypass policy gate; a
        forbidden bypass is downgraded to DEFAULT with denied=True. Side
        effect: the resolved policy is persisted as the sticky conversation
        policy so a later turn that omits mode/rules inherits them. Note: a
        denied bypass persists the downgraded DEFAULT policy, so a later
        mode-less turn inherits DEFAULT rather than re-triggering the denial.
        """

        requested: PermissionMode | None = None
        rules: list[PermissionRule] = []
        if request.permission_mode is not None or request.rules:
            requested = request.permission_mode or PermissionMode.DEFAULT
            rules = list(request.rules)
        elif (
            self.conversation_policy_store is not None
            and request.conversation_id
        ):
            sticky = self.conversation_policy_store.get(request.conversation_id)
            if sticky is not None:
                requested = sticky.mode
                rules = list(sticky.rules)

        if requested is None:
            return PermissionPolicy(), False

        effective, denied = resolve_effective_mode(
            requested, settings=settings, tenant_id=request.tenant_id
        )
        policy = PermissionPolicy(mode=effective, rules=rules)
        if (
            self.conversation_policy_store is not None
            and request.conversation_id
        ):
            self.conversation_policy_store.set(request.conversation_id, policy)
        return policy, denied

    async def _resolve_route(self, request: UserRequest) -> RouteResult:
        """Use the LLM router when available; else the keyword router.

        The LLM router has its own keyword-fallback for low-confidence,
        so callers don't need to fall back explicitly.
        """

        if self.llm_router is not None:
            return await resolve_mode(
                request,
                llm_router=self.llm_router,
                tenant_lock=self.tenant_lock,
            )
        # Plan 12 default: keyword router on the message; explicit modes
        # are ignored because the keyword router doesn't know about them.
        return self.router.route(request.message)

    async def _run_storytelling(
        self,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
    ) -> None:
        story = await self.stories.create_delivery_compliance_story(ctx, self.tools, progress)
        record.artifacts.append(story.model_dump())
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="artifact.created",
                message="Created delivery compliance story artifact",
                data={"artifact_id": story.id},
            )
        )

    async def _run_data_query(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        route: HarnessRoute | None = None,
        prior_messages: list[BaseMessage] | None = None,
    ) -> None:
        if self.data_graph is None:
            display_name = (
                self.profile.display_name if self.profile is not None else "Datasource"
            )
            answer = (
                f"{display_name} integration is currently disabled "
                "(no DB tunnel or boot failed). Try again once it's restored."
            )
            record.answer = answer
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="datasource integration disabled",
                    data={"length": len(answer)},
                )
            )
            return

        initial_state: dict[str, Any] = {
            "user_message": request.message,
            "ctx": ctx,
            "evidence": [],
            "turn_count": 0,
            "prior_messages": prior_messages or [],
        }
        with agent_span("run", **self._root_span_kwargs(ctx, route)):
            final_state = await self.data_graph.ainvoke(initial_state)

        # Drain the graph's _events channel into the run record in order
        for evt in final_state.get("_events") or []:
            self._emit(record, evt)

        answer = final_state.get("answer")
        if answer:
            record.answer = answer
        else:
            display_name = (
                self.profile.display_name if self.profile is not None else "datasource"
            )
            record.answer = f"(no answer produced by {display_name} graph)"

        # Persist DataPlan in artifacts (review item N12)
        plan = final_state.get("plan")
        if plan is not None and hasattr(plan, "model_dump"):
            record.artifacts.append({"type": "data_plan", **plan.model_dump()})

    async def _run_data_agentic(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        route: HarnessRoute | None = None,
        prior_messages: list[BaseMessage] | None = None,
    ) -> None:
        if self.agentic_graph is None:
            answer = (
                "Agentic exploration is currently disabled "
                "(no agentic_graph wired). Try again once it's restored."
            )
            record.answer = answer
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="Agentic graph not wired",
                    data={"length": len(answer)},
                )
            )
            return

        initial_state: dict[str, Any] = {
            "user_message": request.message,
            "ctx": ctx,
            "evidence": [],
            "turn_count": 0,
            "prior_messages": prior_messages or [],
        }
        with agent_span("run", **self._root_span_kwargs(ctx, route)):
            final_state = await self.agentic_graph.ainvoke(initial_state)

        for evt in final_state.get("_events") or []:
            self._emit(record, evt)
        record.answer = final_state.get("answer") or "(no answer produced by agentic graph)"

    async def _run_data_meta(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        route: HarnessRoute | None = None,
        prior_messages: list[BaseMessage] | None = None,
    ) -> None:
        if self.meta_model is None:
            answer = (
                "Meta agent is currently disabled "
                "(no meta_model wired). Try again once it's restored."
            )
            record.answer = answer
            # Terminal event mirrors the disabled-datasource branch in
            # _run_data_query: SSE subscribers need answer.completed, not
            # a silent close.
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="meta agent disabled",
                    data={"length": len(answer)},
                )
            )
            return

        from miot_harness.config import get_settings

        settings = get_settings()
        stream_enabled = settings.agents_synthesizer_stream
        from time import monotonic

        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.started",
                message="Entering meta_agent",
                data={"agent": "meta_agent", "graph": "meta", "turn": 0},
            )
        )
        start = monotonic()

        # Wrap meta_model with the per-agent telemetry callback so the
        # `anthropic.chat` observation Traceloop auto-emits carries the
        # same `modular.{agent,tenant_id,mode}` + `langfuse.tags` attrs
        # as the canned/agentic paths. Without this, meta-route inner
        # LLM-call cost slips through tenant rollups at observation
        # granularity (the root trace carries them, but the child
        # observation doesn't). The progress sink wires `usage.recorded`
        # too so SSE clients see token counts for the meta call.
        _meta_span_prefix = self.profile.name if self.profile is not None else "datasource"
        instrumented_meta_model = instrument_model(
            self.meta_model, "meta_agent", ctx,
            progress=progress, span_prefix=_meta_span_prefix,
        )

        try:
            with agent_span("run", **self._root_span_kwargs(ctx, route)):
                delta = await meta_agent_node(
                    {"user_message": request.message},
                    model=instrumented_meta_model,
                    primer=self._meta_primer_for(ctx.tenant_id),
                    catalog=self._meta_catalog_for(ctx.tenant_id),
                    prior_messages=prior_messages or [],
                    progress=progress if stream_enabled else None,
                    stream=stream_enabled,
                    run_id=ctx.run_id,
                )
            exit_reason = "ok"
        except Exception:
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="agent.completed",
                    message="Failed meta_agent",
                    data={
                        "agent": "meta_agent",
                        "graph": "meta",
                        "duration_ms": int((monotonic() - start) * 1000),
                        "exit_reason": "failure",
                    },
                )
            )
            raise
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.completed",
                message="Completed meta_agent",
                data={
                    "agent": "meta_agent",
                    "graph": "meta",
                    "duration_ms": int((monotonic() - start) * 1000),
                    "exit_reason": exit_reason,
                },
            )
        )

        record.answer = delta.get("answer") or "(no answer produced by meta agent)"
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="answer.completed",
                message="Meta agent answered",
                data={"length": len(record.answer or "")},
            )
        )

    async def _run_direct(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        route: HarnessRoute | None = None,
        prior_messages: list[BaseMessage] | None = None,
    ) -> None:
        """Compose the DIRECT / OTHER reply harness-side (#628).

        Reuses ``meta_model`` (same cheap tier) so no extra wiring or
        env is needed; falls back to a canned bilingual greeting when
        no model is wired so ``answer`` is never null.
        """
        if self.meta_model is None:
            record.answer = FALLBACK_DIRECT_ANSWER
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="direct fallback (no model wired)",
                    data={"length": len(record.answer)},
                )
            )
            return

        from time import monotonic

        from miot_harness.config import get_settings

        settings = get_settings()
        stream_enabled = settings.agents_synthesizer_stream

        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.started",
                message="Entering direct_agent",
                data={"agent": "direct_agent", "graph": "direct", "turn": 0},
            )
        )
        start = monotonic()

        # Same telemetry wrap as _run_data_meta: the per-agent span and
        # `usage.recorded` events keep direct-route LLM cost visible in
        # tenant rollups even though the call is tiny.
        _span_prefix = self.profile.name if self.profile is not None else "datasource"
        instrumented_model = instrument_model(
            self.meta_model, "direct_agent", ctx,
            progress=progress, span_prefix=_span_prefix,
        )

        try:
            with agent_span("run", **self._root_span_kwargs(ctx, route)):
                delta = await direct_agent_node(
                    {"user_message": request.message},
                    model=instrumented_model,
                    prior_messages=prior_messages or [],
                    progress=progress if stream_enabled else None,
                    stream=stream_enabled,
                    run_id=ctx.run_id,
                )
            exit_reason = "ok"
        except Exception:
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="agent.completed",
                    message="Failed direct_agent",
                    data={
                        "agent": "direct_agent",
                        "graph": "direct",
                        "duration_ms": int((monotonic() - start) * 1000),
                        "exit_reason": "failure",
                    },
                )
            )
            raise
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.completed",
                message="Completed direct_agent",
                data={
                    "agent": "direct_agent",
                    "graph": "direct",
                    "duration_ms": int((monotonic() - start) * 1000),
                    "exit_reason": exit_reason,
                },
            )
        )

        record.answer = delta.get("answer") or "(no answer produced by direct agent)"
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="answer.completed",
                message="Direct agent answered",
                data={"length": len(record.answer or "")},
            )
        )
