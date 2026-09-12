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
import inspect
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, SystemMessage

from miot_harness.agents.direct_agent import (
    FALLBACK_DIRECT_ANSWER,
    direct_agent_node,
)
from miot_harness.agents.meta_agent import (
    MetaAgentCatalogEntry,
    meta_agent_node,
)
from miot_harness.agents.synthesizer import (
    emit_grounding_gap,
    extract_assumptions,
    harden_answer,
)
from miot_harness.config import HarnessSettings, get_settings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.spans import agent_span
from miot_harness.runtime.answer_render import render_answer_with_format
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.context import (
    MAX_CONVERSATION_HISTORY_TURNS,
    HarnessContext,
    UserRequest,
)
from miot_harness.runtime.conversation import (
    ConversationHistory,
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
from miot_harness.runtime.tenancy import tenancy_gate_decision
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

# Ceiling on how many replayed turns are seeded. The request model rejects a
# longer list outright (`MAX_CONVERSATION_HISTORY_TURNS`); this keeps the same
# bound for callers that build a UserRequest directly, and the token budget
# still governs what actually reaches the model.
_MAX_SEEDED_TURNS = MAX_CONVERSATION_HISTORY_TURNS

# Routes the agent loop does not take over. Storytelling has its own
# module; every other route the loop can answer itself.
_THREAD_OWNER_EXEMPT = frozenset({HarnessRoute.STORYTELLING_RUN})

_JSON_BLOCKS_INSTRUCTION = (
    "# Output format: JSON blocks\n\n"
    "Return ONLY a JSON array of typed blocks as your entire answer — no prose "
    "outside the array and no code fence. Each block is an object "
    '{"type": <string>, "value": <...>}. Known types:\n'
    '- "markdown": value is a Markdown string.\n'
    '- "url": value is an object {"url": <string>, "name": <string>}.\n'
    "Emit multiple blocks to convey different parts of the answer.\n"
    "This contract applies ONLY to the final user-facing answer; internal "
    "protocol outputs (planner action objects, tool-call JSON, verdicts) "
    "keep their own formats."
)


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
        agent_loop: Any | None = None,
        meta_model: BaseChatModel | None = None,
        meta_primer: str = "",
        meta_catalog: list[MetaAgentCatalogEntry] | None = None,
        conversation_store: ConversationStore | None = None,
        conversation_token_budget: int = 24_000,
        conversation_tool_token_budget: int = 48_000,
        # Folds a conversation's older turns into its summary once the store's
        # turn cap is passed. None leaves histories to the token trim alone.
        conversation_summarizer: Callable[[ConversationHistory], Awaitable[str]] | None = None,
        router_context_turns: int = 2,
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
        # Single-agent loop (spec 2026-07-02). When set, DATA_AGENTIC runs
        # this instead of agentic_graph. Both stay wire-able so the flag can
        # flip per deployment while golden evals compare the two.
        self.agent_loop = agent_loop
        self.meta_model = meta_model
        self.meta_primer = meta_primer
        self.meta_catalog: list[MetaAgentCatalogEntry] = meta_catalog or []
        self.conversation_store = conversation_store
        self.conversation_token_budget = conversation_token_budget
        self.conversation_tool_token_budget = conversation_tool_token_budget
        self.conversation_summarizer = conversation_summarizer
        self.router_context_turns = router_context_turns
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
        # Set by the lifespan after boot to the primary connection's name (e.g.
        # "acs"); None in legacy/dev. Stamped onto ground-or-flag assumptions so
        # the review surface can stage a candidate against the right connection.
        self.primary_connection_name: str | None = None

    def _stamp_connection(
        self, assumptions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Attach the run's connection to each declared assumption. The
        synthesizer self-reports term/interpretation/predicate; the connection is
        the harness's to assign (the LLM can't reliably know it) and defaults to
        the primary connection this deployment serves. Never overwrites a
        connection already present, and a no-op when none is configured."""
        conn = self.primary_connection_name
        if not conn:
            return list(assumptions)
        return [
            {**a, "connection": conn}
            if isinstance(a, dict) and not a.get("connection")
            else a
            for a in assumptions
        ]

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
        effective_policy, mode_denied = self._resolve_policy(request, ctx, settings=settings)
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

        # Seed a replayed transcript into the store before routing: the
        # router reads the last turns from it. Seeding happens here and only
        # here — a second call could reset a history a concurrent run has
        # appended to meanwhile. The projection to messages waits for the
        # route, which decides whether tool calls replay.
        history = self._seeded_history(request, ctx)

        # Route via the LLM router when injected; else fall back to the
        # keyword router (Plan 12 default; the "auto" mode confidence
        # fallback also lands here under the hood).
        try:
            route = await self._resolve_route(request, ctx)
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
            self._finalize_answer(record, ctx)
            self.run_store.save(record)
            self._close_bus(ctx.run_id)
            return record

        classified = self._apply_catalog_route_override(route)
        route = self._apply_thread_owner_override(classified, request, ctx)

        # `route` is what runs. When the loop took the turn over, the router's
        # own verdict rides alongside it: it is the signal for whether the
        # override is picking up turns the router would have sent elsewhere.
        route_data: dict[str, Any] = {"route": route.route}
        if route.route != classified.route:
            route_data["classified_route"] = classified.route
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="route.selected",
                message=route.reason,
                data=route_data,
            )
        )

        prior_messages = self._project_history(
            history, include_tool_calls=self._loop_owns(route)
        )
        prior_messages = self._inject_skill(request, ctx, prior_messages)
        prior_messages = self._inject_json_blocks_instruction(ctx, prior_messages)

        turn_messages: list[BaseMessage] | None = None
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
                turn_messages = await self._run_data_agentic(
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
            self._finalize_answer(record, ctx)
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
            self._finalize_answer(record, ctx)
            self.run_store.save(record)
            self._close_bus(ctx.run_id)
            return record

        # Persist the turn so the next call in this conversation sees it.
        conversation_key = self._conversation_key(request, ctx)
        if self.conversation_store is not None and conversation_key and record.answer:
            self.conversation_store.append(
                conversation_key,
                ConversationTurn(
                    user_message=request.message,
                    assistant_answer=record.answer,
                    messages=tuple(turn_messages or ()),
                ),
            )
            await self._compact_history(conversation_key)
            history = self.conversation_store.get(conversation_key)
            record.conversation_summary = history.summary if history else None

        record.status = "completed"
        progress(HarnessEvent(run_id=ctx.run_id, type="run.completed", message="Run completed"))
        self._finalize_answer(record, ctx)
        self.run_store.save(record)
        self._close_bus(ctx.run_id)
        return record

    def _finalize_answer(self, record: HarnessRunRecord, ctx: HarnessContext) -> None:
        """Render `record.answer` into the caller-requested format in place.

        Must be called AFTER any ConversationStore append (history stores the
        canonical Markdown) and immediately BEFORE persisting the record.
        None-safe; render_answer_with_format never raises.

        Must be called exactly once per run: it mutates `record.answer` in
        place, so re-finalizing a non-markdown answer would double-render and
        corrupt it.
        """
        rendered, effective_fmt = render_answer_with_format(record.answer, ctx.answer_format)
        record.answer = rendered
        record.answer_format = effective_fmt

    async def _invoke_graph_emitting(
        self, graph: Any, initial_state: dict[str, Any], record: HarnessRunRecord
    ) -> dict[str, Any]:
        """Run a compiled graph, landing its `_events` on the record AS each
        node completes rather than after the whole run.

        LangGraph's `astream(stream_mode="values")` yields the merged state
        after every node; emitting the not-yet-seen tail of `_events` per
        snapshot makes `GET /runs/{id}/stream` narrate the run live — the
        point of the SSE endpoint. Before this, events were drained only
        after `ainvoke` returned, so subscribers saw `route.selected` and
        then one flush at run end (~40s of silence on agentic runs).

        Falls back to `ainvoke` + post-hoc drain when the graph doesn't
        implement `astream` as an async generator (unit-test doubles /
        AsyncMock). Events are deduped by `event.id` so replace-vs-append
        channel semantics can't double-emit.
        """
        final_state: dict[str, Any]
        astream = getattr(graph, "astream", None)
        if astream is None or not inspect.isasyncgenfunction(astream):
            final_state = await graph.ainvoke(initial_state)
            for evt in final_state.get("_events") or []:
                self._emit(record, evt)
            return final_state

        emitted_ids: set[str] = set()
        final_state = initial_state
        async for state in astream(initial_state, stream_mode="values"):
            final_state = state
            for evt in final_state.get("_events") or []:
                if evt.id not in emitted_ids:
                    emitted_ids.add(evt.id)
                    self._emit(record, evt)
        return final_state

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

    def _inject_skill(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
    ) -> list[BaseMessage]:
        """Prepend an activated skill's body as run guidance.

        When ``request.skill_id`` resolves to a skill the tenant can see,
        its SKILL.md body is injected as a ``SystemMessage`` at the front
        of the conversation so every run path (direct/meta/data/agentic)
        follows it — the invocation half of skills. Unknown or bodyless
        ids are ignored and the run proceeds normally (never a hard fail).
        """
        if not request.skill_id or self.context_skills is None:
            return prior_messages
        activated = self.context_skills.activate_skill(
            ctx.tenant_id, request.skill_id
        )
        if activated is None:
            return prior_messages
        name, body = activated
        guidance = SystemMessage(
            content=(
                f"# Active skill: {name}\n\n"
                f'The user invoked the "{name}" skill. Follow these '
                f"instructions for this run:\n\n{body}\n\n"
                "Scope note: these instructions — including any answer "
                "format they specify — apply ONLY to the final user-facing "
                "answer. Internal protocol outputs (planner action objects, "
                "tool-call JSON, verdicts) keep their own formats exactly "
                "as each seat's own instructions state."
            )
        )
        return [guidance, *prior_messages]

    def _inject_json_blocks_instruction(
        self,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
    ) -> list[BaseMessage]:
        """Prepend the JSON-block output contract when json output is requested.

        For ``answer_format == "json"`` the agent must emit a JSON array of
        typed blocks instead of prose; this generic instruction supplies the
        schema contract (any active skill supplies the domain content). For all
        other formats this is a no-op.
        """
        if ctx.answer_format != "json":
            return prior_messages
        return [SystemMessage(content=_JSON_BLOCKS_INSTRUCTION), *prior_messages]

    def _recent_turns(self, request: UserRequest, ctx: HarnessContext) -> list[ConversationTurn]:
        """The last few stored turns, for the router. Call after
        `_hydrate_history`, which is what seeds a replayed conversation."""

        key = self._conversation_key(request, ctx)
        if self.conversation_store is None or key is None or self.router_context_turns <= 0:
            return []
        history = self.conversation_store.get(key)
        if history is None:
            return []
        return history.turns[-self.router_context_turns :]

    async def _compact_history(self, key: str) -> None:
        """Fold older turns into the summary once the store's cap is passed.

        A summarizer failure leaves the history as it was: the turns are
        still there and the next run tries again. The answer is already
        composed by now, so nothing here may fail the run.
        """

        if self.conversation_store is None or self.conversation_summarizer is None:
            return
        try:
            await self.conversation_store.summarize_if_needed(
                key, summarizer=self.conversation_summarizer
            )
        except Exception:  # noqa: BLE001 — memory upkeep must not fail the run
            logger.warning("Conversation compaction failed; keeping the full history")

    @staticmethod
    def _conversation_key(request: UserRequest, ctx: HarnessContext) -> str | None:
        """Store key for this run's conversation, or None for a one-shot.

        Namespaced by the *resolved* tenant and user, not by the caller's
        `conversation_id` alone. That id comes from the request body, so an
        unnamespaced store lets any caller read another tenant's conversation
        as prior context simply by naming its id — and, now that callers can
        seed, write into one. The raw id still goes on the record, where
        Langfuse groups by it.
        """

        if not request.conversation_id:
            return None
        return f"{ctx.tenant_id}/{ctx.user_id}/{request.conversation_id}"

    def _seeded_history(
        self, request: UserRequest, ctx: HarnessContext
    ) -> ConversationHistory | None:
        """The stored history for this conversation, seeding a replay first.

        `run()` calls this exactly once, before routing, and passes what it
        returns to `_project_history`. Do not call it a second time in a run:
        a replay longer than `_MAX_SEEDED_TURNS` seeds only its tail, so the
        next call sees fewer turns than the replay, seeds again, and the reset
        drops any turn a concurrent run appended meanwhile.
        """

        key = self._conversation_key(request, ctx)
        if self.conversation_store is None or key is None:
            return None
        history = self.conversation_store.get(key)
        if self._needs_seeding(history, request):
            history = self._seed_history(request, key)
        return history

    def _project_history(
        self,
        history: ConversationHistory | None,
        *,
        include_tool_calls: bool = False,
    ) -> list[BaseMessage]:
        """Trim an already-seeded history to fit the budget for this route.

        This is the read-half of the `ConversationStore` contract — the
        write-half (append after each run) already lives at the bottom of
        `run()`. Together they make multi-turn chats actually accumulate
        context across `/runs` calls. The token budget is the right knob
        (not turn count) because our synthesizer's long Markdown answers
        make per-turn cost wildly variable.

        Empty when there is no history: no store injected (Plan 12 deploys),
        no `conversation_id`, or a first turn nobody replayed into.

        `include_tool_calls` replays each turn's tool calls and tool results
        and draws on `conversation_tool_token_budget`, which is larger
        because a turn then costs what its tool envelopes cost. Only the
        agent loop may ask for it; see `to_messages`.
        """

        if history is None:
            return []
        budget = (
            self.conversation_tool_token_budget
            if include_tool_calls
            else self.conversation_token_budget
        )
        return to_messages(
            history, max_tokens=budget, include_tool_calls=include_tool_calls
        )

    @staticmethod
    def _needs_seeding(history: ConversationHistory | None, request: UserRequest) -> bool:
        """Whether the caller's replay should be taken over what is held here.

        An id this process has never seen, obviously. Also one whose local tail
        is shorter than the replay and has not been compacted yet: with more
        than one replica, turn 3 can land elsewhere and come back to a replica
        holding a staler history than the caller's. A compacted history is left
        alone — its summary carries context the replay no longer has.
        """

        if not request.conversation_history and not request.conversation_summary:
            return False
        if history is None:
            return True
        return history.summary is None and len(history.turns) < len(
            request.conversation_history
        )

    def _seed_history(self, request: UserRequest, key: str) -> ConversationHistory | None:
        """Prime the store from `request.conversation_history`.

        The store is in-memory, so a conversation the caller still has on
        screen can be one the harness no longer knows: a restart drops every
        history, and clients keep their transcripts far longer than a process
        lives. Rather than answer that turn with no context, take the caller's
        replay of the turns it recorded.

        Fires for an id this process does not know, and for one whose local
        tail is shorter than the replay (see `_needs_seeding`). Otherwise the
        run's own append and `summarize_if_needed` own the history, so a caller
        replaying the same turns again changes nothing.

        Returns None when there is nothing to seed with.
        """

        if self.conversation_store is None:
            return None
        if not request.conversation_history and not request.conversation_summary:
            return None
        self.conversation_store.reset(key)
        for turn in request.conversation_history[-_MAX_SEEDED_TURNS:]:
            self.conversation_store.append(
                key,
                ConversationTurn(
                    user_message=turn.user_message,
                    assistant_answer=turn.assistant_answer,
                ),
            )
        history = self.conversation_store.get(key)
        if request.conversation_summary:
            # The caller's summary covers turns older than the ones it
            # replayed — the compaction that produced it cleared them here.
            if history is None:
                history = ConversationHistory(conversation_id=key)
                self.conversation_store.seed(history)
            history.summary = request.conversation_summary
        return history

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
        ctx: HarnessContext,
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

        # Same namespacing as the history store: a sticky permission posture
        # keyed on the caller's conversation_id alone would be another
        # tenant's to set.
        policy_key = self._conversation_key(request, ctx)
        requested: PermissionMode | None = None
        rules: list[PermissionRule] = []
        if request.permission_mode is not None or request.rules:
            requested = request.permission_mode or PermissionMode.DEFAULT
            rules = list(request.rules)
        elif self.conversation_policy_store is not None and policy_key is not None:
            sticky = self.conversation_policy_store.get(policy_key)
            if sticky is not None:
                requested = sticky.mode
                rules = list(sticky.rules)

        if requested is None:
            return PermissionPolicy(), False

        # tenant is guaranteed non-None here: run() builds the HarnessContext
        # (which requires a tenant) before resolving the policy.
        assert request.tenant_id is not None
        effective, denied = resolve_effective_mode(
            requested, settings=settings, tenant_id=request.tenant_id
        )
        policy = PermissionPolicy(mode=effective, rules=rules)
        if self.conversation_policy_store is not None and policy_key is not None:
            self.conversation_policy_store.set(policy_key, policy)
        return policy, denied

    async def _resolve_route(self, request: UserRequest, ctx: HarnessContext) -> RouteResult:
        """Use the LLM router when available; else the keyword router.

        The LLM router has its own keyword-fallback for low-confidence,
        so callers don't need to fall back explicitly.
        """

        if self.llm_router is not None:
            return await resolve_mode(
                request,
                llm_router=self.llm_router,
                tenant_lock=self.tenant_lock,
                prior_turns=self._recent_turns(request, ctx),
            )
        # Plan 12 default: keyword router on the message; explicit modes
        # are ignored because the keyword router doesn't know about them.
        return self.router.route(request.message)

    def _apply_catalog_route_override(self, route: RouteResult) -> RouteResult:
        """Force DATA_QUERY → DATA_AGENTIC on primitives-only datasources.

        The canned DATA_QUERY seat (`filter_expert`) picks ONE curated data
        function. A datasource with no curated catalog (generic_pg: only
        composable SQL primitives) has nothing for it to pick, so `filter_expert`
        dead-ends — it emits an off-contract step and the run falls to the
        onboarding fallback. Every data question on such a source is agentic
        (composable-primitive) exploration. The intent router already drops
        DATA_QUERY from its menu for these datasources; this is the deterministic
        safety net that also catches an explicit `mode=canned` request and any
        keyword-fallback DATA_QUERY the LLM prompt can't prevent.
        """
        if (
            route.route == HarnessRoute.DATA_QUERY
            and self.profile is not None
            and not self.profile.has_curated_catalog
        ):
            return RouteResult(
                route=HarnessRoute.DATA_AGENTIC,
                reason=(
                    f"{route.reason} → remapped to DATA_AGENTIC "
                    f"({self.profile.name} has no curated catalog)"
                ),
            )
        return route

    def _loop_owns(self, route: RouteResult) -> bool:
        return route.route == HarnessRoute.DATA_AGENTIC and self.agent_loop is not None

    def _tenant_may_use_data(self, ctx: HarnessContext) -> bool:
        """Whether both tenancy gates allow this tenant a data route.

        Two locks are in play and they can disagree. `self.tenant_lock` is the
        one the lifespan resolved, which prefers the primary connection's own
        lock; the loop re-gates with the env override and the profile default
        only. Remapping on the strictly weaker of the two would either hand a
        connection-locked datasource to another tenant, or turn a meta
        question every tenant may ask into the loop's refusal. So both must
        allow, and otherwise the route the router picked stands.
        """

        if self.tenant_lock and ctx.tenant_id != self.tenant_lock:
            return False
        return tenancy_gate_decision(
            ctx=ctx,
            route=HarnessRoute.DATA_AGENTIC,
            settings=get_settings(),
            profile=self.profile,
        ).allowed

    def _apply_thread_owner_override(
        self, route: RouteResult, request: UserRequest, ctx: HarnessContext
    ) -> RouteResult:
        """Send every turn to the agent loop once it is wired.

        The router classifies each turn on its own. A follow-up such as "did
        you query the GPS database?" reads as a meta question, so it landed
        on `direct_agent` — a seat with no tools and no view of what the
        previous turn ran, which answered that the earlier numbers were
        invented. One seat owning the thread keeps one transcript, one model
        and one tool history.

        Three things stay off the loop. STORYTELLING_RUN, which has its own
        module. A caller-chosen `mode`, which names the seat it wants and
        would become a no-op for half its values if this rewrote it. And any
        tenant either tenancy gate refuses: both have to allow the data route,
        or a meta question every tenant may ask would be remapped into a
        refusal by whichever gate is stricter.
        """

        if self.agent_loop is None or route.route in _THREAD_OWNER_EXEMPT:
            return route
        if route.route == HarnessRoute.DATA_AGENTIC or request.mode != "auto":
            return route
        if not self._tenant_may_use_data(ctx):
            return route
        return RouteResult(
            route=HarnessRoute.DATA_AGENTIC,
            reason=f"{route.reason} → remapped to DATA_AGENTIC (agent loop owns the thread)",
        )

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
            # Streams the graph's _events channel onto the record per node
            # (live SSE) instead of draining it after the run.
            final_state = await self._invoke_graph_emitting(
                self.data_graph, initial_state, record
            )

        graph_answer = final_state.get("answer")
        if graph_answer:
            record.answer = str(graph_answer)
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
    ) -> list[BaseMessage] | None:
        """Returns the loop's turn transcript, for the conversation store.

        None on the planner-graph path, which reports no messages.
        """
        if self.agent_loop is not None:
            with agent_span("run", **self._root_span_kwargs(ctx, route)):
                delta = await self.agent_loop.run(
                    user_message=request.message,
                    ctx=ctx,
                    prior_messages=prior_messages or [],
                    progress=progress,
                )
            answer = delta.get("answer") or "(no answer produced by agent loop)"
            record.answer = harden_answer(answer)
            # Ground-or-flag: the loop path bypasses the synthesizer, so the
            # assumption blocks must be surfaced here too — otherwise this
            # route feeds nothing to the capture/distill loop.
            assumptions = extract_assumptions(record.answer)
            for assumption in assumptions:
                emit_grounding_gap(progress, ctx.run_id, assumption)
            record.assumptions = self._stamp_connection(assumptions)
            return list(delta.get("messages") or [])

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
            return None

        initial_state: dict[str, Any] = {
            "user_message": request.message,
            "ctx": ctx,
            "evidence": [],
            "turn_count": 0,
            "prior_messages": prior_messages or [],
        }
        with agent_span("run", **self._root_span_kwargs(ctx, route)):
            # Streams the graph's _events channel onto the record per node
            # (live SSE) instead of draining it after the run.
            final_state = await self._invoke_graph_emitting(
                self.agentic_graph, initial_state, record
            )
        record.answer = str(
            final_state.get("answer") or "(no answer produced by agentic graph)"
        )
        # Ground-or-flag: carry the synthesizer's declared assumptions onto the
        # persisted record (feeds the capture/distill loop; empty when grounded).
        record.assumptions = self._stamp_connection(
            list(final_state.get("assumptions") or [])
        )
        return None

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
