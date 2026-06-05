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

from collections.abc import Hashable
from typing import Any, cast

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
from miot_harness.datasource.provider import DataSourceProfile
from miot_harness.observability.callbacks import AgentTelemetryCallback
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.node_lifecycle import GraphLabel, wrap_node_with_lifecycle
from miot_harness.runtime.plan import DataState
from miot_harness.runtime.router import HarnessRoute
from miot_harness.runtime.tenancy import tenancy_gate_decision
from miot_harness.tools.registry import ToolRegistry


def instrument_model(
    model: BaseChatModel,
    agent_name: str,
    ctx: HarnessContext,
    *,
    progress: Any = None,
    span_prefix: str = "nexo",
) -> Any:
    """Wrap a chat model with a per-agent telemetry callback for this run.

    The callback emits one ``<span_prefix>.<agent>`` span per LLM call with
    full GenAI semconv attribution (tokens, cache split, cost), the internal
    ``modular.*`` attrs we group by, AND the ``langfuse.*`` attrs the
    Langfuse UI promotes to first-class filter columns (E10).

    ``span_prefix`` defaults to ``"nexo"`` so existing callers are unchanged.
    Pass ``profile.name`` when a profile is in scope.

    When `progress` is set, the callback ALSO emits a `usage.recorded`
    HarnessEvent per LLM call so SSE consumers (curl, miot-chat) see
    token counts as the run unfolds.

    Returns a `Runnable` proxy which is interface-compatible with
    `BaseChatModel.ainvoke` — the agent nodes only call that surface.
    """

    # `session_id` falls back to thread_id when no conversation_id is
    # set so one-shot requests still group under a session key.
    session_id = ctx.conversation_id or ctx.thread_id
    tags = [f"tenant:{ctx.tenant_id}", f"mode:{ctx.mode}", f"agent:{agent_name}"]
    cb = AgentTelemetryCallback(
        agent_name=agent_name,
        run_id=ctx.run_id,
        tenant_id=ctx.tenant_id,
        mode=ctx.mode,
        user_id=ctx.user_id,
        session_id=session_id,
        tags=tags,
        progress=progress,
        span_prefix=span_prefix,
    )
    return model.with_config(callbacks=[cb])


def _make_event_buffer() -> tuple[list[HarnessEvent], Any]:
    """Return (buffer, append) — nodes push events into the buffer, then
    return them in their state delta as `_events`. DataState declares
    `_events` with a list/operator.add reducer so events accumulate in
    order across supersteps without relying on in-place mutation
    of state (which is not part of the LangGraph contract).
    """
    buf: list[HarnessEvent] = []
    return buf, buf.append


async def _tenant_gate_node(
    state: dict[str, Any],
    *,
    settings: HarnessSettings,
    profile: DataSourceProfile,
) -> dict[str, Any]:
    """Defense-in-depth gate: the mode resolver should have already gated this,
    but the graph entry re-checks so a future direct-graph caller can't slip
    past with an off-lock datasource tenant.
    """
    ctx: HarnessContext = state["ctx"]
    decision = tenancy_gate_decision(
        ctx=ctx, route=HarnessRoute.DATA_QUERY, settings=settings, profile=profile
    )
    if not decision.allowed:
        # Skip every LLM call; supervisor sees `answer` set and ends.
        return {"answer": decision.refusal_message}
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


