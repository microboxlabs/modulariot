"""Agentic Planner (Sonnet tier).

One LLM seat per agentic turn. Unlike the canned pipeline (filter_expert
picks a step, domain_analyst judges sufficiency), the agentic planner
does both jobs in one call: given the user question, the tool catalogs
and the evidence collected so far, it emits either

  {"action": "call_tool", "tool": ..., "args": {...},
   "intent": ..., "rationale": ...}        → executor runs the tool
  {"action": "final", "reasoning": ...}    → synthesizer answers

The tool surface is the curated catalog (profile.tool_prefix) PLUS the
composable exploration primitives (HarnessTool.kind == "primitive").
Anything else sharing the registry (storytelling tools etc.) is out of
scope and rejected.

Guards mirror filter_expert: malformed JSON degrades to synthesis when
evidence exists (answer with what we have) and fails otherwise;
unknown / out-of-scope tools fail; the turn cap forces synthesis or a
graceful failure.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage, SystemMessage
from pydantic import ValidationError

from miot_harness.agents.domain_analyst import render_evidence
from miot_harness.agents.filter_expert import _strip_fences, build_tool_catalog
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.plan import DataEvidence, DataStep
from miot_harness.tools.registry import ToolRegistry

logger = logging.getLogger(__name__)


# {display_name} → profile.display_name; {tenant_display} → the tenant the
# datasource is locked to (profile.tenant_lock, capitalized); {primer} →
# profile.primer; {catalog} / {primitives_catalog} → rendered tool lists.
_AGENTIC_PLANNER_SYSTEM_TEMPLATE = """\
You are the {display_name} agentic planner ({tenant_display} fleet operations).
Each turn you choose the SINGLE next action: run one more tool to gather
evidence, or declare the investigation finished. You DO NOT answer the
user yourself.

{primer}

Curated tools (preferred):
{catalog}

Exploration primitives (read-only SQL helpers; use ONLY when no curated
tool covers the question):
{primitives_catalog}

Output ONLY a JSON object in one of these two shapes:
{{"action": "call_tool", "tool": "...", "args": {{}}, "intent": "...", "rationale": "..."}}
{{"action": "final", "reasoning": "..."}}

Rules:
- Prefer curated tools; primitives are a fallback for questions the
  curated catalog cannot answer.
- args is a JSON object of parameter overrides; {{}} uses the defaults.
- Never repeat a tool call you already executed with identical args.
- Choose "final" once the collected evidence answers the question, or
  once it is clear the available tools cannot answer it.
"""


def build_primitives_catalog(registry: ToolRegistry) -> str:
    lines: list[str] = []
    for name in registry.names():
        tool = registry.get(name)
        if tool.kind != "primitive":
            continue
        first_line = (tool.description or "").splitlines()[0].strip()
        lines.append(f"- {name}: {first_line}")
    return "\n".join(lines) if lines else "(no primitives registered)"


def _parse_action(text: str) -> dict[str, Any] | None:
    cleaned = _strip_fences(text)
    try:
        payload = json.loads(cleaned)
    except json.JSONDecodeError:
        return None
    if not isinstance(payload, dict):
        return None
    return payload


async def agentic_planner_node(
    state: dict[str, Any],
    *,
    registry: ToolRegistry,
    model: BaseChatModel,
    profile: DataSourceProfile,
    max_turns: int,
) -> dict[str, Any]:
    evidence: list[DataEvidence] = list(state.get("evidence", []))
    turn_count = int(state.get("turn_count", 0) or 0)

    if turn_count >= max_turns:
        if evidence:
            # Cap reached mid-investigation: answer with what we have.
            return {"next_action": "ready_to_synthesize", "current_step": None}
        return {"failure": "agentic turn cap exceeded", "next_action": None}

    system = _AGENTIC_PLANNER_SYSTEM_TEMPLATE.format(
        display_name=profile.display_name,
        tenant_display=(profile.tenant_lock or profile.display_name).capitalize(),
        primer=profile.primer,
        catalog=build_tool_catalog(registry, profile=profile),
        primitives_catalog=build_primitives_catalog(registry),
    )

    executed: list[DataStep] = list(state.get("executed_steps", []))
    executed_lines = (
        "\n".join(f"- {s.tool}({json.dumps(s.args, default=str)})" for s in executed)
        or "(none)"
    )
    human = (
        f"User question:\n{state.get('user_message', '')}\n\n"
        f"Evidence collected so far:\n{render_evidence(evidence)}\n\n"
        f"Tool calls already executed:\n{executed_lines}\n\n"
        "Decide the next action."
    )

    prior_messages = state.get("prior_messages") or []
    messages: list[BaseMessage] = [SystemMessage(content=system)]
    messages.extend(prior_messages)
    messages.append(HumanMessage(content=human))
    response = await model.ainvoke(messages)

    text = response.content if hasattr(response, "content") else str(response)
    if not isinstance(text, str):
        text = str(text)

    payload = _parse_action(text)
    if payload is None or payload.get("action") not in ("call_tool", "final"):
        if evidence:
            # Degrade gracefully: a malformed verdict shouldn't discard
            # real evidence — synthesize with what we have.
            logger.warning(
                "agentic planner: unparseable response with evidence in hand; "
                "degrading to synthesis: %r",
                text[:200],
            )
            return {
                "next_action": "ready_to_synthesize",
                "current_step": None,
                "turn_count": turn_count + 1,
            }
        logger.error("agentic planner: model returned unparseable response: %r", text[:200])
        return {"failure": "agentic planner returned malformed step", "next_action": None}

    if payload["action"] == "final":
        return {
            "next_action": "ready_to_synthesize",
            "current_step": None,
            "turn_count": turn_count + 1,
        }

    tool_name = str(payload.get("tool", ""))
    in_registry = tool_name in registry.names()
    is_curated = tool_name.startswith(profile.tool_prefix)
    is_primitive = in_registry and registry.get(tool_name).kind == "primitive"
    if not (is_curated or is_primitive):
        logger.error("agentic planner: out-of-scope tool %r", tool_name)
        return {
            "failure": f"agentic planner picked out-of-scope tool: {tool_name}",
            "next_action": None,
        }
    if not in_registry:
        logger.error("agentic planner: hallucinated tool %r (not in registry)", tool_name)
        return {
            "failure": f"agentic planner proposed unknown tool: {tool_name}",
            "next_action": None,
        }

    try:
        step = DataStep(
            intent=str(payload.get("intent", "")),
            tool=tool_name,
            args=payload.get("args", {}) or {},
            rationale=str(payload.get("rationale", "")),
        )
    except ValidationError:
        return {"failure": "agentic planner returned malformed step", "next_action": None}

    return {
        "current_step": step,
        "turn_count": turn_count + 1,
        "next_action": None,
    }
