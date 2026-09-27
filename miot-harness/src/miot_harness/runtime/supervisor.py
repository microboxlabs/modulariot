"""HarnessSupervisor: runs one user turn through the agent loop.

Around the loop it resolves the permission policy, seeds and replays the
conversation, adds the tenant's context and any invoked skill, stores the
turn and compacts long conversations.
"""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Awaitable, Callable
from typing import Any

from langchain_core.messages import AIMessage, BaseMessage, SystemMessage

from miot_harness.config import HarnessSettings, get_settings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.spans import agent_span
from miot_harness.runtime.answer_contract import (
    emit_grounding_gap,
    extract_assumptions,
    harden_answer,
)
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
from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import (
    PermissionMode,
    PermissionPolicy,
    PermissionRule,
)
from miot_harness.runtime.policy import resolve_effective_mode
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore
from miot_harness.runtime.tenancy import data_refusal
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)

# Ceiling on how many replayed turns are seeded. The request model rejects a
# longer list outright (`MAX_CONVERSATION_HISTORY_TURNS`); this keeps the same
# bound for callers that build a UserRequest directly, and the token budget
# still governs what actually reaches the model.
_MAX_SEEDED_TURNS = MAX_CONVERSATION_HISTORY_TURNS

# The answer when no conversation model could be built (no API key, or the
# model failed to load at boot).
NO_MODEL_ANSWER = (
    "The assistant is not available: no conversation model is configured. "
    "Ask an administrator to set one up."
)


def _with_canonical_answer(
    messages: list[BaseMessage], answer: str
) -> list[BaseMessage]:
    """`messages` ending in the answer the user was shown.

    The loop reports what the model wrote; the record carries what
    `harden_answer` made of it. Storing the first would replay an answer the
    user never saw, and for a repaired JSON-block response an invalid one.
    """

    if not messages or not answer:
        return messages
    last = messages[-1]
    if isinstance(last, AIMessage) and not last.tool_calls:
        return [*messages[:-1], AIMessage(content=answer)]
    return [*messages, AIMessage(content=answer)]


def _snapshot(history: ConversationHistory | None) -> ConversationHistory | None:
    """A copy of `history` that later appends cannot change.

    The store hands out the live object, and routing awaits before the turns
    are read. A concurrent run in the same conversation finishing in that
    window would otherwise land its turn in this request's prior context.
    """

    if history is None:
        return None
    return ConversationHistory(
        conversation_id=history.conversation_id,
        turns=list(history.turns),
        summary=history.summary,
    )


_JSON_BLOCKS_INSTRUCTION = (
    "# Output format: JSON blocks\n\n"
    "Return ONLY a JSON array of typed blocks as your entire answer — no prose "
    "outside the array and no code fence. Each block is an object "
    '{"type": <string>, "value": <...>}. Known types:\n'
    '- "markdown": value is a Markdown string.\n'
    '- "url": value is an object {"url": <string>, "name": <string>}.\n'
    "Emit multiple blocks to convey different parts of the answer.\n"
    "Work out what to say before you start writing the answer, not in it: the "
    "answer starts at the opening bracket.\n"
    "This contract applies ONLY to the final user-facing answer; tool calls "
    "keep their own format."
)


