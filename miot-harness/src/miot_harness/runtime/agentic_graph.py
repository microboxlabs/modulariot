"""Agentic graph (plan 13, E6) — looser variant of `nexo_graph` for free
exploration of Coordinador data via the composable primitives.

Differences from the plan-execute graph:
- Turn cap is 12 (vs 8) — exploration is the whole point.
- Critic is ON by default. Composable primitives have more freedom, so
  the critic seat catches hallucinated joins or out-of-bounds reads.
- `tenancy_gate_node` refuses non-Mintral tenants BEFORE any LLM call.

Nodes wired in this iteration: ``tenancy_gate``, ``planner`` (stub —
turn counter only), ``synthesizer``, ``critic`` (stub — pass-through),
``summarizer`` (stub — no-op). The plan's executor, freshness_judge,
and domain_analyst nodes are NOT yet built here — they require the
planner Sonnet decision + composable-primitive invocation, which lands
under the F-phase wire-up once the supervisor consumes this graph (see
plan 13's "Files to modify · supervisor.py" entry). F3 covers the
behavioral validation against live models.
"""

from __future__ import annotations

from typing import Any, cast

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import BaseMessage, HumanMessage
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
        #
        # `prior_messages` is hydrated by the supervisor (E5) — the
        # eventual live planner will splice it between its system prompt
        # and the current user message, matching the filter_expert /
        # synthesizer pattern. Reading it from state here sets up the
        # seam; the stub doesn't invoke a model yet.
        snapshot = cast(dict[str, Any], state)
        _prior_messages = snapshot.get("prior_messages") or []  # noqa: F841
        turn_count = int(snapshot.get("turn_count", 0) or 0)
        if turn_count >= _AGENTIC_TURN_CAP:
            return {"failure": "agentic turn cap exceeded"}
        return {"turn_count": turn_count + 1}

    async def synthesizer(state: NexoState) -> dict[str, Any]:
        # Fire the synthesizer model. Includes `prior_messages` so multi-turn
        # agentic chats can reference earlier turns (E5 hydration) — without
        # this, the LLM sees only the current user message and responds
        # "I don't have context for 'that'" on any follow-up.
        snapshot = cast(dict[str, Any], state)
        if snapshot.get("failure"):
            return {"answer": "(no answer — see failure)"}
        model = models["synthesizer"]

        prior_messages = snapshot.get("prior_messages") or []
        messages: list[BaseMessage] = list(prior_messages)
        messages.append(HumanMessage(content=snapshot.get("user_message", "")))
        response = await model.ainvoke(messages)
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

    graph.add_conditional_edges("tenancy_gate", route_from_gate, {"planner": "planner", END: END})
    # Planner currently always falls through to synthesizer (failure path
    # uses the same edge so the synthesizer can surface the failure as an
    # answer). When the F-phase wire-up adds executor / freshness_judge /
    # domain_analyst nodes, swap this back to a `route_from_planner`
    # conditional edge with an expanded dict.
    graph.add_edge("planner", "synthesizer")
    graph.add_edge("synthesizer", "critic")
    graph.add_edge("critic", "summarizer")
    graph.add_edge("summarizer", END)

    # provenance_log is captured for the future executor node so it can
    # write `(question, sql, plan_cost, rows_returned, ...)` per
    # primitive invocation. Kept on the graph closure (not in state) so
    # it's not serialized into snapshots. Currently unused — the stub
    # planner doesn't call any primitives. The TODO is wiring it through
    # the executor in the F-phase supervisor integration.
    _ = provenance_log

    return graph.compile()
