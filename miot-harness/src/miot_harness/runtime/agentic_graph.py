"""Agentic graph (plan 13, F-phase) — looser variant of `data_graph` for
free exploration of the datasource.

Node layout::

    tenancy_gate → planner ──(current_step)──→ executor → freshness_judge
                     │  ↑                                        │
                     │  └──────────────── (fresh/warn) ──────────┘
                     │
                     ├─(ready_to_synthesize | failure)──→ synthesizer
                     │                                         │
                     │                                      critic
                     │                                         │
                     │                                    summarizer → END

Differences from the plan-execute (canned) graph:
- One Sonnet planner seat replaces filter_expert + domain_analyst: each
  turn it either proposes the next tool call (curated `coordinador_*`
  tools or the composable primitives, kind="primitive") or declares the
  investigation final.
- No DataPlan: the loop runs on `current_step` / `executed_steps`, capped
  by `settings.agents_agentic_max_turns` (default 12 vs canned 8).
- The executor reuses `invoke_step` (the canned data_fetcher's invocation
  path) so both modes share evidence construction and failure handling,
  and writes one ProvenanceEntry per executed step.
- `tenancy_gate` refuses off-lock datasource tenants BEFORE any LLM call.
"""

from __future__ import annotations

import json
from typing import Any, cast

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, StateGraph

from miot_harness.agents.agentic_planner import agentic_planner_node
from miot_harness.agents.critic import critic_node
from miot_harness.agents.data_fetcher import invoke_step
from miot_harness.agents.filter_expert import build_capabilities_summary
from miot_harness.agents.freshness_judge import freshness_judge_node
from miot_harness.agents.synthesizer import synthesizer_node
from miot_harness.config import HarnessSettings
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.provenance import ProvenanceEntry, ProvenanceLog
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.data_graph import instrument_model
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.node_lifecycle import wrap_node_with_lifecycle
from miot_harness.runtime.plan import DataEvidence, DataState, DataStep
from miot_harness.runtime.router import HarnessRoute
from miot_harness.runtime.tenancy import tenancy_gate_decision
from miot_harness.tools.registry import ToolRegistry

# Appended to the shared synthesizer system prompt in agentic mode. Prior
# turns may carry tool data from earlier runs; without this rule the LLM
# treats those numbers as its own hallucinations and apologizes for them.
_AGENTIC_SYNTH_EXTRA_RULES = """\
- Prior assistant turns in this conversation were produced by real
  curated tools. Treat their numbers, tables, and claims as
  authoritative evidence — do NOT claim you fabricated them.
"""


def _provenance_entry(
    *,
    ctx: HarnessContext,
    user_message: str,
    step: DataStep,
    evidence: DataEvidence,
) -> ProvenanceEntry:
    # Curated tools don't expose their rendered SQL; the canonical
    # `tool(args)` string keeps the (question, sql) tuple mineable by the
    # weekly curation pass either way.
    sql = evidence.output.get("sql") or f"{step.tool}({json.dumps(step.args, default=str)})"
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


