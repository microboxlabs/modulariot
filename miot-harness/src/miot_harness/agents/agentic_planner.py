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
You plan the tool calls that gather the evidence needed to answer the question,
then declare the investigation finished. You DO NOT answer the user yourself.

{primer}

Curated tools (preferred):
{catalog}

Exploration primitives (read-only SQL helpers; use ONLY when no curated
tool covers the question):
{primitives_catalog}

Output ONLY a JSON object in one of these shapes:
{{"action": "plan", "steps": [<step>, <step>, ...]}}   (each <step> = the call_tool fields below)
{{"action": "call_tool", "tool": "...", "args": {{}}, "intent": "...", "rationale": "..."}}
{{"action": "final", "reasoning": "..."}}

Prefer "plan": emit the COMPLETE ordered sequence of steps that fully answers
the question (e.g. read the relevant knowledge card → discover the variable /
column names → run the join/pivot that returns the rows with their attributes).
The executor runs EVERY step before you are consulted again, carrying results
forward. Use "call_tool" only for a genuine single step. Use "final" only when
the executed evidence already answers the question.

Rules:
- Prefer curated tools; primitives are a fallback for questions the
  curated catalog cannot answer.
- args is a JSON object of parameter overrides; {{}} uses the defaults.
- Never repeat a tool call you already executed with identical args.
- Read any knowledge card at most once, then ACT on what it says — do not
  put repeat reads of the same card in your plan.

Rigor — do not answer from incomplete or fuzzy evidence:
- A grep / ILIKE result is a FUZZY sample, never an authoritative count or
  list. Do not report a total or enumerate items from a grep — run a precise
  query (the `*_query` tool) with an explicit WHERE; use COUNT(*) for totals.
- "List / give me / show me <items>" means ENUMERATE the actual rows — run a
  query that returns one row per item with its business attributes. A COUNT is
  not a list; never substitute a count, a sample, or an offer for the rows asked.
- If the items' attributes live in a related table (e.g. process variables, node
  properties), you MUST run the join/pivot query that returns the actual
  attributes (codes, names, references) before finishing.
- Never state a number or list you have not obtained from a real query result.
- Do NOT choose "final" while a query you have already identified as needed is
  still unrun, and do NOT defer it ("I can run it if you want") — run it now.
- Choose "final" only once an EXECUTED query's results actually answer the
  question, or it is clear the available tools cannot answer it.
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


class _StepError(ValueError):
    """A step the planner proposed is out-of-scope, unknown, or malformed."""


def _build_step(
    raw: dict[str, Any], *, registry: ToolRegistry, profile: DataSourceProfile
) -> DataStep:
    """Validate one proposed step and build a DataStep, or raise _StepError.

    Scope rules mirror the single-step path: a tool must be either curated
    (profile.tool_prefix) or a registered primitive; anything else (storytelling
    tools, hallucinated names) is rejected so the executor never runs it."""
    tool_name = str(raw.get("tool", ""))
    in_registry = tool_name in registry.names()
    is_curated = tool_name.startswith(profile.tool_prefix)
    is_primitive = in_registry and registry.get(tool_name).kind == "primitive"
    if not (is_curated or is_primitive):
        raise _StepError(f"out-of-scope tool: {tool_name}")
    if not in_registry:
        raise _StepError(f"unknown tool: {tool_name}")
    try:
        return DataStep(
            intent=str(raw.get("intent", "")),
            tool=tool_name,
            args=raw.get("args", {}) or {},
            rationale=str(raw.get("rationale", "")),
        )
    except ValidationError as exc:
        raise _StepError("malformed step") from exc


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
    failed: list[str] = list(state.get("failed_steps", []))
    failed_lines = "\n".join(f"- {note}" for note in failed) or "(none)"
    # On a re-plan the verifier left a gap note: the executed evidence did NOT
    # answer the question. Surface it so the planner closes the gap instead of
    # repeating the satisficing the verifier just rejected.
    gap = str(state.get("verification_gap") or "").strip()
    gap_block = (
        f"A previous attempt was judged INCOMPLETE. Gap to close:\n{gap}\n"
        "Plan the steps that close it; do not finalize until it is addressed.\n\n"
        if gap
        else ""
    )
    human = (
        f"User question:\n{state.get('user_message', '')}\n\n"
        f"{gap_block}"
        f"Evidence collected so far:\n{render_evidence(evidence)}\n\n"
        f"Tool calls already executed:\n{executed_lines}\n\n"
        f"Tool calls that FAILED (do not repeat them as-is; fix the args, "
        f"try a different tool, or finalize):\n{failed_lines}\n\n"
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
    if payload is None or payload.get("action") not in ("plan", "call_tool", "final"):
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

    if payload["action"] == "plan":
        raw_steps = payload.get("steps")
        if not isinstance(raw_steps, list) or not raw_steps:
            return {
                "failure": "agentic planner returned an empty or malformed plan",
                "next_action": None,
            }
        steps: list[DataStep] = []
        try:
            for raw in raw_steps:
                if not isinstance(raw, dict):
                    raise _StepError("plan step is not an object")
                steps.append(_build_step(raw, registry=registry, profile=profile))
        except _StepError as exc:
            logger.error("agentic planner: invalid plan step (%s)", exc)
            return {
                "failure": f"agentic planner proposed an invalid plan step: {exc}",
                "next_action": None,
            }
        # The executor drains pending_steps to completion before the planner is
        # consulted again; verify then judges whether the plan answered it.
        return {
            "pending_steps": steps,
            "current_step": None,
            "turn_count": turn_count + 1,
            "next_action": "execute_plan",
        }

    # action == "call_tool": legacy single step.
    try:
        step = _build_step(payload, registry=registry, profile=profile)
    except _StepError as exc:
        logger.error("agentic planner: %s", exc)
        return {
            "failure": f"agentic planner picked {exc}",
            "next_action": None,
        }

    return {
        "current_step": step,
        "turn_count": turn_count + 1,
        "next_action": None,
    }
