"""Single-agent native tool-calling loop (replaces the agentic seat panel).

Cache layout per request (Anthropic renders tools → system → messages):

    [tools: sorted, static]                      ─┐ cached prefix,
    [system: frozen prompt, cache_control here]  ─┘ breakpoint 1
    [prior turns + this run's growing loop tail]
    [last block: request-time cache_control]      ← breakpoint 2

Invariants (spec 2026-07-02): the prefix is byte-stable per (profile,
registry); dynamic content (skill bodies, JSON-block contracts) rides in
the user turn as <system-reminder> blocks; markers are applied on a COPY at
request time so history never accumulates breakpoints.

Known limit (spec §component 5): the API's cache lookback is 20 content
blocks — a single turn with >8 parallel tool calls could out-run it and
silently miss the tail cache for that request (prefix cache unaffected).
Accepted for v1; revisit if usage_log shows cache_read collapsing on
fan-out turns.
"""

from __future__ import annotations

import copy
import json
import logging
from collections.abc import Callable
from time import monotonic
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    AIMessageChunk,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
    message_chunk_to_message,
)

from miot_harness.agents.chat_models import response_text
from miot_harness.agents.data_fetcher import invoke_step
from miot_harness.agents.freshness_judge import freshness_judge_node
from miot_harness.agents.native_tools import build_native_tools
from miot_harness.config import HarnessSettings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.provenance import ProvenanceLog
from miot_harness.runtime.agent_prompt import (
    build_agent_system_prompt,
    cached_system_message,
    render_skills_index,
)
from miot_harness.runtime.agent_seats import (
    ADVISOR_TOOL,
    DELEGATE_TOOL,
    LoopSeats,
    seat_tool_schemas,
    seats_prompt_block,
)
from miot_harness.runtime.agentic_graph import _provenance_entry
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import instrument_model
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence, DataStep
from miot_harness.runtime.router import HarnessRoute
from miot_harness.runtime.tenancy import tenancy_gate_decision
from miot_harness.runtime.tool import Progress
from miot_harness.tools.registry import ToolRegistry
from miot_harness.utils.truncation import excerpt_for_prompt

logger = logging.getLogger(__name__)

_EPHEMERAL_CACHE = {"type": "ephemeral"}

_LOAD_SKILL_TOOL = "load_skill"

# Static schema — part of the cached tool prefix, so it must not vary with
# the skill set. The available ids live in the system prompt's skills index.
_LOAD_SKILL_SCHEMA = {
    "name": _LOAD_SKILL_TOOL,
    "description": (
        "Load the full playbook body of a skill from the Skills index in "
        "your instructions. Call it BEFORE planning queries for a question "
        "that matches a skill's trigger, then follow the loaded "
        "instructions. Each skill needs loading at most once per "
        "conversation."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "skill_id": {
                "type": "string",
                "description": "Skill id exactly as shown in the Skills index.",
            }
        },
        "required": ["skill_id"],
    },
}

# Text before the first tool call is narration; only past this many chars
# does a turn's text stream as the answer while still being generated.
_NARRATION_HOLD_CHARS = 400
# Room for the `excerpt` note and the JSON envelope around the output.
_EXCERPT_ENVELOPE_CHARS = 120
_MIN_EXCERPT_CHARS = 40

_TURN_CAP_NUDGE = (
    "Turn cap reached. Answer now from the evidence you already collected; "
    "do not call more tools. If the evidence is insufficient, say what is "
    "missing."
)


def _split_prior(
    prior: list[BaseMessage],
) -> tuple[list[BaseMessage], list[str]]:
    """Separate supervisor-injected SystemMessages from real history.

    langchain_anthropic folds every SystemMessage into the single top-level
    `system` param — a per-request skill body appended there would change
    the cached prefix bytes and silently zero the cache. So injected system
    texts are demoted to <system-reminder> blocks in the user turn instead.
    """
    history: list[BaseMessage] = []
    reminders: list[str] = []
    for msg in prior:
        if isinstance(msg, SystemMessage):
            reminders.append(
                msg.content if isinstance(msg.content, str) else json.dumps(msg.content)
            )
        else:
            history.append(msg)
    return history, reminders


def _compose_human(user_message: str, reminders: list[str]) -> HumanMessage:
    if not reminders:
        return HumanMessage(content=user_message)
    blocks = "\n\n".join(
        f"<system-reminder>\n{text}\n</system-reminder>" for text in reminders
    )
    return HumanMessage(content=f"{blocks}\n\n{user_message}")


