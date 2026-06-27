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
from miot_harness.agents.verifier import REPLAN, verify_node
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
    # Generic safe-query tools surface the rendered SQL they ran
    # (evidence.executed_sql); curated tools don't, so fall back to the
    # canonical `tool(args)` string. Either keeps the (question, sql) tuple
    # mineable by the weekly curation pass.
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
    # Phase 3 verify gate: intercept the planner's "finish" decision and check
    # the executed evidence actually fulfils the request (rules + optional LLM
    # judge), re-planning on a gap. When off, "finish" goes straight to synth.
    verify_enabled = settings.agents_agentic_verify_enabled
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
        # Explicit-plan mode: drain pending_steps head-first; legacy single-step
        # mode: run current_step. Either way we execute exactly one step per
        # turn (per-step events/provenance), but a plan keeps control here
        # (continue_plan) until the queue empties instead of round-tripping the
        # planner between steps.
        pending: list[DataStep] = list(snapshot.get("pending_steps") or [])
        step: DataStep | None = pending[0] if pending else snapshot.get("current_step")
        remaining = pending[1:] if pending else []
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
            # and adapts). Keep draining a plan if steps remain; otherwise
            # hand back to the planner. The turn cap bounds repeated failures.
            note = f"{step.tool}({json.dumps(step.args, default=str)}): {delta['failure']}"
            return _merge_events(
                {
                    "failed_steps": [note],
                    "current_step": None,
                    "pending_steps": remaining,
                    "next_action": "continue_plan" if remaining else None,
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
                "pending_steps": remaining,
                "next_action": "judge_freshness",
            },
            buf,
        )

    async def verify(state: DataState) -> dict[str, Any]:
        buf, progress = _make_event_buffer()
        delta = await verify_node(
            cast(dict[str, Any], state),
            model=models.get("verifier"),
            settings=settings,
            profile=profile,
            progress=progress,
        )
        return _merge_events(delta, buf)

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
    graph.add_node("verify", wrap_node_with_lifecycle("verify", verify, "agentic"))
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

    # The planner's "finish" decision routes to verify when the gate is on,
    # else straight to synthesis. Resolved once at build time.
    _finish_target = "verify" if verify_enabled else "synthesizer"

    def route_from_planner(state: DataState) -> str:
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return "synthesizer"
        if snapshot.get("next_action") == "ready_to_synthesize":
            return _finish_target
        # A plan (execute_plan) or a legacy single step both go to the executor.
        if snapshot.get("next_action") == "execute_plan" or snapshot.get("pending_steps"):
            return "executor"
        if snapshot.get("current_step") is not None:
            return "executor"
        # Defensive: a planner delta with neither step nor verdict still
        # terminates the run instead of looping.
        return "synthesizer"

    def route_from_executor(state: DataState) -> str:
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return "synthesizer"
        na = snapshot.get("next_action")
        # Success sets next_action="judge_freshness".
        if na == "judge_freshness":
            return "freshness_judge"
        # A failed step mid-plan (steps still queued) keeps draining the plan;
        # a failed lone step (no evidence, none queued) goes back to the planner.
        if na == "continue_plan":
            return "executor"
        return "planner"

    def route_from_judge(state: DataState) -> str:
        # REFUSE-zone verdicts set `failure`; fresh/warn continue. While a plan
        # is still draining, keep executing it; once drained, hand back to the
        # planner (the agentic analyst seat) to plan more or finish.
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return "synthesizer"
        if snapshot.get("pending_steps"):
            return "executor"
        return "planner"

    def route_from_verify(state: DataState) -> str:
        # A gap re-plans (bounded by replan_count); otherwise synthesize.
        if cast(dict[str, Any], state).get("next_action") == REPLAN:
            return "planner"
        return "synthesizer"

    graph.add_conditional_edges("tenancy_gate", route_from_gate, {"planner": "planner", END: END})
    graph.add_conditional_edges(
        "planner",
        route_from_planner,
        {"synthesizer": "synthesizer", "executor": "executor", "verify": "verify"},
    )
    graph.add_conditional_edges(
        "executor",
        route_from_executor,
        {
            "synthesizer": "synthesizer",
            "freshness_judge": "freshness_judge",
            "executor": "executor",
            "planner": "planner",
        },
    )
    graph.add_conditional_edges(
        "freshness_judge",
        route_from_judge,
        {"synthesizer": "synthesizer", "executor": "executor", "planner": "planner"},
    )
    graph.add_conditional_edges(
        "verify",
        route_from_verify,
        {"synthesizer": "synthesizer", "planner": "planner"},
    )
    graph.add_edge("synthesizer", "critic")
    graph.add_edge("critic", "summarizer")
    graph.add_edge("summarizer", END)

    return graph.compile()
