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

The reminders open the conversation's first user message, not the latest
one. The history replays each user message as the user wrote it, so
reminders on the latest message would make the previous run's request
differ from this one at that message, and the cached history would be lost
on every run. At the front they read the same on every run, and a third
breakpoint after them lets a new conversation of the same tenant and skill
reuse them.

Known limit (spec §component 5): the API's cache lookback is 20 content
blocks — a single turn with >8 parallel tool calls could out-run it and
silently miss the tail cache for that request (prefix cache unaffected).
Accepted for v1; revisit if usage_log shows cache_read collapsing on
fan-out turns.
"""

from __future__ import annotations

import asyncio
import copy
import json
import logging
from collections.abc import Callable, Sequence
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
from langchain_core.messages.utils import count_tokens_approximately

from miot_harness.agents.chat_models import response_text
from miot_harness.agents.context_windows import context_window
from miot_harness.agents.model_providers import Provider, ProviderRegistry, is_anthropic
from miot_harness.agents.native_tools import build_native_tools
from miot_harness.config import HarnessSettings
from miot_harness.context_skills.registry import ContextSkillsBundle
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.provenance import ProvenanceEntry, ProvenanceLog
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
from miot_harness.runtime.attachments import Attachment, content_block, with_markers
from miot_harness.runtime.context import HarnessContext, RunEffort
from miot_harness.runtime.event_payload import args_payload, preview_payload
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.evidence import DataEvidence, DataStep
from miot_harness.runtime.freshness import judge_freshness
from miot_harness.runtime.instrumentation import instrument_model
from miot_harness.runtime.permissions import PermissionDecision
from miot_harness.runtime.tool import Progress
from miot_harness.runtime.tool_step import invoke_step
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
# Same ratio `count_tokens_approximately` uses.
_CHARS_PER_TOKEN = 4

_CLEARED_NOTE = "Result removed to free context. Call the tool again if you need the rows."

# Never cleared: a skill is loaded once per conversation and cannot be
# loaded again, and advice and delegated findings are short.
_KEPT_TOOLS = frozenset({_LOAD_SKILL_TOOL, ADVISOR_TOOL, DELEGATE_TOOL})

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


def _compose_human(
    user_message: str,
    attachments: Sequence[Attachment] = (),
) -> HumanMessage:
    if not attachments:
        return HumanMessage(content=user_message)
    # Files first and the text last, so the tail cache marker lands on text.
    # A message that is only files has no text block: the API rejects an
    # empty one.
    content: list[str | dict[str, Any]] = [content_block(a) for a in attachments]
    if user_message:
        content.append({"type": "text", "text": user_message})
    return HumanMessage(content=content)


def _reminder_block(reminders: list[str], *, cache: bool) -> dict[str, Any]:
    wrapped = "\n\n".join(f"<system-reminder>\n{r}\n</system-reminder>" for r in reminders)
    block: dict[str, Any] = {"type": "text", "text": f"{wrapped}\n\n"}
    if cache:
        block["cache_control"] = _EPHEMERAL_CACHE
    return block


def _lead_with_reminders(
    messages: list[BaseMessage], reminders: list[str], *, cache: bool
) -> list[BaseMessage]:
    """`messages` with the reminders in front of the first user message.

    `messages` is the history plus this turn's user message, so there is
    always one. The message is copied; the history's own stays as stored.
    """
    if not reminders:
        return list(messages)
    first = next(i for i, msg in enumerate(messages) if isinstance(msg, HumanMessage))
    msg = messages[first]
    content = msg.content
    if isinstance(content, str):
        blocks: list[Any] = [{"type": "text", "text": content}] if content else []
    else:
        blocks = list(content)
    lead = msg.model_copy(update={"content": [_reminder_block(reminders, cache=cache), *blocks]})
    return [*messages[:first], lead, *messages[first + 1 :]]


def _turn_transcript(
    messages: list[BaseMessage], *, user_message: str, history_len: int
) -> list[BaseMessage]:
    """The turn as the next turn should see it.

    `messages` is [system, *history, composed_human, ...turn]. The system
    message and the prior history are already held elsewhere, and the
    composed human may carry the <system-reminder> blocks, which the next
    run adds again, so it is swapped for the plain user message. The
    turn-cap nudge is dropped for the same reason.

    A tool call left unanswered goes with them. The turn cap breaks the loop
    on the model's reply whether or not that reply asked for more tools, so
    the last message can carry a tool_use that no tool_result follows — which
    the API rejects on the next request.
    """
    turn = [
        msg
        for msg in messages[history_len + 2 :]
        if not (isinstance(msg, HumanMessage) and msg.content == _TURN_CAP_NUDGE)
    ]
    answered = {msg.tool_call_id for msg in turn if isinstance(msg, ToolMessage)}
    kept: list[BaseMessage] = []
    for msg in turn:
        if not isinstance(msg, AIMessage):
            kept.append(msg)
            continue
        storable = _storable(msg, answered)
        if storable is not None:
            kept.append(storable)
    return [HumanMessage(content=user_message), *kept]


def _storable(msg: AIMessage, answered: set[str]) -> AIMessage | None:
    """`msg` as the next turn may replay it, or None if nothing is left.

    Two kinds of block go. A tool call no tool result answered: a streamed
    Anthropic reply carries its calls both in `tool_calls` and as `tool_use`
    blocks, and replaying one the API finds no `tool_result` for is rejected.
    And every thinking block: they are signed by the model that produced them,
    while the conversation model is chosen per run, so a later turn on another
    model would replay a signature that is not its own. The streamed
    `reasoning_content` of OpenAI-compatible providers goes for the same reason.

    None when only thinking blocks remain, or nothing does. An assistant
    message with no text and no call is an empty turn, also rejected.
    """
    calls = [c for c in msg.tool_calls if c.get("id") in answered]
    content = msg.content
    if isinstance(content, list):
        content = [block for block in content if not _is_dropped_block(block, answered)]
    if not calls and not content:
        return None
    dropped = isinstance(msg.content, list) and len(content) != len(msg.content)
    reasoned = "reasoning_content" in msg.additional_kwargs
    if len(calls) == len(msg.tool_calls) and not dropped and not reasoned:
        return msg
    kwargs = {k: v for k, v in msg.additional_kwargs.items() if k != "reasoning_content"}
    return msg.model_copy(
        update={"tool_calls": calls, "content": content, "additional_kwargs": kwargs}
    )


def _is_dropped_block(block: Any, answered: set[str]) -> bool:
    if not isinstance(block, dict):
        return False
    kind = block.get("type")
    if kind in ("thinking", "redacted_thinking"):
        return True
    return kind == "tool_use" and block.get("id") not in answered


def clear_old_tool_results(
    messages: list[BaseMessage], *, keep: int
) -> tuple[list[BaseMessage], int]:
    """`messages` with every tool result but the newest `keep` cut to a stub.

    A data result keeps its header (tool, row counts, the SQL it ran) and
    loses its rows, so the model still knows what it ran and can run it
    again. Any other result becomes a one-line note. Results already cut,
    errors, and the results of `_KEPT_TOOLS` are left as they are and do not
    count toward `keep`. Returns a new list and how many results were cut;
    the messages in the input list are not modified.
    """
    names = {
        call.get("id"): call.get("name")
        for msg in messages
        if isinstance(msg, AIMessage)
        for call in msg.tool_calls
    }
    stubs: list[tuple[int, str]] = []
    for i, msg in enumerate(messages):
        if not isinstance(msg, ToolMessage) or msg.status == "error":
            continue
        if names.get(msg.tool_call_id) in _KEPT_TOOLS:
            continue
        stub = _cleared_result(msg.content)
        if stub is not None:
            stubs.append((i, stub))
    out = list(messages)
    old = stubs[: max(0, len(stubs) - keep)]
    for i, stub in old:
        out[i] = out[i].model_copy(update={"content": stub})
    return out, len(old)


def _cleared_result(content: Any) -> str | None:
    """The stub for one tool result, or None when it is already one."""
    text = content if isinstance(content, str) else json.dumps(content, default=str)
    try:
        payload = json.loads(text)
    except ValueError:
        payload = None
    if isinstance(payload, dict):
        if payload.get("cleared"):
            return None
        if "error" in payload:
            return None
        header = {k: v for k, v in payload.items() if k not in ("output", "excerpt")}
        return json.dumps({**header, "cleared": _CLEARED_NOTE}, default=str)
    return json.dumps({"cleared": _CLEARED_NOTE, "length": len(text)})


def _calibrated(start: dict[str, int], usage: dict[str, Any]) -> dict[str, int]:
    """`start` scaled to the provider's count for the first request.

    The estimates run at four characters a token, which undercounts JSON
    schemas and non-English text by a third or more. Left as they are, the
    shortfall shows up as `run` on a turn that has added nothing yet.
    """
    reported = int(usage.get("input_tokens") or 0)
    estimated = sum(start.values())
    if not reported or not estimated:
        return start
    parts = {k: v * reported // estimated for k, v in start.items()}
    parts["message"] += reported - sum(parts.values())
    return parts


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


def _plain_messages(messages: list[BaseMessage]) -> list[BaseMessage]:
    """`messages` with list content flattened to its text, for providers that
    only take text content. Tool calls stay on the message; thinking blocks
    and cache markers, which only Anthropic accepts, are dropped."""
    out: list[BaseMessage] = []
    for msg in messages:
        if isinstance(msg, HumanMessage) and _has_media(msg.content):
            blocks = [
                {k: v for k, v in b.items() if k != "cache_control"}
                for b in msg.content
                if isinstance(b, dict) and b.get("type") in _PLAIN_KEPT_BLOCKS
            ]
            msg = msg.model_copy(update={"content": blocks})
        elif isinstance(msg.content, list):
            text = "".join(
                str(b.get("text", ""))
                for b in msg.content
                if isinstance(b, dict) and b.get("type") == "text"
            )
            msg = msg.model_copy(update={"content": text})
        out.append(msg)
    return out


_PLAIN_KEPT_BLOCKS = frozenset({"text", "image", "file"})


def _has_media(content: Any) -> bool:
    return isinstance(content, list) and any(
        isinstance(b, dict) and b.get("type") in ("image", "file") for b in content
    )


def _mark_message(msg: BaseMessage) -> BaseMessage | None:
    content = msg.content
    if isinstance(content, str):
        blocks: list[Any] = [{"type": "text", "text": content, "cache_control": _EPHEMERAL_CACHE}]
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
) -> tuple[AIMessage, float | None]:
    """One model turn, streamed.

    Thinking blocks stream as `thinking.delta`. Text is held up to
    `_NARRATION_HOLD_CHARS`: if the turn ends in tool calls, the held text is
    the narration and goes out once as `thinking.delta`; otherwise it is the
    answer and replays as `answer.delta`. Text past the hold streams as
    `answer.delta` as it arrives and is never re-emitted, even when a tool
    call follows. A turn that emitted any thinking or narration closes with
    `thinking.completed`. Returns the aggregated message, tool calls included,
    and the `monotonic()` time the first chunk arrived (None if none did).
    """
    agg: AIMessageChunk | None = None
    held: list[str] = []
    held_chars = 0
    streaming = False
    answer_index = 0
    tool_call_seen = False
    thinking_chars = 0
    thinking_index = 0
    first_chunk_at: float | None = None
    call_parts: dict[tuple[Any, str], str] = {}

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
        if first_chunk_at is None:
            first_chunk_at = monotonic()
        if getattr(chunk, "tool_call_chunks", None):
            tool_call_seen = True
            chunk = _without_repeated_call_parts(chunk, call_parts)
        agg = chunk if agg is None else agg + chunk
        for kind, delta in _chunk_deltas(chunk):
            if kind != "text":
                thinking_chars += len(delta)
                progress(_thinking_delta(run_id, delta, thinking_index))
                thinking_index += 1
                continue
            if streaming:
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
        return AIMessage(content=""), first_chunk_at
    message = message_chunk_to_message(agg)
    if not isinstance(message, AIMessage):
        return AIMessage(content=response_text(message)), first_chunk_at
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
    return message, first_chunk_at


def _without_repeated_call_parts(chunk: Any, seen: dict[tuple[Any, str], str]) -> Any:
    """`chunk` without a tool name or id that repeats what its call has so far.

    Some OpenAI-compatible gateways send the whole name and id in every chunk
    of a call; merged as they come, `gps_query` becomes `gps_querygps_query`.
    `seen` holds each call's name and id so far, keyed by (index, field).
    """
    parts = []
    for part in chunk.tool_call_chunks:
        part = dict(part)
        for field in ("name", "id"):
            value = part.get(field)
            if not value:
                continue
            key = (part.get("index"), field)
            if seen.get(key) == value:
                part[field] = None
            else:
                seen[key] = seen.get(key, "") + value
        parts.append(part)
    return chunk.model_copy(update={"tool_call_chunks": parts})


def _thinking_delta(run_id: str, delta: str, index: int) -> HarnessEvent:
    return HarnessEvent(
        run_id=run_id,
        type="thinking.delta",
        message="",
        data={"agent": "agent_loop", "delta": delta, "index": index},
    )


def _chunk_deltas(chunk: Any) -> list[tuple[str, str]]:
    """(kind, text) pairs in a streamed chunk; kind is `text` or `thinking`.

    OpenAI-compatible providers stream reasoning as `reasoning_content`, which
    ChatDeepSeek keeps in `additional_kwargs`.
    """
    out: list[tuple[str, str]] = []
    reasoning = (getattr(chunk, "additional_kwargs", None) or {}).get("reasoning_content")
    if isinstance(reasoning, str) and reasoning:
        out.append(("thinking", reasoning))
    content = getattr(chunk, "content", None)
    if isinstance(content, str):
        if content:
            out.append(("text", content))
    elif isinstance(content, list):
        out.extend(d for d in map(_block_delta, content) if d is not None)
    return out


def _block_delta(block: Any) -> tuple[str, str] | None:
    if not isinstance(block, dict):
        return None
    kind = block.get("type")
    if kind == "text" and block.get("text"):
        return ("text", str(block["text"]))
    if kind == "thinking" and block.get("thinking"):
        return ("thinking", str(block["thinking"]))
    return None


def _step(call: dict[str, Any]) -> DataStep:
    return DataStep(
        intent=str(call.get("name", "")),
        tool=str(call.get("name", "")),
        args=dict(call.get("args") or {}),
        rationale="agent_loop",
    )


def _provenance_entry(
    *,
    ctx: HarnessContext,
    user_message: str,
    step: DataStep,
    evidence: DataEvidence,
) -> ProvenanceEntry:
    """One (question, sql) row for the provenance log.

    Safe-query tools report the SQL they ran; curated tools do not, so the
    `tool(args)` call stands in for it.
    """
    sql = (
        evidence.executed_sql
        or evidence.output.get("sql")
        or f"{step.tool}({json.dumps(step.args, default=str)})"
    )
    plan_cost = evidence.output.get("total_cost")
    return ProvenanceEntry(
        question=user_message,
        sql=str(sql),
        plan_cost=float(plan_cost) if isinstance(plan_cost, (int, float)) else 0.0,
        rows_returned=evidence.sample_size,
        refreshed_at=evidence.refreshed_at,
        run_id=ctx.run_id,
        tenant_id=ctx.tenant_id,
    )


class AgentLoopRunner:
    """One cached tool-calling agent: the model a run talks to.

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
        anthropic_format: bool = True,
        model_name: str = "",
        trainer: bool = False,
    ) -> None:
        self.registry = registry
        self.model_name = model_name
        self.context_window = context_window(
            model_name,
            overrides=settings.agents_context_windows,
            default=settings.agents_context_window_default,
        )
        # Anthropic takes content blocks with cache markers; the other
        # providers take plain text.
        self.anthropic_format = anthropic_format
        self.settings = settings
        self.profile = profile
        self.provenance_log = provenance_log
        self.context_skills = context_skills
        self.seats = seats
        skills_index = render_skills_index(context_skills, profile)
        self.native_tools = build_native_tools(registry, profile=profile, trainer=trainer)
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
        system_text = build_agent_system_prompt(
            profile, skills_index=skills_index, seats_block=seats_prompt_block(seats)
        )
        self.system_message: SystemMessage = (
            cached_system_message(system_text)
            if anthropic_format
            else SystemMessage(content=system_text)
        )
        # Bind once — adding/removing/reordering tools mid-conversation
        # invalidates the whole cache (tools render at position 0).
        self.bound_model = model.bind_tools(self.native_tools)
        self._prefix_tokens = {
            "system": count_tokens_approximately([self.system_message]),
            "tools": len(json.dumps(self.native_tools)) // _CHARS_PER_TOKEN,
        }

    async def run(
        self,
        *,
        user_message: str,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
        progress: Progress,
    ) -> dict[str, Any]:
        model = instrument_model(
            self.bound_model,  # type: ignore[arg-type]  # RunnableBinding also has .with_config
            "agent_loop",
            ctx,
            progress=progress,
            span_prefix=self.profile.name,
        )
        history, reminders = _split_prior(prior_messages)
        if ctx.data_refusal:
            reminders.append(
                "The datasource tools are not available to this organization and "
                f"will refuse: {ctx.data_refusal} Answer without them."
            )
        conversation = _lead_with_reminders(
            [*history, _compose_human(user_message, ctx.attachments)],
            reminders,
            cache=self.anthropic_format,
        )
        messages: list[BaseMessage] = [self.system_message, *conversation]
        history_tokens = count_tokens_approximately(history) if history else 0
        start_tokens = {
            **self._prefix_tokens,
            "history": history_tokens,
            "message": count_tokens_approximately(conversation) - history_tokens,
        }
        context: dict[str, Any] = {}
        evidence: list[DataEvidence] = []
        usage_log: list[dict[str, Any]] = []
        loaded_skills: set[str] = set()
        consults = 0
        answer: str | None = None
        max_turns = self.settings.agents_agent_loop_max_turns

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
            cleared = 0
            clear_at = self.settings.agents_agent_loop_clear_at_ratio
            if self._projected_ratio(context, messages) > clear_at:
                messages, cleared = clear_old_tool_results(
                    messages, keep=self.settings.agents_agent_loop_clear_keep_results
                )
            start = monotonic()
            response, first_chunk_at = await _stream_turn(
                model, self._prepare(messages), progress=progress, run_id=ctx.run_id
            )
            usage_log.append(dict(getattr(response, "usage_metadata", None) or {}))
            messages.append(response)
            if turn == 0:
                start_tokens = _calibrated(start_tokens, usage_log[0])
            context = self._context_usage(start_tokens, usage_log[-1], messages)
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="context.usage",
                    message="",
                    data={
                        "agent": "agent_loop",
                        "turn": turn,
                        "cleared_tool_results": cleared,
                        **context,
                    },
                )
            )
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
                        "first_token_ms": (
                            int((first_chunk_at - start) * 1000)
                            if first_chunk_at is not None
                            else None
                        ),
                        "exit_reason": "tool_calls" if tool_calls else "answer",
                    },
                )
            )
            if not tool_calls or capped:
                answer = response_text(response).strip()
                break
            delegations: list[dict[str, Any]] = []
            batch: list[dict[str, Any]] = []
            for call in tool_calls:
                name = call.get("name")
                if self._runs_concurrently(str(name), ctx):
                    batch.append(call)
                    continue
                if batch:
                    messages.extend(
                        await self._run_batch(
                            batch,
                            ctx=ctx,
                            user_message=user_message,
                            evidence=evidence,
                            progress=progress,
                        )
                    )
                    batch = []
                if name == _LOAD_SKILL_TOOL:
                    messages.append(
                        await self._load_skill(
                            call,
                            ctx=ctx,
                            loaded_skills=loaded_skills,
                            progress=progress,
                        )
                    )
                    continue
                advisor = self.seats.advisor if self.seats is not None else None
                if name == ADVISOR_TOOL and advisor is not None:
                    consults += 1
                    messages.append(
                        await advisor.consult(call, ctx=ctx, consult=consults, progress=progress)
                    )
                    continue
                workhorse = self.seats.workhorse if self.seats is not None else None
                if name == DELEGATE_TOOL and workhorse is not None:
                    delegations.append(call)
                    continue
                if self._is_utility_tool(str(name)):
                    messages.append(await self._run_utility(call, ctx=ctx, progress=progress))
                    continue
                messages.append(
                    await self._execute_tool_call(
                        call,
                        ctx=ctx,
                        user_message=user_message,
                        evidence=evidence,
                        progress=progress,
                    )
                )
            if batch:
                messages.extend(
                    await self._run_batch(
                        batch,
                        ctx=ctx,
                        user_message=user_message,
                        evidence=evidence,
                        progress=progress,
                    )
                )
            if delegations and self.seats is not None and self.seats.workhorse is not None:
                for msg, found in await self.seats.workhorse.delegate_all(
                    delegations, ctx=ctx, progress=progress
                ):
                    messages.append(msg)
                    evidence.extend(found)

        if not answer:
            answer = "The investigation could not produce an answer within the turn limit."
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="answer.completed",
                message="Agent loop answered",
                data={"length": len(answer), "turns": len(usage_log)},
            )
        )
        return {
            "answer": answer,
            "evidence": evidence,
            "usage_log": usage_log,
            "context": context,
            "messages": _turn_transcript(
                messages,
                user_message=with_markers(user_message, ctx.attachments),
                history_len=len(history),
            ),
        }

    def _runs_concurrently(self, name: str, ctx: HarnessContext) -> bool:
        """Whether a call may run alongside the others of its turn: a registry
        tool that is read-only, not destructive and not named by a rule that
        could deny it or ask for approval. Read-only tools are allowed
        without approval, so these calls never pause for a human."""
        if self.settings.agents_agent_loop_tool_concurrency <= 1:
            return False
        if name in (_LOAD_SKILL_TOOL, ADVISOR_TOOL, DELEGATE_TOOL):
            return False
        if name not in self.registry.names():
            return False
        tool = self.registry.get(name)
        if not tool.read_only or tool.destructive:
            return False
        if tool.kind != "utility" and not self._is_data_tool(name):
            return False
        policy = ctx.permission_policy
        rules = policy.rules if policy is not None else []
        return not any(r.tool == name and r.decision != PermissionDecision.ALLOW for r in rules)

    async def _run_batch(
        self,
        calls: list[dict[str, Any]],
        *,
        ctx: HarnessContext,
        user_message: str,
        evidence: list[DataEvidence],
        progress: Progress,
    ) -> list[ToolMessage]:
        """Run read-only calls at the same time, up to the concurrency cap.
        Results, evidence and provenance keep the order of the calls."""
        limit = asyncio.Semaphore(self.settings.agents_agent_loop_tool_concurrency)

        async def run(call: dict[str, Any]) -> ToolMessage | DataEvidence:
            async with limit:
                if self._is_utility_tool(str(call.get("name"))):
                    return await self._run_utility(call, ctx=ctx, progress=progress)
                return await self._invoke_data_tool(call, ctx=ctx, progress=progress)

        outcomes = await asyncio.gather(*(run(call) for call in calls))
        return [
            outcome
            if isinstance(outcome, ToolMessage)
            else self._record_evidence(
                call,
                outcome,
                ctx=ctx,
                user_message=user_message,
                evidence=evidence,
                progress=progress,
            )
            for call, outcome in zip(calls, outcomes, strict=True)
        ]

    async def _execute_tool_call(
        self,
        call: dict[str, Any],
        *,
        ctx: HarnessContext,
        user_message: str,
        evidence: list[DataEvidence],
        progress: Progress,
    ) -> ToolMessage:
        outcome = await self._invoke_data_tool(call, ctx=ctx, progress=progress)
        if isinstance(outcome, ToolMessage):
            return outcome
        return self._record_evidence(
            call,
            outcome,
            ctx=ctx,
            user_message=user_message,
            evidence=evidence,
            progress=progress,
        )

    async def _invoke_data_tool(
        self, call: dict[str, Any], *, ctx: HarnessContext, progress: Progress
    ) -> ToolMessage | DataEvidence:
        """The call's evidence, or the error result the model sees."""
        step = _step(call)
        call_id = str(call.get("id", ""))
        if ctx.data_refusal and self._is_data_tool(step.tool):
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="tool.failed",
                    message=f"Tool {step.tool} failed",
                    data={
                        "tool": step.tool,
                        "error": ctx.data_refusal,
                        "error_type": "TenantRefused",
                        "reason": ctx.data_refusal,
                        "ok": False,
                        "duration_ms": 0,
                        **args_payload(step.args),
                    },
                )
            )
            return ToolMessage(
                content=json.dumps({"error": ctx.data_refusal}),
                tool_call_id=call_id,
                status="error",
            )
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
        return ev

    def _record_evidence(
        self,
        call: dict[str, Any],
        ev: DataEvidence,
        *,
        ctx: HarnessContext,
        user_message: str,
        evidence: list[DataEvidence],
        progress: Progress,
    ) -> ToolMessage:
        evidence.append(ev)
        # Emits freshness.warning. The refuse verdict does not stop the run:
        # the evidence is already marked stale and the prompt has the model
        # caveat it.
        judge_freshness(
            evidence,
            ctx=ctx,
            settings=self.settings,
            progress=progress,
            profile=self.profile,
        )
        if self.provenance_log is not None:
            self.provenance_log.append(
                _provenance_entry(ctx=ctx, user_message=user_message, step=_step(call), evidence=ev)
            )
        return ToolMessage(
            content=self._render_tool_result(ev), tool_call_id=str(call.get("id", ""))
        )

    @property
    def prefix_tokens(self) -> dict[str, int]:
        """Approximate tokens of the system prompt and of the tool list."""
        return dict(self._prefix_tokens)

    def _projected_ratio(self, context: dict[str, Any], messages: list[BaseMessage]) -> float:
        """Share of the window the next request will use: the last turn's
        count plus the tool results added after that turn's reply."""
        if not context:
            return 0.0
        tail = 0
        for msg in reversed(messages):
            if isinstance(msg, AIMessage):
                break
            tail += count_tokens_approximately([msg])
        return (int(context.get("used", 0)) + tail) / self.context_window

    def _context_usage(
        self,
        start: dict[str, int],
        usage: dict[str, Any],
        messages: list[BaseMessage],
    ) -> dict[str, Any]:
        """How full the context window is after a model turn.

        `used` is the provider's count for the last request plus the reply,
        which is where the next request starts; approximate when the provider
        reports none. The breakdown is approximate and always adds up to
        `used`: `run` is what this run added (tool calls, tool results,
        replies) on top of the rest, which `_calibrated` fits to the first
        request's count.
        """
        reported = int(usage.get("input_tokens") or 0) + int(usage.get("output_tokens") or 0)
        used = reported or count_tokens_approximately(messages) + self._prefix_tokens["tools"]
        estimated = sum(start.values())
        if estimated > used:
            # The estimates overshoot the provider's count; scale them down so
            # the parts still add up to `used`.
            parts = {k: v * used // estimated for k, v in start.items()}
            parts["message"] += used - sum(parts.values())
            breakdown = {**parts, "run": 0}
        else:
            breakdown = {**start, "run": used - estimated}
        return {
            "model": self.model_name,
            "window": self.context_window,
            "used": used,
            "ratio": round(used / self.context_window, 4),
            "breakdown": breakdown,
        }

    def _prepare(self, messages: list[BaseMessage]) -> list[BaseMessage]:
        """The transcript as this runner's provider takes it."""
        if self.anthropic_format:
            return _with_tail_marker(messages)
        return _plain_messages(messages)

    def _is_utility_tool(self, name: str) -> bool:
        return name in self.registry.names() and self.registry.get(name).kind in (
            "utility",
            "trainer",
        )

    async def _run_utility(
        self, call: dict[str, Any], *, ctx: HarnessContext, progress: Progress
    ) -> ToolMessage:
        """Run a utility tool and return its output as the tool result.

        Its output is a working aid (a file, the task list), not data, so it
        does not become evidence, is not freshness-judged and is not logged as
        provenance. It is cut to `agents_agent_loop_tool_result_max_chars`.
        """
        name = str(call.get("name", ""))
        call_id = str(call.get("id", ""))
        try:
            output = await self.registry.invoke(name, ctx, dict(call.get("args") or {}), progress)
        except Exception as exc:  # noqa: BLE001 — the model sees the error and adapts
            # HarnessTool.invoke already emitted tool.failed.
            return ToolMessage(
                content=json.dumps({"error": f"{name} failed: {exc}"}, default=str),
                tool_call_id=call_id,
                status="error",
            )
        dump = output.model_dump() if hasattr(output, "model_dump") else output
        text = json.dumps(dump, default=str, ensure_ascii=False)
        cap = self.settings.agents_agent_loop_tool_result_max_chars
        if len(text) > cap:
            note = f" …[cut: {len(text)} characters in all]"
            text = text[: max(0, cap - len(note))] + note
        return ToolMessage(content=text, tool_call_id=call_id)

    def _is_data_tool(self, name: str) -> bool:
        """A tool that reads the datasource: the profile's prefix, or a primitive."""
        prefix = self.profile.tool_prefix
        if prefix and name.startswith(prefix):
            return True
        return name in self.registry.names() and self.registry.get(name).kind == "primitive"

    async def _load_skill(
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
                    "call_id": call_id,
                    **args_payload({"skill_id": skill_id}),
                },
            )
        )
        if skill_id in loaded_skills:
            # Token guard: the body is already in the transcript; a short
            # pointer beats re-sending it.
            return self._skill_result(
                ctx,
                call_id,
                skill_id,
                f"Skill '{skill_id}' is already loaded in this conversation; "
                "follow the instructions you already received.",
                progress=progress,
                loaded=False,
            )
        activated = (
            await self.context_skills.activate_skill_for_run(
                ctx, skill_id, connection=self.profile.name
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
                        "call_id": call_id,
                        "ok": False,
                        "duration_ms": 0,
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
            ctx,
            call_id,
            skill_id,
            f"# Skill: {name}\n\n{body}",
            progress=progress,
            loaded=True,
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
                    "call_id": call_id,
                    "ok": True,
                    **preview_payload(content),
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
        # The exact total lives outside the output, which may be cut or dropped.
        total = _result_total(ev.output)
        if total is not None:
            header["total"] = total
        upstream = _upstream_note(ev.output, ev.sample_size, total)
        cap = self.settings.agents_agent_loop_tool_result_max_chars
        budget = cap - len(json.dumps(header, default=str)) - _EXCERPT_ENVELOPE_CHARS
        for _ in range(3):
            if budget < _MIN_EXCERPT_CHARS:
                break
            excerpt, note = excerpt_for_prompt(ev.output, budget)
            note = "; ".join(part for part in (upstream, note) if part)
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
                **({"total": header["total"]} if "total" in header else {}),
                "excerpt": "omitted: tool result cap too small",
                "output": None,
            }
        )


