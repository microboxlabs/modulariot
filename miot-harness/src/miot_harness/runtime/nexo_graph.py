"""LangGraph wiring for the Nexo conversational graph (staged Option C).

Node layout::

    tenant_gate  →  filter_expert  →  data_fetcher  →  freshness_judge
                          ↑                                     │
                          └────────── (need_more) ──────────────┤
                                                                ↓
                                                          domain_analyst
                                                                │
                                          (need_more)           │
                          ┌─────────────────┐                   │
                          ↑                 │                   ↓
                          │           synthesizer  ←──── (ready_to_synth)
                          │                 │
                          │             critic (off in v1)
                          │                 │
                          │                 ↓
                          │                END

Routing comes from `next_agent(state, settings)` (the rule-based
supervisor). Synthesizer always flows through critic to END so the
critic seat is wired even when disabled.
"""

from __future__ import annotations

from typing import Any

from langchain_core.language_models import BaseChatModel
from langgraph.graph import END, StateGraph

from miot_harness.agents.critic import critic_node
from miot_harness.agents.data_fetcher import data_fetcher_node
from miot_harness.agents.domain_analyst import domain_analyst_node
from miot_harness.agents.filter_expert import filter_expert_node
from miot_harness.agents.freshness_judge import freshness_judge_node
from miot_harness.agents.summarizer import summarizer_node
from miot_harness.agents.supervisor import next_agent
from miot_harness.agents.synthesizer import synthesizer_node
from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import NexoState
from miot_harness.tools.registry import ToolRegistry


def _make_progress_collector(state: dict[str, Any]):
    """Each node call collects events into state['_events'] (free-form
    list, not part of the typed NexoState contract). The supervisor /
    run record can drain this in the wiring layer."""
    sink: list[HarnessEvent] = state.setdefault("_events", [])  # type: ignore[arg-type]
    return sink.append


async def _tenant_gate_node(state: dict[str, Any], *, settings: HarnessSettings) -> dict[str, Any]:
    ctx: HarnessContext = state["ctx"]
    if ctx.tenant_id != settings.nexo_tenant_lock:
        # Skip every LLM call; supervisor sees `answer` set and ends.
        return {
            "answer": "Coordinador is Mintral-only. I can't answer for other tenants.",
        }
    return {}


def _route(state: dict[str, Any], settings: HarnessSettings) -> str:
    return next_agent(state, settings)


_ROUTE_MAP = {
    "filter_expert": "filter_expert",
    "data_fetcher": "data_fetcher",
    "freshness_judge": "freshness_judge",
    "domain_analyst": "domain_analyst",
    "synthesizer": "synthesizer",
    "summarizer": "summarizer",
    "__end__": END,
}


def build_nexo_graph(
    *,
    registry: ToolRegistry,
    settings: HarnessSettings,
    models: dict[str, BaseChatModel],
):
    graph = StateGraph(NexoState)

    async def _filter_expert(state):
        return await filter_expert_node(state, registry=registry, model=models["filter_expert"])

    async def _data_fetcher(state):
        progress = _make_progress_collector(state)
        return await data_fetcher_node(
            state, registry=registry, settings=settings, progress=progress
        )

    def _freshness_judge(state):
        progress = _make_progress_collector(state)
        return freshness_judge_node(state, settings=settings, progress=progress)

    async def _domain_analyst(state):
        return await domain_analyst_node(state, model=models["domain_analyst"])

    async def _synthesizer(state):
        progress = _make_progress_collector(state)
        return await synthesizer_node(state, model=models["synthesizer"], progress=progress)

    async def _critic(state):
        return await critic_node(state, settings=settings, model=models["critic"])

    async def _summarizer(state):
        return await summarizer_node(state, model=models["summarizer"])

    async def _tenant_gate(state):
        return await _tenant_gate_node(state, settings=settings)

    graph.add_node("tenant_gate", _tenant_gate)
    graph.add_node("filter_expert", _filter_expert)
    graph.add_node("data_fetcher", _data_fetcher)
    graph.add_node("freshness_judge", _freshness_judge)
    graph.add_node("domain_analyst", _domain_analyst)
    graph.add_node("synthesizer", _synthesizer)
    graph.add_node("critic", _critic)
    graph.add_node("summarizer", _summarizer)

    graph.set_entry_point("tenant_gate")

    def route(state):
        return _route(state, settings)

    # Most nodes route via the supervisor; synthesizer always flows
    # through critic to END so the seat stays wired.
    for source in (
        "tenant_gate",
        "filter_expert",
        "data_fetcher",
        "freshness_judge",
        "domain_analyst",
        "summarizer",
    ):
        graph.add_conditional_edges(source, route, _ROUTE_MAP)

    graph.add_edge("synthesizer", "critic")
    graph.add_edge("critic", END)

    return graph.compile()