def build_data_graph(
    *,
    registry: ToolRegistry,
    settings: HarnessSettings,
    models: dict[str, BaseChatModel],
    profile: DataSourceProfile,
) -> Any:
    graph = StateGraph(DataState)
    # Graph label for node-lifecycle spans. For NEXO_PROFILE this is "nexo",
    # byte-identical to the former literal on the wire. GraphLabel is a
    # constrained Literal today; widening it to accept any profile.name is a
    # later-stage telemetry change, so we cast at this boundary for now.
    graph_label = cast(GraphLabel, profile.name)

    def _merge_events(delta: dict[str, Any], events: list[HarnessEvent]) -> dict[str, Any]:
        if events:
            existing = delta.get("_events") or []
            delta["_events"] = [*existing, *events]
        return delta

    async def _filter_expert(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        buf, progress = _make_event_buffer()
        delta = await filter_expert_node(
            cast(dict[str, Any], state),
            registry=registry,
            model=instrument_model(
                models["filter_expert"], "filter_expert", ctx,
                progress=progress, span_prefix=profile.name,
            ),
            profile=profile,
        )
        return _merge_events(delta, buf)

    async def _data_fetcher(state: DataState) -> dict[str, Any]:
        buf, progress = _make_event_buffer()
        delta = await data_fetcher_node(
            cast(dict[str, Any], state),
            registry=registry,
            settings=settings,
            progress=progress,
            profile=profile,
        )
        return _merge_events(delta, buf)

    def _freshness_judge(state: DataState) -> dict[str, Any]:
        buf, progress = _make_event_buffer()
        delta = freshness_judge_node(
            cast(dict[str, Any], state), settings=settings, progress=progress, profile=profile
        )
        return _merge_events(delta, buf)

    async def _domain_analyst(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        buf, progress = _make_event_buffer()
        delta = await domain_analyst_node(
            cast(dict[str, Any], state),
            model=instrument_model(
                models["domain_analyst"], "domain_analyst", ctx,
                progress=progress, span_prefix=profile.name,
            ),
            profile=profile,
        )
        return _merge_events(delta, buf)

    async def _synthesizer(state: DataState) -> dict[str, Any]:
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
        )
        return _merge_events(delta, buf)

    async def _critic(state: DataState) -> dict[str, Any]:
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

    async def _summarizer(state: DataState) -> dict[str, Any]:
        ctx: HarnessContext = cast(dict[str, Any], state)["ctx"]
        buf, progress = _make_event_buffer()
        delta = await summarizer_node(
            cast(dict[str, Any], state),
            model=instrument_model(
                models["summarizer"], "summarizer", ctx,
                progress=progress, span_prefix=profile.name,
            ),
        )
        return _merge_events(delta, buf)

    async def _tenant_gate(state: DataState) -> dict[str, Any]:
        return await _tenant_gate_node(
            cast(dict[str, Any], state), settings=settings, profile=profile
        )

    graph.add_node(
        "tenant_gate", wrap_node_with_lifecycle("tenant_gate", _tenant_gate, graph_label)
    )
    graph.add_node(
        "filter_expert",
        wrap_node_with_lifecycle("filter_expert", _filter_expert, graph_label),
    )
    graph.add_node(
        "data_fetcher", wrap_node_with_lifecycle("data_fetcher", _data_fetcher, graph_label)
    )
    graph.add_node(
        "freshness_judge",
        wrap_node_with_lifecycle("freshness_judge", _freshness_judge, graph_label),
    )
    graph.add_node(
        "domain_analyst",
        wrap_node_with_lifecycle("domain_analyst", _domain_analyst, graph_label),
    )
    graph.add_node(
        "synthesizer", wrap_node_with_lifecycle("synthesizer", _synthesizer, graph_label)
    )
    graph.add_node("critic", wrap_node_with_lifecycle("critic", _critic, graph_label))
    graph.add_node(
        "summarizer", wrap_node_with_lifecycle("summarizer", _summarizer, graph_label)
    )

    graph.set_entry_point("tenant_gate")

    def route(state: DataState) -> str:
        return _route(cast(dict[str, Any], state), settings)

    # Most nodes route via the supervisor; synthesizer always flows
    # through critic to END so the seat stays wired.
    _route_map: dict[Hashable, str] = {k: v for k, v in _ROUTE_MAP.items()}
    for source in (
        "tenant_gate",
        "filter_expert",
        "data_fetcher",
        "freshness_judge",
        "domain_analyst",
        "summarizer",
    ):
        graph.add_conditional_edges(source, route, _route_map)

    graph.add_edge("synthesizer", "critic")
    graph.add_edge("critic", END)

    return graph.compile()