def _result_total(output: Any) -> Any:
    """The exact row count a tool reports (`total` or `total_count`), or None."""
    if not isinstance(output, dict):
        return None
    for key in ("total", "total_count"):
        if output.get(key) is not None:
            return output[key]
    return None


def _upstream_note(output: Any, rows_returned: int | None, total: Any) -> str:
    """Truncation the tool itself performed before the evidence was built."""
    if not isinstance(output, dict):
        return ""
    if not output.get("truncated"):
        return ""
    return f"first {rows_returned} of {total} rows"


class AgentLoopRunners:
    """One `AgentLoopRunner` per conversation model, built on first use.

    Each runner binds its own model and freezes its own prompt-cache prefix.
    `run` dispatches on `ctx.model`; an unknown model is refused here as well
    as at the API, so a direct caller cannot bypass the allowlist.

    With `providers`, the offered models and the default follow the provider
    registry as it changes, and runners are rebuilt when it does (a rotated
    key, a new base URL).
    """

    def __init__(
        self,
        *,
        default_model: str,
        models: tuple[str, ...] | list[str],
        build_model: Callable[..., BaseChatModel],
        registry: ToolRegistry,
        settings: HarnessSettings,
        profile: DataSourceProfile,
        provenance_log: ProvenanceLog | None = None,
        context_skills: ContextSkillsBundle | None = None,
        seats: LoopSeats | None = None,
        providers: Callable[[], ProviderRegistry] | None = None,
    ) -> None:
        self._configured_default = default_model
        self._configured = tuple(models)
        self._providers = providers
        self._providers_version: tuple[Provider, ...] | None = None
        self._build_model = build_model
        self._kwargs: dict[str, Any] = {
            "registry": registry,
            "settings": settings,
            "profile": profile,
            "provenance_log": provenance_log,
            "context_skills": context_skills,
            "seats": seats,
        }
        # Keyed by model name, plus the run effort when one was chosen.
        self._runners: dict[str, AgentLoopRunner] = {}

    @property
    def default_model(self) -> str:
        """The platform owner's default model when set, else the configured one."""
        chosen = self._providers().default_model() if self._providers else None
        return chosen or self._configured_default

    @property
    def models(self) -> tuple[str, ...]:
        offered = self._providers().offered() if self._providers else []
        return tuple(dict.fromkeys([self.default_model, *self._configured, *offered]))

    def allowed(self, model: str | None) -> bool:
        return model is None or model in self.models

    def runner_for(
        self, model: str | None, effort: RunEffort | None = None, trainer: bool = False
    ) -> AgentLoopRunner:
        """A trainer's runner offers the trainer tools too, so it has its own
        cached prefix."""
        name = self.default_model if model is None else model
        if name not in self.models:
            raise ValueError(f"model {name!r} is not in the agent loop allowlist")
        if self._providers is not None:
            version = self._providers().version
            if version != self._providers_version:
                self._runners.clear()
                self._providers_version = version
        key = name if effort is None else f"{name}#{effort}"
        if trainer:
            key += "#trainer"
        runner = self._runners.get(key)
        if runner is None:
            built = self._build_model(name) if effort is None else self._build_model(name, effort)
            runner = AgentLoopRunner(
                model=built,
                anthropic_format=is_anthropic(name),
                model_name=name,
                trainer=trainer,
                **self._kwargs,
            )
            self._runners[key] = runner
        return runner

    async def run(
        self,
        *,
        user_message: str,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
        progress: Progress,
    ) -> dict[str, Any]:
        runner = self.runner_for(ctx.model, ctx.effort, ctx.trainer)
        return await runner.run(
            user_message=user_message,
            ctx=ctx,
            prior_messages=prior_messages,
            progress=progress,
        )
