"""Advisor and workhorse seats the conversation model can call as tools.

`ask_advisor` sends a stronger model the delta since the last consult and
gets back one signal (ENDORSE, CORRECTION, PLAN, STOP) with a short note.
The advisor never calls tools; its transcript is kept per conversation so
each consult only carries what changed.

`delegate` hands a brief to a bounded loop on a lighter model with the same
data tools, no advisor and no further delegation. Its evidence joins the
parent's evidence; the parent gets a summary as the tool result. Several
delegations in one turn run concurrently.
"""

from __future__ import annotations

import asyncio
import json
import logging
import re
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, Protocol

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    AIMessage,
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
)

from miot_harness.agents.chat_models import response_text
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import instrument_model
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence
from miot_harness.runtime.tool import Progress

logger = logging.getLogger(__name__)

ADVISOR_TOOL = "ask_advisor"
DELEGATE_TOOL = "delegate"
SIGNALS = ("ENDORSE", "CORRECTION", "PLAN", "STOP")

# Consults per conversation kept for the advisor (2 messages each).
_TRANSCRIPT_CAP = 24
# Conversations kept; the oldest is dropped past this.
_TRANSCRIPT_KEYS_CAP = 512
# The signal is the first word of the reply; prose never counts.
_SIGNAL_RE = re.compile(r"^[\s*#>-]*(ENDORSE|CORRECTION|PLAN|STOP)\b")

ADVISOR_SCHEMA: dict[str, Any] = {
    "name": ADVISOR_TOOL,
    "description": (
        "Consult the advisor, a stronger model that sees this conversation's "
        "earlier consults but has no tools. Call it at plan lock-in, when you "
        "believe you are done, before a hard-to-reverse step, or after repeated "
        "failures. Send only what changed since the last consult. It answers "
        "with one signal: ENDORSE (proceed), CORRECTION (fix the named step "
        "first), PLAN (a revised approach), STOP (halt and tell the user)."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "assignment": {"type": "string", "description": "What you are trying to answer."},
            "delta": {
                "type": "string",
                "description": (
                    "What happened since the last consult: tools run, results, dead ends."
                ),
            },
            "decision": {
                "type": "string",
                "description": "The decision or blocker you want a signal on.",
            },
            "excerpts": {
                "type": "string",
                "description": "Evidence excerpts the advisor needs to answer well.",
            },
        },
        "required": ["assignment", "delta", "decision"],
    },
}

DELEGATE_SCHEMA: dict[str, Any] = {
    "name": DELEGATE_TOOL,
    "description": (
        "Hand a self-contained sub-task to a lighter agent with the same data "
        "tools and a turn cap. Use it for a multi-step lookup you can describe "
        "fully, or to run independent lookups at once (call delegate several "
        "times in one turn). It returns a summary; its evidence joins yours. "
        "It cannot consult the advisor or delegate further."
    ),
    "input_schema": {
        "type": "object",
        "properties": {
            "brief": {
                "type": "string",
                "description": "The complete task: what to find, where, and what to return.",
            },
            "expected": {
                "type": "string",
                "description": "The shape of the result you want back (a count, a list, a table).",
            },
        },
        "required": ["brief"],
    },
}

_ADVISOR_SYSTEM = """\
You are the advisor for a data agent working on {display_name}. The agent
calls tools; you do not. Each consult brings only the delta since the last
one, and you remember earlier consults in this conversation.

Reply with exactly one signal word on the first line, then at most five
lines of note:
- ENDORSE: the plan or the work is sound; proceed.
- CORRECTION: name the wrong step or the risk to close before continuing.
- PLAN: give the revised approach as numbered steps.
- STOP: the work must halt; say why the user should be told.

Be concrete: cite the evidence the agent showed you, name tools and
arguments when you suggest a step, and never invent data.
"""


def seat_tool_schemas(seats: LoopSeats | None) -> list[dict[str, Any]]:
    if seats is None:
        return []
    out: list[dict[str, Any]] = []
    if seats.advisor is not None:
        out.append(ADVISOR_SCHEMA)
    if seats.workhorse is not None:
        out.append(DELEGATE_SCHEMA)
    return out


