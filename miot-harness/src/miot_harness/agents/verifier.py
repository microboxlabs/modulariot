"""Completion verifier (Phase 3 — small judge tier).

The agentic planner satisfices: it forms a plan, sometimes even writes the SQL,
then declares "final" without running it — or answers a "list" question from a
fuzzy grep sample. Prompting alone didn't fix this (proven empirically); the
fix is structural. This node intercepts the planner's decision to finish and
asks: *do the EXECUTED results actually fulfil the request?*

Two layers:

  1. Rule-based (always on, cheap): no evidence at all → not fulfilled. Hard
     caps (replan/turn budget) → accept and synthesize, never loop forever.
  2. A small LLM judge (when a model is wired): catches the nuanced satisficing
     — "list asked but only a count/sample ran", "attributes asked but only ids
     present", "a needed query never executed". Degrades to rules-only when no
     model is provided (e.g. tests), so the gate is safe by construction.

On a gap it records `verification_gap` and routes back to the planner to
re-plan; otherwise it lets the run synthesize.
"""

from __future__ import annotations

import json
import logging
from typing import Any

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage

from miot_harness.agents.chat_models import response_text
from miot_harness.agents.filter_expert import _strip_fences
from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence
from miot_harness.runtime.tool import Progress

logger = logging.getLogger(__name__)

# next_action values this node emits; the graph routes on them.
VERIFIED_DONE = "verified_done"
REPLAN = "replan"

_JUDGE_SYSTEM = """\
You are a strict completion judge for a data assistant. Decide whether the
EXECUTED evidence already fully answers the user's question. You do NOT answer
the question yourself.

Mark fulfilled=false (and name the gap in one line) when:
- the question asks to LIST / enumerate items but only a COUNT or a fuzzy SAMPLE
  ran (no row-per-item result);
- the question asks for attributes/details (codes, names, references) that are
  NOT present in the evidence;
- a query clearly needed to answer the question was never executed;
- the ONLY evidence is a SAMPLE (grep/ILIKE) — never authoritative for a total
  or a complete list.
Mark fulfilled=true when the executed results actually answer what was asked, or
when the evidence shows the available tools genuinely cannot answer it.

Return ONLY a JSON object: {"fulfilled": true|false, "gap": "<one line>"}
"""


def _summarize_evidence(evidence: list[DataEvidence]) -> str:
    lines: list[str] = []
    for ev in evidence:
        sample = " SAMPLE" if ev.is_sample else ""
        line = f"- tool={ev.tool} rows={ev.sample_size}{sample}"
        if ev.executed_sql:
            line += f" sql={ev.executed_sql[:300]}"
        snippet = json.dumps(ev.output, default=str)[:500]
        lines.append(f"{line}\n    {snippet}")
    return "\n".join(lines) if lines else "(no evidence)"


def _emit(
    progress: Progress,
    run_id: str,
    *,
    fulfilled: bool,
    gap: str | None,
    message: str | None = None,
) -> None:
    progress(
        HarnessEvent(
            run_id=run_id,
            type="verification.completed",
            message=message
            or ("Verified completion" if fulfilled else "Re-planning (gap found)"),
            data={"fulfilled": fulfilled, "gap": gap or ""},
        )
    )


async def verify_node(
    state: dict[str, Any],
    *,
    model: BaseChatModel | None,
    settings: HarnessSettings,
    profile: DataSourceProfile,
    progress: Progress,
) -> dict[str, Any]:
    ctx: HarnessContext = state["ctx"]
    evidence: list[DataEvidence] = list(state.get("evidence", []))
    user_message = str(state.get("user_message", ""))
    replan_count = int(state.get("replan_count", 0) or 0)
    turn_count = int(state.get("turn_count", 0) or 0)

    def _done() -> dict[str, Any]:
        _emit(progress, ctx.run_id, fulfilled=True, gap=None)
        return {"next_action": VERIFIED_DONE}

    def _budget_exhausted(reason: str) -> dict[str, Any]:
        # Stop the loop (synthesize with what we have) but report the truth:
        # this run was NOT verified-fulfilled, the budget ran out. Misreporting
        # it as fulfilled=true would skew completion telemetry.
        _emit(
            progress,
            ctx.run_id,
            fulfilled=False,
            gap=reason,
            message=f"{reason}; synthesizing with available evidence",
        )
        return {"next_action": VERIFIED_DONE}

    def _gap(reason: str) -> dict[str, Any]:
        _emit(progress, ctx.run_id, fulfilled=False, gap=reason)
        return {
            "verification_gap": reason,
            "replan_count": replan_count + 1,
            "next_action": REPLAN,
            # Clear any leftover step state so the planner starts the re-plan
            # from a clean slate (the executor drained pending_steps already).
            "current_step": None,
            "pending_steps": [],
        }

    # Out of budget → accept what we have and synthesize. Never loop forever,
    # but record that this was forced (not a genuine fulfilled verdict).
    if replan_count >= settings.agents_agentic_max_replans:
        logger.info("verifier: replan cap reached (%d); synthesizing", replan_count)
        return _budget_exhausted("Re-plan budget exhausted")
    if turn_count >= settings.agents_agentic_max_turns:
        return _budget_exhausted("Turn budget exhausted")

    # Rule: nothing ran → there is nothing to answer from; re-plan.
    if not evidence:
        return _gap("No data was retrieved; run the query that answers the question.")

    # Rules-only mode (no judge model wired): evidence present → accept.
    if model is None:
        return _done()

    system = _JUDGE_SYSTEM
    human = (
        f"User question:\n{user_message}\n\n"
        f"Executed evidence:\n{_summarize_evidence(evidence)}\n\n"
        "Is the question fully answered by this executed evidence?"
    )
    try:
        response = await model.ainvoke(
            [SystemMessage(content=system), HumanMessage(content=human)]
        )
        payload = json.loads(_strip_fences(response_text(response)))
    except Exception as exc:  # noqa: BLE001 — any judge error must not trap the run
        # A judge error must never trap the run — default to done so we
        # synthesize with the evidence in hand rather than loop.
        logger.warning("verifier: judge failed (%s); accepting evidence as-is", exc)
        return _done()

    if not isinstance(payload, dict) or not payload.get("fulfilled", False):
        gap = ""
        if isinstance(payload, dict):
            gap = str(payload.get("gap") or "")
        return _gap(gap or "The executed evidence does not yet answer the question.")
    return _done()