class HarnessSupervisor:
    def __init__(
        self,
        tools: ToolRegistry,
        run_store: JsonRunStore,
        *,
        agent_loop: Any | None = None,
        conversation_store: ConversationStore | None = None,
        conversation_tool_token_budget: int = 48_000,
        # Folds a conversation's older turns into its summary once the store's
        # turn cap is passed. None leaves histories to the token trim alone.
        conversation_summarizer: Callable[[ConversationHistory], Awaitable[str]] | None = None,
        # The primary connection's tenant lock, set by the lifespan at boot.
        # Empty means the connection declares none.
        tenant_lock: str = "",
        event_bus: RunEventBus | None = None,
        checkpoint_every_n_events: int = 10,
        approval_registry: ApprovalRegistry | None = None,
        conversation_policy_store: ConversationPolicyStore | None = None,
    ) -> None:
        self.tools = tools
        self.run_store = run_store
        # `AgentLoopRunners`, set by the lifespan once a model is built.
        self.agent_loop = agent_loop
        self.conversation_store = conversation_store
        self.conversation_tool_token_budget = conversation_tool_token_budget
        self.conversation_summarizer = conversation_summarizer
        self.tenant_lock = tenant_lock
        self.event_bus = event_bus
        self.checkpoint_every_n_events = checkpoint_every_n_events
        self.approval_registry = approval_registry
        self.conversation_policy_store = conversation_policy_store
        # Set by the lifespan after boot.
        self.profile: DataSourceProfile | None = None
        # Set by the lifespan after the context/skills boot; None when the
        # subsystem is disabled or failed to load.
        self.context_skills: ContextSkillsBundle | None = None
        # The primary connection's name (e.g. "acs"), stamped onto assumptions
        # so the review surface stages a candidate against the right connection.
        self.primary_connection_name: str | None = None

    def _stamp_connection(
        self, assumptions: list[dict[str, Any]]
    ) -> list[dict[str, Any]]:
        """Attach the run's connection to each declared assumption.

        The model reports term, interpretation and predicate; the connection
        is the primary one this deployment serves. An assumption that already
        names a connection keeps it.
        """
        conn = self.primary_connection_name
        if not conn:
            return list(assumptions)
        return [
            {**a, "connection": conn}
            if isinstance(a, dict) and not a.get("connection")
            else a
            for a in assumptions
        ]

    async def run(
        self,
        request: UserRequest,
        *,
        run_id_override: str | None = None,
        caller_token: str | None = None,
        organization: str | None = None,
    ) -> HarnessRunRecord:
        """`caller_token` and `organization` come from the backend proxy's
        headers, never the body; MCP skills call back as that caller."""
        ctx = request.to_context().model_copy(
            update={"caller_token": caller_token, "organization": organization}
        )
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

        # Seed a replayed transcript here and only here: a second call could
        # reset a history a concurrent run has appended to meanwhile. Hold a
        # snapshot, so a run in the same conversation finishing while this one
        # awaits cannot slip its turn into this request's prior context.
        history = _snapshot(self._seeded_history(request, ctx))

        ctx = ctx.model_copy(
            update={
                "data_refusal": data_refusal(
                    ctx.tenant_id,
                    settings=settings,
                    profile=self.profile,
                    connection_lock=self.tenant_lock or None,
                )
            }
        )
        prior_messages = self._project_history(history)
        prior_messages = self._inject_tenant_context(ctx, prior_messages)
        prior_messages = await self._inject_skill(request, ctx, prior_messages)
        prior_messages = self._inject_json_blocks_instruction(ctx, prior_messages)

        turn_messages: list[BaseMessage] | None = None
        try:
            turn_messages = await self._run_loop(request, ctx, record, progress, prior_messages)
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
            self._restore_evicted(conversation_key, history)
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

    def _emit(self, record: HarnessRunRecord, event: HarnessEvent) -> None:
        """Single funnel for landing a `HarnessEvent` on a run record.

        Stamps a monotonic `seq` on the event as it lands, which the SSE
        stream's `Last-Event-ID` replay uses.

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
        subscribers' iterators always end, failures included.
        """

        if self.event_bus is not None:
            self.event_bus.close(run_id)

    def _inject_tenant_context(
        self, ctx: HarnessContext, prior_messages: list[BaseMessage]
    ) -> list[BaseMessage]:
        """Prepend this tenant's context overlay and system facts.

        The loop's system prompt is the prompt-cache prefix, shared by every
        tenant, so per-tenant context rides in the user turn instead, like
        an invoked skill.
        """

        if self.context_skills is None:
            return prior_messages
        blocks: list[str] = []
        tenant_block = self.context_skills.primer_for(ctx.tenant_id).tenant_block
        if tenant_block:
            blocks.append(f"# System context (tenant)\n{tenant_block}")
        facts = [
            f"- {entry.title}\n  {entry.body}"
            for entry in self.context_skills.facts_for(ctx.tenant_id)
        ]
        if facts:
            blocks.append("# System facts (tenant)\n" + "\n".join(facts))
        if not blocks:
            return prior_messages
        return [SystemMessage(content="\n\n".join(blocks)), *prior_messages]

    async def _inject_skill(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
    ) -> list[BaseMessage]:
        """Prepend an activated skill's body as run guidance.

        When ``request.skill_id`` resolves to a skill the tenant can see,
        its SKILL.md body is injected as a ``SystemMessage`` at the front
        of the conversation. Unknown or bodyless ids are ignored.
        """
        if not request.skill_id or self.context_skills is None:
            return prior_messages
        activated = await self.context_skills.activate_skill_for_run(
            ctx, request.skill_id
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
                "answer. Tool calls keep their own format."
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

    def _restore_evicted(
        self, key: str, snapshot: ConversationHistory | None
    ) -> None:
        """Put back what the store dropped while the model was answering.

        The store can evict this conversation mid-run, and another run can
        recreate the key with a turn of its own. Appending onto either an
        empty history or that partial one loses every earlier turn and its
        tool transcript. The snapshot this run read is the prior context its
        turn belongs after, so it goes back in front.

        Nothing happens in the ordinary case: a history that still starts
        with the snapshot's turns is the one this run read, grown by
        concurrent appends, and re-seeding it would duplicate them.
        """

        if self.conversation_store is None or snapshot is None:
            return
        if not snapshot.turns and not snapshot.summary:
            return
        current = self.conversation_store.get(key)
        if current is not None and (
            list(current.turns[: len(snapshot.turns)]) == list(snapshot.turns)
        ):
            return
        self.conversation_store.seed(
            ConversationHistory(
                conversation_id=key,
                turns=[*snapshot.turns, *(current.turns if current else [])],
                summary=(current.summary if current else None) or snapshot.summary,
            )
        )

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
        self, history: ConversationHistory | None
    ) -> list[BaseMessage]:
        """The seeded history as messages, trimmed to the token budget.

        Each turn replays with its tool calls and results, so the model can
        cite what it ran before. Empty when there is no history.
        """

        if history is None:
            return []
        return to_messages(
            history, max_tokens=self.conversation_tool_token_budget, include_tool_calls=True
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
        # A replay carries text only. Any turn already held here with the same
        # question and answer keeps the tool transcript it was stored with:
        # the reset below would otherwise downgrade turns this replica ran
        # itself, which is the memory loss the replay is meant to repair.
        held = self.conversation_store.get(key)
        # Kept in occurrence order: the same question answered the same way
        # twice can have run different queries, and each replayed turn takes
        # the transcript of the matching turn in the same position.
        transcripts: dict[tuple[str, str], list[tuple[BaseMessage, ...]]] = {}
        for stored in held.turns if held is not None else []:
            transcripts.setdefault(
                (stored.user_message, stored.assistant_answer), []
            ).append(stored.messages)
        self.conversation_store.reset(key)
        for turn in request.conversation_history[-_MAX_SEEDED_TURNS:]:
            matches = transcripts.get((turn.user_message, turn.assistant_answer))
            self.conversation_store.append(
                key,
                ConversationTurn(
                    user_message=turn.user_message,
                    assistant_answer=turn.assistant_answer,
                    messages=matches.pop(0) if matches else (),
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

    def _root_span_kwargs(self, ctx: HarnessContext) -> dict[str, Any]:
        """Langfuse fields for the run's root span."""

        tags: list[str] = [f"tenant:{ctx.tenant_id}"]
        if ctx.model:
            tags.append(f"model:{ctx.model}")
        return {
            "run_id": ctx.run_id,
            "tenant_id": ctx.tenant_id,
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

    async def _run_loop(
        self,
        request: UserRequest,
        ctx: HarnessContext,
        record: HarnessRunRecord,
        progress: Any,
        prior_messages: list[BaseMessage],
    ) -> list[BaseMessage] | None:
        """Run the agent loop; returns the turn transcript for the store."""
        if self.agent_loop is None:
            record.answer = NO_MODEL_ANSWER
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="answer.completed",
                    message="no model configured",
                    data={"length": len(record.answer)},
                )
            )
            return None
        with agent_span("run", **self._root_span_kwargs(ctx)):
            delta = await self.agent_loop.run(
                user_message=request.message,
                ctx=ctx,
                prior_messages=prior_messages,
                progress=progress,
            )
        answer = delta.get("answer") or "(no answer produced by agent loop)"
        record.answer = harden_answer(answer)
        # Business terms the answer could not ground feed the review queue.
        assumptions = extract_assumptions(record.answer)
        for assumption in assumptions:
            emit_grounding_gap(progress, ctx.run_id, assumption)
        record.assumptions = self._stamp_connection(assumptions)
        # `harden_answer` can rewrite what the loop wrote. The stored turn has
        # to end in the answer the user was shown, or the next turn replays a
        # different one.
        return _with_canonical_answer(list(delta.get("messages") or []), record.answer)