def seats_prompt_block(seats: LoopSeats | None) -> str:
    """The system-prompt lines describing the seats; part of the cached prefix."""
    if seats is None:
        return ""
    lines: list[str] = []
    if seats.advisor is not None:
        lines.append(
            f"- `{ADVISOR_TOOL}`: a stronger model with no tools. Consult it at plan "
            "lock-in, when you believe you are done, before a hard-to-reverse step, "
            "or after repeated failures; send only the delta since the last consult. "
            f"At most {seats.advisor.max_consults} consults per question. Address a "
            "CORRECTION before treating the work as done; follow a PLAN; on STOP, "
            "stop and tell the user why."
        )
    if seats.workhorse is not None:
        lines.append(
            f"- `{DELEGATE_TOOL}`: a lighter agent with the same data tools and a turn "
            "cap. Give it a complete brief for a multi-step lookup, or several "
            "briefs in one turn for independent lookups. Its evidence joins yours; "
            "quote its numbers only when its summary shows the tool results."
        )
    return "\nSeats you can call:\n" + "\n".join(lines) + "\n"


class AdvisorTranscripts:
    """Advisor history in memory, keyed by tenant, user and conversation.

    `lock(key)` serialises one consult's read, model call and append so
    concurrent runs on one conversation see each other's exchanges.
    """

    def __init__(self, cap: int = _TRANSCRIPT_CAP, keys_cap: int = _TRANSCRIPT_KEYS_CAP) -> None:
        self._cap = cap
        self._keys_cap = keys_cap
        self._by_key: dict[str, list[BaseMessage]] = {}
        self._locks: dict[str, asyncio.Lock] = {}

    @staticmethod
    def key_for(ctx: HarnessContext) -> str:
        scope = f"conv/{ctx.conversation_id}" if ctx.conversation_id else f"run/{ctx.run_id}"
        return f"{ctx.tenant_id}/{ctx.user_id}/{scope}"

    def lock(self, key: str) -> asyncio.Lock:
        lock = self._locks.get(key)
        if lock is None:
            lock = self._locks[key] = asyncio.Lock()
        return lock

    def get(self, key: str) -> list[BaseMessage]:
        return list(self._by_key.get(key, []))

    def extend(self, key: str, messages: list[BaseMessage]) -> None:
        kept = self._by_key.setdefault(key, [])
        kept.extend(messages)
        if len(kept) > self._cap:
            del kept[: len(kept) - self._cap]
        while len(self._by_key) > self._keys_cap:
            oldest = next(iter(self._by_key))
            del self._by_key[oldest]
            self._locks.pop(oldest, None)


@dataclass
class AdvisorSeat:
    model: BaseChatModel
    display_name: str
    max_consults: int = 2
    span_prefix: str = "agent_loop"
    transcripts: AdvisorTranscripts = field(default_factory=AdvisorTranscripts)

    async def consult(
        self,
        call: dict[str, Any],
        *,
        ctx: HarnessContext,
        consult: int,
        progress: Progress,
    ) -> ToolMessage:
        call_id = str(call.get("id", ""))
        args = dict(call.get("args") or {})
        if consult > self.max_consults:
            payload = {
                "signal": "BUDGET",
                "note": (
                    f"The advisor budget of {self.max_consults} consults for this "
                    "question is spent. Decide with the evidence you have."
                ),
                "consult": consult,
                "max_consults": self.max_consults,
            }
            return ToolMessage(content=json.dumps(payload), tool_call_id=call_id)
        key = self.transcripts.key_for(ctx)
        human = HumanMessage(content=_render_consult(args))
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.started",
                message="Consulting the advisor",
                data={"agent": "advisor", "graph": "agent_loop", "turn": consult},
            )
        )
        model = instrument_model(
            self.model, "advisor", ctx, progress=progress, span_prefix=self.span_prefix
        )
        async with self.transcripts.lock(key):
            messages: list[BaseMessage] = [
                SystemMessage(content=_ADVISOR_SYSTEM.format(display_name=self.display_name)),
                *self.transcripts.get(key),
                human,
            ]
            response = await model.ainvoke(messages)
            text = response_text(response).strip()
            signal, note = _parse_signal(text)
            self.transcripts.extend(key, [human, AIMessage(content=text)])
        payload = {
            "signal": signal,
            "note": note,
            "consult": consult,
            "max_consults": self.max_consults,
        }
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="advisor.consulted",
                message=f"Advisor: {signal}",
                data={**payload, "usage": dict(getattr(response, "usage_metadata", None) or {})},
            )
        )
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.completed",
                message="Advisor answered",
                data={"agent": "advisor", "graph": "agent_loop", "turn": consult},
            )
        )
        return ToolMessage(content=json.dumps(payload, ensure_ascii=False), tool_call_id=call_id)


