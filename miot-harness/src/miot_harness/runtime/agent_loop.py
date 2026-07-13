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
from time import monotonic
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import (
    BaseMessage,
    HumanMessage,
    SystemMessage,
    ToolMessage,
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
from miot_harness.runtime.agentic_graph import _provenance_entry
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import instrument_model
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence, DataStep
from miot_harness.runtime.router import HarnessRoute
from miot_harness.runtime.tenancy import tenancy_gate_decision
from miot_harness.runtime.tool import Progress
from miot_harness.tools.registry import ToolRegistry
from miot_harness.utils.truncation import truncate_for_trace

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
    ) -> None:
        self.registry = registry
        self.settings = settings
        self.profile = profile
        self.provenance_log = provenance_log
        self.context_skills = context_skills
        skills_index = render_skills_index(context_skills, profile)
        self.native_tools = build_native_tools(registry, profile=profile)
        if skills_index:
            # Re-sort so the tool list stays deterministically ordered — the
            # same byte-stability contract build_native_tools guarantees.
            self.native_tools = sorted(
                [*self.native_tools, _LOAD_SKILL_SCHEMA],
                key=lambda t: t["name"],
            )
        self.system_message = cached_system_message(
            build_agent_system_prompt(profile, skills_index=skills_index)
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
            response = await model.ainvoke(_with_tail_marker(messages))
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
            for call in tool_calls:
                if call.get("name") == _LOAD_SKILL_TOOL:
                    messages.append(
                        self._load_skill(
                            call, ctx=ctx, loaded_skills=loaded_skills,
                            progress=progress,
                        )
                    )
                    continue
                messages.append(
                    await self._execute_tool_call(
                        call, ctx=ctx, user_message=user_message,
                        evidence=evidence, progress=progress,
                    )
                )

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
        payload, _info = truncate_for_trace(
            {
                "tool": ev.tool,
                "source": ev.source,
                "rows_returned": ev.sample_size,
                "refreshed_at": ev.refreshed_at,
                "is_stale": ev.is_stale,
                "freshness_status": ev.freshness_status,
                "is_sample": ev.is_sample,
                "executed_sql": ev.executed_sql,
                "output": ev.output,
            }
        )
        text = json.dumps(payload, default=str)
        cap = self.settings.agents_agent_loop_tool_result_max_chars
        if len(text) > cap:
            text = text[:cap] + '... [truncated]"}'
        return text