def _with_tail_marker(messages: list[BaseMessage]) -> list[BaseMessage]:
    """Copy of `messages` with `cache_control` on the last markable block.

    Applied per request; the caller's list is never mutated (asserted by
    tests) so breakpoints can't accumulate past the API's 4-marker cap.
    """
    if not messages:
        return list(messages)
    last = messages[-1]
    marked = _mark_message(last)
    if marked is None:
        return list(messages)
    return [*messages[:-1], marked]


def _mark_message(msg: BaseMessage) -> BaseMessage | None:
    content = msg.content
    if isinstance(content, str):
        blocks: list[Any] = [
            {"type": "text", "text": content, "cache_control": _EPHEMERAL_CACHE}
        ]
    elif isinstance(content, list) and content:
        blocks = copy.deepcopy(content)
        tail = blocks[-1]
        if not isinstance(tail, dict):
            return None
        if tail.get("type") not in ("text", "tool_result", "tool_use"):
            # thinking / redacted blocks are not valid cache anchors — skip
            # marking rather than 400 the request.
            return None
        tail["cache_control"] = _EPHEMERAL_CACHE
    else:
        return None
    return msg.model_copy(update={"content": blocks})


async def _stream_turn(
    model: Any, messages: list[BaseMessage], *, progress: Progress, run_id: str
) -> AIMessage:
    """One model turn, streamed.

    Thinking blocks stream as `thinking.delta`. Text is held up to
    `_NARRATION_HOLD_CHARS`: if the turn ends in tool calls, the held text is
    the narration and goes out once as `thinking.delta`; otherwise it is the
    answer and replays as `answer.delta`. Text past the hold streams as
    `answer.delta` as it arrives and is never re-emitted, even when a tool
    call follows. A turn that emitted any thinking or narration closes with
    `thinking.completed`. Returns the aggregated message, tool calls included.
    """
    agg: AIMessageChunk | None = None
    held: list[str] = []
    held_chars = 0
    streaming = False
    answer_index = 0
    tool_call_seen = False
    thinking_chars = 0
    thinking_index = 0

    def emit_answer(delta: str) -> None:
        nonlocal answer_index
        progress(
            HarnessEvent(
                run_id=run_id,
                type="answer.delta",
                message="",
                data={"agent": "agent_loop", "delta": delta, "index": answer_index},
            )
        )
        answer_index += 1

    async for chunk in model.astream(messages):
        agg = chunk if agg is None else agg + chunk
        if getattr(chunk, "tool_call_chunks", None):
            tool_call_seen = True
        for kind, delta in _chunk_deltas(chunk):
            if kind != "text":
                thinking_chars += len(delta)
                progress(_thinking_delta(run_id, delta, thinking_index))
                thinking_index += 1
                continue
            if streaming:
                if not tool_call_seen:
                    emit_answer(delta)
                continue
            if tool_call_seen or held_chars + len(delta) <= _NARRATION_HOLD_CHARS:
                held.append(delta)
                held_chars += len(delta)
                continue
            for part in held:
                emit_answer(part)
            held.clear()
            streaming = True
            emit_answer(delta)
    if agg is None:
        return AIMessage(content="")
    message = message_chunk_to_message(agg)
    if not isinstance(message, AIMessage):
        return AIMessage(content=response_text(message))
    if message.tool_calls:
        narration = "".join(held).strip()
        if narration:
            thinking_chars += len(narration)
            progress(_thinking_delta(run_id, narration, thinking_index))
    else:
        for part in held:
            emit_answer(part)
    if thinking_chars:
        progress(
            HarnessEvent(
                run_id=run_id,
                type="thinking.completed",
                message="agent_loop thinking done",
                data={
                    "agent": "agent_loop",
                    "tokens": max(1, thinking_chars // 4),
                    "length": thinking_chars,
                },
            )
        )
    return message


def _thinking_delta(run_id: str, delta: str, index: int) -> HarnessEvent:
    return HarnessEvent(
        run_id=run_id,
        type="thinking.delta",
        message="",
        data={"agent": "agent_loop", "delta": delta, "index": index},
    )


def _chunk_deltas(chunk: Any) -> list[tuple[str, str]]:
    """(kind, text) pairs in a streamed chunk; kind is `text` or `thinking`."""
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        return [("text", content)] if content else []
    out: list[tuple[str, str]] = []
    if isinstance(content, list):
        for block in content:
            if not isinstance(block, dict):
                continue
            if block.get("type") == "text" and block.get("text"):
                out.append(("text", str(block["text"])))
            elif block.get("type") == "thinking" and block.get("thinking"):
                out.append(("thinking", str(block["thinking"])))
    return out


class AgentLoopRunner:
    """One cached tool-calling agent for the DATA_AGENTIC route.

    Prefix (system prompt + native tool list) is built ONCE here and never
    varies per request — that is the prompt-cache contract. Per-request
    dynamics (user-invoked skill bodies, JSON-block contract) arrive via
    prior_messages and are demoted into the user turn by
    _split_prior/_compose_human. Model-pulled skills are the lazy variant:
    the frozen prefix carries only the one-line index, and `load_skill`
    returns the body mid-transcript as a tool result.
    """

    def __init__(
        self,
        *,
        model: BaseChatModel,
        registry: ToolRegistry,
        settings: HarnessSettings,
        profile: DataSourceProfile,
        provenance_log: ProvenanceLog | None = None,
        context_skills: ContextSkillsBundle | None = None,
        seats: LoopSeats | None = None,
    ) -> None:
        self.registry = registry
        self.settings = settings
        self.profile = profile
        self.provenance_log = provenance_log
        self.context_skills = context_skills
        self.seats = seats
        skills_index = render_skills_index(context_skills, profile)
        self.native_tools = build_native_tools(registry, profile=profile)
        extras = seat_tool_schemas(seats)
        if skills_index:
            extras.append(_LOAD_SKILL_SCHEMA)
        if extras:
            # Re-sort so the tool list stays deterministically ordered — the
            # same byte-stability contract build_native_tools guarantees.
            self.native_tools = sorted(
                [*self.native_tools, *extras],
                key=lambda t: t["name"],
            )
        self.system_message = cached_system_message(
            build_agent_system_prompt(
                profile, skills_index=skills_index, seats_block=seats_prompt_block(seats)
            )
        )
        # Bind once — adding/removing/reordering tools mid-conversation
        # invalidates the whole cache (tools render at position 0).
        self.bound_model = model.bind_tools(self.native_tools)

    async def run(
        self,
        *,
        user_message: str,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
        progress: Progress,
    ) -> dict[str, Any]:
        decision = tenancy_gate_decision(
            ctx=ctx,
            route=HarnessRoute.DATA_AGENTIC,
            settings=self.settings,
            profile=self.profile,
        )
        if not decision.allowed:
            return {
                "answer": decision.refusal_message,
                "evidence": [],
                "usage_log": [],
            }

        model = instrument_model(
            self.bound_model,  # type: ignore[arg-type]  # RunnableBinding also has .with_config
            "agent_loop",
            ctx,
            progress=progress,
            span_prefix=self.profile.name,
        )
        history, reminders = _split_prior(prior_messages)
        messages: list[BaseMessage] = [
            self.system_message,
            *history,
            _compose_human(user_message, reminders),
        ]
        evidence: list[DataEvidence] = []
        usage_log: list[dict[str, Any]] = []
        loaded_skills: set[str] = set()
        consults = 0
        answer: str | None = None
        max_turns = self.settings.agents_agentic_max_turns

        for turn in range(max_turns + 1):
            capped = turn >= max_turns
            if capped:
                messages.append(HumanMessage(content=_TURN_CAP_NUDGE))
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="agent.started",
                    message="Entering agent_loop turn",
                    data={"agent": "agent_loop", "graph": "agent_loop", "turn": turn},
                )
            )
            start = monotonic()
            response = await _stream_turn(
                model, _with_tail_marker(messages), progress=progress, run_id=ctx.run_id
            )
            usage_log.append(dict(getattr(response, "usage_metadata", None) or {}))
            messages.append(response)
            tool_calls = list(getattr(response, "tool_calls", None) or [])
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="agent.completed",
                    message="Completed agent_loop turn",
                    data={
                        "agent": "agent_loop",
                        "graph": "agent_loop",
                        "turn": turn,
                        "duration_ms": int((monotonic() - start) * 1000),
                        "exit_reason": "tool_calls" if tool_calls else "answer",
                    },
                )
            )
            if not tool_calls or capped:
                answer = response_text(response).strip()
                break
            delegations: list[dict[str, Any]] = []
            for call in tool_calls:
                name = call.get("name")
                if name == _LOAD_SKILL_TOOL:
                    messages.append(
                        self._load_skill(
                            call, ctx=ctx, loaded_skills=loaded_skills,
                            progress=progress,
                        )
                    )
                    continue
                advisor = self.seats.advisor if self.seats is not None else None
                if name == ADVISOR_TOOL and advisor is not None:
                    consults += 1
                    messages.append(
                        await advisor.consult(
                            call, ctx=ctx, consult=consults, progress=progress
                        )
                    )
                    continue
                workhorse = self.seats.workhorse if self.seats is not None else None
                if name == DELEGATE_TOOL and workhorse is not None:
                    delegations.append(call)
                    continue
                messages.append(
                    await self._execute_tool_call(
                        call, ctx=ctx, user_message=user_message,
                        evidence=evidence, progress=progress,
                    )
                )
            if delegations and self.seats is not None and self.seats.workhorse is not None:
                for msg, found in await self.seats.workhorse.delegate_all(
                    delegations, ctx=ctx, progress=progress
                ):
                    messages.append(msg)
                    evidence.extend(found)

        if not answer:
            answer = (
                "The investigation could not produce an answer within the "
                "turn limit."
            )
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="answer.completed",
                message="Agent loop answered",
                data={"length": len(answer), "turns": len(usage_log)},
            )
        )
        return {"answer": answer, "evidence": evidence, "usage_log": usage_log}

    async def _execute_tool_call(
        self,
        call: dict[str, Any],
        *,
        ctx: HarnessContext,
        user_message: str,
        evidence: list[DataEvidence],
        progress: Progress,
    ) -> ToolMessage:
        step = DataStep(
            intent=str(call.get("name", "")),
            tool=str(call.get("name", "")),
            args=dict(call.get("args") or {}),
            rationale="agent_loop",
        )
        call_id = str(call.get("id", ""))
        delta = await invoke_step(
            step,
            ctx=ctx,
            registry=self.registry,
            settings=self.settings,
            progress=progress,
            profile=self.profile,
        )
        if "failure" in delta:
            # Feedback, not a dead end: the model sees the error and adapts
            # (retry with fixed args, another tool, or answer without it).
            return ToolMessage(
                content=json.dumps({"error": delta["failure"]}, default=str),
                tool_call_id=call_id,
                status="error",
            )
        ev: DataEvidence = delta["evidence"][0]
        evidence.append(ev)
        # Deterministic freshness classification (emits freshness.warning).
        # REFUSE-zone `failure` is intentionally dropped — agentic parity:
        # the evidence is already stamped stale and the system prompt makes
        # the answer caveat it (see runtime/agentic_graph.freshness_judge).
        freshness_judge_node(
            {"ctx": ctx, "evidence": evidence},
            settings=self.settings,
            progress=progress,
            profile=self.profile,
        )
        if self.provenance_log is not None:
            self.provenance_log.append(
                _provenance_entry(
                    ctx=ctx, user_message=user_message, step=step, evidence=ev
                )
            )
        return ToolMessage(
            content=self._render_tool_result(ev), tool_call_id=call_id
        )

    def _load_skill(
        self,
        call: dict[str, Any],
        *,
        ctx: HarnessContext,
        loaded_skills: set[str],
        progress: Progress,
    ) -> ToolMessage:
        """Return a skill's playbook body as a tool result.

        Handled outside invoke_step on purpose: a skill body is guidance,
        not data — it must not become DataEvidence, be freshness-judged, or
        land in the provenance log. Resolution uses the requesting tenant so
        tenant-scoped overrides apply even though the advertised index was
        resolved against the profile's tenant_lock at boot, and re-applies
        this profile's connection filter so a guessed id cannot pull a
        playbook the index never offered.
        """
        call_id = str(call.get("id", ""))
        skill_id = str((call.get("args") or {}).get("skill_id", "")).strip()
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.started",
                message=f"Starting {_LOAD_SKILL_TOOL}",
                data={
                    "tool": _LOAD_SKILL_TOOL,
                    "source": "skills",
                    "input_keys": ["skill_id"],
                    "skill_id": skill_id,
                },
            )
        )
        if skill_id in loaded_skills:
            # Token guard: the body is already in the transcript; a short
            # pointer beats re-sending it.
            return self._skill_result(
                ctx, call_id, skill_id,
                f"Skill '{skill_id}' is already loaded in this conversation; "
                "follow the instructions you already received.",
                progress=progress, loaded=False,
            )
        activated = (
            self.context_skills.activate_skill(
                ctx.tenant_id, skill_id, connection=self.profile.name
            )
            if self.context_skills is not None
            else None
        )
        if activated is None:
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="tool.failed",
                    message=f"Tool {_LOAD_SKILL_TOOL} failed",
                    data={
                        "tool": _LOAD_SKILL_TOOL,
                        "error": f"unknown skill: {skill_id}",
                        "error_type": "SkillNotFound",
                        "reason": f"unknown skill: {skill_id}",
                    },
                )
            )
            return ToolMessage(
                content=json.dumps(
                    {
                        "error": (
                            f"Unknown or bodyless skill '{skill_id}'. Use an "
                            "id from the Skills index exactly as written."
                        )
                    }
                ),
                tool_call_id=call_id,
                status="error",
            )
        loaded_skills.add(skill_id)
        name, body = activated
        return self._skill_result(
            ctx, call_id, skill_id, f"# Skill: {name}\n\n{body}",
            progress=progress, loaded=True,
        )

    def _skill_result(
        self,
        ctx: HarnessContext,
        call_id: str,
        skill_id: str,
        content: str,
        *,
        progress: Progress,
        loaded: bool,
    ) -> ToolMessage:
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="tool.completed",
                message=f"Completed {_LOAD_SKILL_TOOL}",
                data={
                    "tool": _LOAD_SKILL_TOOL,
                    "skill_id": skill_id,
                    "loaded": loaded,
                    "result_shape": {"type": "str", "length": len(content)},
                },
            )
        )
        return ToolMessage(content=content, tool_call_id=call_id)

    def _render_tool_result(self, ev: DataEvidence) -> str:
        """The tool output as the model sees it: an excerpt plus what it hides.

        `rows_returned` and `total` are exact; the excerpt shows at most five
        rows and says so, so the model never reads a display cut as a short
        result. The whole message is valid JSON and never longer than
        `agents_agent_loop_tool_result_max_chars`.
        """
        header: dict[str, Any] = {
            "tool": ev.tool,
            "source": ev.source,
            "rows_returned": ev.sample_size,
            "refreshed_at": ev.refreshed_at,
            "is_stale": ev.is_stale,
            "freshness_status": ev.freshness_status,
            "is_sample": ev.is_sample,
            "executed_sql": ev.executed_sql,
        }
        cap = self.settings.agents_agent_loop_tool_result_max_chars
        budget = cap - len(json.dumps(header, default=str)) - _EXCERPT_ENVELOPE_CHARS
        for _ in range(3):
            if budget < _MIN_EXCERPT_CHARS:
                break
            excerpt, note = excerpt_for_prompt(ev.output, budget)
            try:
                output: Any = json.loads(excerpt)
            except ValueError:
                # A char cut leaves a JSON fragment; carry it as a string.
                output = excerpt
            payload = {**header, **({"excerpt": note} if note else {}), "output": output}
            text = json.dumps(payload, default=str)
            if len(text) <= cap:
                return text
            budget -= len(text) - cap
        # Compact valid envelope: fits any cap the setting allows.
        return json.dumps(
            {
                "tool": ev.tool[:64],
                "rows_returned": ev.sample_size,
                "excerpt": "omitted: tool result cap too small",
                "output": None,
            }
        )