def _render_consult(args: dict[str, Any]) -> str:
    parts = [
        f"Assignment: {args.get('assignment', '')}",
        f"Since the last consult: {args.get('delta', '')}",
        f"Decision or blocker: {args.get('decision', '')}",
    ]
    if args.get("excerpts"):
        parts.append(f"Excerpts:\n{args['excerpts']}")
    return "\n".join(parts)


def _parse_signal(text: str) -> tuple[str, str]:
    match = _SIGNAL_RE.match(text)
    if match is None:
        return "PLAN", text
    return match.group(1), text[match.end() :].strip(" :\n-*")


class SubLoop(Protocol):
    async def run(
        self,
        *,
        user_message: str,
        ctx: HarnessContext,
        prior_messages: list[BaseMessage],
        progress: Progress,
    ) -> dict[str, Any]: ...


@dataclass
class WorkhorseSeat:
    """Runs briefs on a lighter loop; `build` returns the loop, made once."""

    build: Callable[[], SubLoop]
    max_parallel: int = 3
    _loop: SubLoop | None = None
    _gate: asyncio.Semaphore | None = None

    def loop(self) -> SubLoop:
        if self._loop is None:
            self._loop = self.build()
        return self._loop

    async def delegate_all(
        self,
        calls: list[dict[str, Any]],
        *,
        ctx: HarnessContext,
        progress: Progress,
    ) -> list[tuple[ToolMessage, list[DataEvidence]]]:
        # One gate per seat: the bound holds across concurrent parent runs.
        if self._gate is None:
            self._gate = asyncio.Semaphore(max(1, self.max_parallel))
        gate = self._gate

        async def one(call: dict[str, Any]) -> tuple[ToolMessage, list[DataEvidence]]:
            async with gate:
                return await self.delegate(call, ctx=ctx, progress=progress)

        return list(await asyncio.gather(*(one(c) for c in calls)))

    async def delegate(
        self,
        call: dict[str, Any],
        *,
        ctx: HarnessContext,
        progress: Progress,
    ) -> tuple[ToolMessage, list[DataEvidence]]:
        call_id = str(call.get("id", ""))
        args = dict(call.get("args") or {})
        brief = str(args.get("brief", "")).strip()
        if args.get("expected"):
            brief += f"\n\nReturn: {args['expected']}"
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.started",
                message="Delegating to a workhorse",
                data={"agent": "workhorse", "graph": "agent_loop", "brief": brief[:200]},
            )
        )
        delta = await self.loop().run(
            user_message=brief,
            ctx=ctx,
            prior_messages=[],
            progress=_child_progress(progress),
        )
        evidence: list[DataEvidence] = list(delta.get("evidence") or [])
        summary = str(delta.get("answer") or "").strip()
        payload = {
            "summary": summary,
            "tools_run": [ev.tool for ev in evidence],
            "rows_returned": sum(ev.sample_size for ev in evidence),
            "turns": len(delta.get("usage_log") or []),
        }
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="delegate.completed",
                message="Workhorse finished",
                data={"brief": brief[:200], **{k: v for k, v in payload.items() if k != "summary"}},
            )
        )
        progress(
            HarnessEvent(
                run_id=ctx.run_id,
                type="agent.completed",
                message="Workhorse finished",
                data={"agent": "workhorse", "graph": "agent_loop"},
            )
        )
        result = ToolMessage(content=json.dumps(payload, ensure_ascii=False), tool_call_id=call_id)
        return result, evidence


def _child_progress(progress: Progress) -> Progress:
    """Events of a workhorse run as the parent stream sees them.

    Its text is not the answer, so `answer.*` events are dropped; its turns
    and thinking are relabelled `workhorse`; tool events pass through.
    """

    def emit(event: HarnessEvent) -> None:
        if event.type in ("answer.delta", "answer.completed"):
            return
        if event.data.get("agent") == "agent_loop":
            event = event.model_copy(update={"data": {**event.data, "agent": "workhorse"}})
        progress(event)

    return emit


@dataclass
class LoopSeats:
    advisor: AdvisorSeat | None = None
    workhorse: WorkhorseSeat | None = None