def build_agentic_graph(
    *,
    settings: HarnessSettings,
    models: dict[str, BaseChatModel],
    provenance_log: ProvenanceLog | None,
    profile: DataSourceProfile,
    registry: ToolRegistry,
) -> Any:
    """Compile and return the LangGraph agentic StateGraph.

    `provenance_log` receives one entry per executed step (question, sql,
    rows, refreshed_at). Pass None for tests that don't need recording.
    """

    graph = StateGraph(DataState)
    max_turns = settings.agents_agentic_max_turns
    # Onboarding fallback for planning failures (Gap 4) — same curated
    # list canned mode shows; primitives stay out of user-facing copy.
    capabilities_hint = build_capabilities_summary(registry, profile=profile)

    def _make_event_buffer() -> tuple[list[HarnessEvent], Any]:
        buf: list[HarnessEvent] = []
        return buf, buf.append

    def _merge_events(delta: dict[str, Any], events: list[HarnessEvent]) -> dict[str, Any]:
        if events:
            existing = delta.get("_events") or []
            delta["_events"] = [*existing, *events]
        return delta

    async def tenancy_gate(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        decision = tenancy_gate_decision(
            ctx=ctx, route=HarnessRoute.DATA_AGENTIC, settings=settings, profile=profile
        )
        if not decision.allowed:
            return {"answer": decision.refusal_message}
        return {}

    async def planner(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        buf, progress = _make_event_buffer()
        delta = await agentic_planner_node(
            cast(dict[str, Any], state),
            registry=registry,
            model=instrument_model(
                models["planner"], "planner", ctx,
                progress=progress, span_prefix=profile.name,
            ),
            profile=profile,
            max_turns=max_turns,
        )
        return _merge_events(delta, buf)

    async def executor(state: DataState) -> dict[str, Any]:
        snapshot = cast(dict[str, Any], state)
        step: DataStep | None = snapshot.get("current_step")
        if step is None:
            # Defensive: routing should never send us here without a step.
            return {"next_action": "ready_to_synthesize"}
        ctx: HarnessContext = snapshot["ctx"]
        buf, progress = _make_event_buffer()
        delta = await invoke_step(
            step,
            ctx=ctx,
            registry=registry,
            settings=settings,
            progress=progress,
            profile=profile,
        )
        if "failure" in delta:
            # A failed tool call is feedback, not a dead end: record the
            # note for the planner (which sees failed_steps in its prompt
            # and adapts) and loop back instead of failing the whole run.
            # The turn cap bounds repeated failures.
            note = f"{step.tool}({json.dumps(step.args, default=str)}): {delta['failure']}"
            return _merge_events(
                {
                    "failed_steps": [note],
                    "current_step": None,
                    "next_action": None,
                },
                buf,
            )
        evidence: DataEvidence = delta["evidence"][0]
        if provenance_log is not None:
            provenance_log.append(
                _provenance_entry(
                    ctx=ctx,
                    user_message=snapshot.get("user_message", ""),
                    step=step,
                    evidence=evidence,
                )
            )
        return _merge_events(
            {
                **delta,  # evidence appended by the operator.add reducer
                "executed_steps": [step],
                "current_step": None,
                "next_action": "judge_freshness",
            },
            buf,
        )

    def freshness_judge(state: DataState) -> dict[str, Any]:
        buf, progress = _make_event_buffer()
        delta = freshness_judge_node(
            cast(dict[str, Any], state), settings=settings, progress=progress, profile=profile
        )
        # Agentic downgrade: in a multi-evidence exploration, one
        # refuse-zone snapshot must not dead-end the whole run (the canned
        # gate keeps refusing). The evidence is already marked
        # status=stale, the freshness.warning event was emitted, and the
        # synthesizer's per-status rules caveat the answer — so strip the
        # failure and let the planner keep going.
        failure = delta.get("failure") or ""
        if failure.startswith(f"{profile.display_name} snapshot is stale"):
            delta = {**delta, "failure": None, "next_action": None}
        return _merge_events(delta, buf)

    async def synthesizer(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        buf, progress = _make_event_buffer()
        delta = await synthesizer_node(
            cast(dict[str, Any], state),
            model=instrument_model(
                models["synthesizer"], "synthesizer", ctx,
                progress=progress, span_prefix=profile.name,
            ),
            progress=progress,
            settings=settings,
            profile=profile,
            extra_system_rules=_AGENTIC_SYNTH_EXTRA_RULES,
            capabilities_hint=capabilities_hint,
        )
        return _merge_events(delta, buf)

    async def critic(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        buf, progress = _make_event_buffer()
        delta = await critic_node(
            cast(dict[str, Any], state),
            settings=settings,
            model=instrument_model(
                models["critic"], "critic", ctx,
                progress=progress, span_prefix=profile.name,
            ),
            profile=profile,
        )
        return _merge_events(delta, buf)

    async def summarizer(state: DataState) -> dict[str, Any]:
        return {}

    graph.add_node(
        "tenancy_gate",
        wrap_node_with_lifecycle("tenancy_gate", tenancy_gate, "agentic"),
    )
    graph.add_node("planner", wrap_node_with_lifecycle("planner", planner, "agentic"))
    graph.add_node("executor", wrap_node_with_lifecycle("executor", executor, "agentic"))
    graph.add_node(
        "freshness_judge",
        wrap_node_with_lifecycle("freshness_judge", freshness_judge, "agentic"),
    )
    graph.add_node("synthesizer", wrap_node_with_lifecycle("synthesizer", synthesizer, "agentic"))
    graph.add_node("critic", wrap_node_with_lifecycle("critic", critic, "agentic"))
    graph.add_node("summarizer", wrap_node_with_lifecycle("summarizer", summarizer, "agentic"))

    graph.set_entry_point("tenancy_gate")

    def route_from_gate(state: DataState) -> str:
        if cast(dict[str, Any], state).get("answer"):
            return END
        return "planner"

    def route_from_planner(state: DataState) -> str:
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return "synthesizer"
        if snapshot.get("next_action") == "ready_to_synthesize":
            return "synthesizer"
        if snapshot.get("current_step") is not None:
            return "executor"
        # Defensive: a planner delta with neither step nor verdict still
        # terminates the run instead of looping.
        return "synthesizer"

    def route_from_executor(state: DataState) -> str:
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return "synthesizer"
        # Success sets next_action="judge_freshness"; a recorded tool
        # failure leaves it None → straight back to the planner (there is
        # no new evidence for the judge to look at).
        if snapshot.get("next_action") == "judge_freshness":
            return "freshness_judge"
        return "planner"

    def route_from_judge(state: DataState) -> str:
        # REFUSE-zone verdicts set `failure`; fresh/warn loop back to the
        # planner, which is the agentic analyst seat.
        if cast(dict[str, Any], state).get("failure"):
            return "synthesizer"
        return "planner"

    graph.add_conditional_edges("tenancy_gate", route_from_gate, {"planner": "planner", END: END})
    graph.add_conditional_edges(
        "planner",
        route_from_planner,
        {"synthesizer": "synthesizer", "executor": "executor"},
    )
    graph.add_conditional_edges(
        "executor",
        route_from_executor,
        {
            "synthesizer": "synthesizer",
            "freshness_judge": "freshness_judge",
            "planner": "planner",
        },
    )
    graph.add_conditional_edges(
        "freshness_judge",
        route_from_judge,
        {"synthesizer": "synthesizer", "planner": "planner"},
    )
    graph.add_edge("synthesizer", "critic")
    graph.add_edge("critic", "summarizer")
    graph.add_edge("summarizer", END)

    return graph.compile()