class AgentLoopRunners:
    """One `AgentLoopRunner` per conversation model, built on first use.

    Each runner binds its own model and freezes its own prompt-cache prefix.
    `run` dispatches on `ctx.model`; an unknown model is refused here as well
    as at the API, so a direct caller cannot bypass the allowlist.
    """

    def __init__(
        self,
        *,
        default_model: str,
        models: tuple[str, ...] | list[str],
        build_model: Callable[[str], BaseChatModel],
        registry: ToolRegistry,
        settings: HarnessSettings,
        profile: DataSourceProfile,
        provenance_log: ProvenanceLog | None = None,
        context_skills: ContextSkillsBundle | None = None,
        seats: LoopSeats | None = None,
    ) -> None:
        self.default_model = default_model
        self.models = tuple(dict.fromkeys([default_model, *models]))
        self._build_model = build_model
        self._kwargs: dict[str, Any] = {
            "registry": registry,
            "settings": settings,
            "profile": profile,
            "provenance_log": provenance_log,
            "context_skills": context_skills,
            "seats": seats,
        }
        self._runners: dict[str, AgentLoopRunner] = {}

    def allowed(self, model: str | None) -> bool:
        return model is None or model in self.models

    def runner_for(self, model: str | None) -> AgentLoopRunner:
        name = model or self.default_model
        if name not in self.models:
            raise ValueError(f"model {name!r} is not in the agent loop allowlist")
        runner = self._runners.get(name)
        if runner is None:
            runner = AgentLoopRunner(model=self._build_model(name), **self._kwargs)
            self._runners[name] = runner
        return runner

    async def run(
        self,
        *,
        user_message: str,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
        progress: Progress,
    ) -> dict[str, Any]:
        runner = self.runner_for(ctx.model)
        return await runner.run(
            user_message=user_message,
            ctx=ctx,
            prior_messages=prior_messages,
            progress=progress,
        )
