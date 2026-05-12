"""Agentic graph (plan 13, E6) — looser variant of `nexo_graph` for free
exploration of Coordinador data via the composable primitives.

Differences from the plan-execute graph:
- Planner runs on Sonnet (configurable). It can emit *multiple* steps
  including composable primitives (`nexo_select`, `nexo_grep`, etc.).
- Turn cap is 12 (vs 8) — exploration is the whole point.
- Critic is ON by default. Composable primitives have more freedom, so
  the critic seat catches hallucinated joins or out-of-bounds reads.
- `tenancy_gate_node` refuses non-Mintral tenants BEFORE any LLM call.

Nodes: tenancy_gate, planner, executor, freshness_judge, domain_analyst,
critic, synthesizer, summarizer.

The planner's actual "decide curated vs composable" logic needs a real
LLM to be useful (FakeListChatModel test fixtures cover the wiring,
not the decision quality). E2/E8/F3 cover the behavioral validation
against live models.
"""

from __future__ import annotations

from typing import Any, cast

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, StateGraph

from miot_harness.config import HarnessSettings
from miot_harness.observability.provenance import ProvenanceLog
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.plan import NexoState
from miot_harness.runtime.router import HarnessRoute
from miot_harness.runtime.tenancy import tenancy_gate_decision

_AGENTIC_TURN_CAP = 12


def build_agentic_graph(
    *,
    settings: HarnessSettings,
    models: dict[str, BaseChatModel],
    provenance_log: ProvenanceLog | None,
) -> Any:
    """Compile and return the LangGraph agentic StateGraph.

    `provenance_log` is wired through so primitive invocations can write
    their (question, sql, plan_cost, rows, refreshed_at) tuple (see E4).
    Pass None for tests that don't need provenance recording.
    """

    graph = StateGraph(NexoState)

    async def tenancy_gate(state: NexoState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        decision = tenancy_gate_decision(
            ctx=ctx, route=HarnessRoute.NEXO_AGENTIC, settings=settings
        )
        if not decision.allowed:
            return {"answer": decision.refusal_message}
        return {}

    async def planner(state: NexoState) -> dict[str, Any]:
        # Stub planner: bumps turn count, exits if at cap. The real
        # planner (live LLM call) constructs a plan with curated tools
        # and/or composable primitives. Tests assert wiring; F3 covers
        # behavior with a real model.
        snapshot = cast(dict[str, Any], state)
        turn_count = int(snapshot.get("turn_count", 0) or 0)
        if turn_count >= _AGENTIC_TURN_CAP:
            return {"failure": "agentic turn cap exceeded"}
        return {"turn_count": turn_count + 1}

    async def synthesizer(state: NexoState) -> dict[str, Any]:
        # Fire the synthesizer model and return its content as the answer.
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return {"answer": "(no answer — see failure)"}
        model = models["synthesizer"]
        response = await model.ainvoke([{"role": "user", "content": snapshot.get("user_message", "")}])
        text = response.content if hasattr(response, "content") else str(response)
        return {"answer": text if isinstance(text, str) else str(text)}

    async def critic(state: NexoState) -> dict[str, Any]:
        # Critic ON by default in agentic mode (plan 12 §line 245). For
        # the wiring tests we approve and pass through.
        return {}

    async def summarizer(state: NexoState) -> dict[str, Any]:
        return {}

    graph.add_node("tenancy_gate", tenancy_gate)
    graph.add_node("planner", planner)
    graph.add_node("synthesizer", synthesizer)
    graph.add_node("critic", critic)
    graph.add_node("summarizer", summarizer)

    graph.set_entry_point("tenancy_gate")

    def route_from_gate(state: NexoState) -> str:
        if cast(dict[str, Any], state).get("answer"):
            return END
        return "planner"

    def route_from_planner(state: NexoState) -> str:
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return "synthesizer"  # synth surfaces the failure as an answer
        return "synthesizer"  # stub: skip executor for now; tests assert wiring

    graph.add_conditional_edges("tenancy_gate", route_from_gate, {"planner": "planner", END: END})
    graph.add_conditional_edges(
        "planner", route_from_planner, {"synthesizer": "synthesizer"}
    )
    graph.add_edge("synthesizer", "critic")
    graph.add_edge("critic", "summarizer")
    graph.add_edge("summarizer", END)

    # provenance_log is captured here so the executor (when implemented)
    # can write a row per primitive invocation. Kept on the graph
    # closure rather than in state so it's not serialized into snapshots.
    _ = provenance_log

    return graph.compile()
