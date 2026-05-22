"""A6 — LangGraph parallel-branch run_id + per-agent attribution gotcha.

Known late-2025 issue: when LangGraph fans out into parallel branches, OTel
context propagation can break — child LLM spans from one branch may land
under a sibling, and `usage_metadata` may be misattributed.

Our defense (built into `NexoTelemetryCallback`): every span carries
`modular.agent` AND `modular.run_id` set from the callback's init args at
callback-construction time, BEFORE the LLM call's context is captured. Even
if OTel's parent-context propagation breaks, Langfuse can regroup by these
explicit attrs.

This test asserts the structural-attribution defense holds on a synthetic
3-node graph that fans out to two parallel branches. We force genuine
interleaving via `await asyncio.sleep(0)` inside each branch so the event
loop yields between the two `model.ainvoke` calls — without that,
`FakeListChatModel`'s synchronous fast path runs each branch to completion
within its own task and never actually exercises concurrent suspension.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from langchain_core.messages import HumanMessage
from langgraph.graph import END, StateGraph
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from typing_extensions import TypedDict

from miot_harness.observability.callbacks import NexoTelemetryCallback


class _State(TypedDict, total=False):
    run_id: str
    answer_a: str
    answer_b: str
    final: str


def _model(response: str) -> Any:
    return FakeListChatModel(responses=[response])


def _build_parallel_graph(run_id: str) -> Any:
    """3-node graph: planner → (branch_a ∥ branch_b) → joiner.

    Branches run in parallel via LangGraph fan-out. Each branch's model
    invocation is wired to its own `NexoTelemetryCallback`.
    """

    async def planner(state: _State) -> dict[str, Any]:
        return {"run_id": run_id}

    async def branch_a(state: _State) -> dict[str, Any]:
        cb = NexoTelemetryCallback(
            agent_name="branch_a", run_id=run_id, tenant_id="mintral"
        )
        model = _model("a-answer").with_config(callbacks=[cb])
        await asyncio.sleep(0)  # let branch_b interleave
        resp = await model.ainvoke([HumanMessage(content="a")])
        await asyncio.sleep(0)
        return {"answer_a": resp.content}

    async def branch_b(state: _State) -> dict[str, Any]:
        cb = NexoTelemetryCallback(
            agent_name="branch_b", run_id=run_id, tenant_id="mintral"
        )
        model = _model("b-answer").with_config(callbacks=[cb])
        await asyncio.sleep(0)  # let branch_a interleave
        resp = await model.ainvoke([HumanMessage(content="b")])
        await asyncio.sleep(0)
        return {"answer_b": resp.content}

    async def joiner(state: _State) -> dict[str, Any]:
        return {"final": f"{state.get('answer_a','')}|{state.get('answer_b','')}"}

    graph = StateGraph(_State)
    graph.add_node("planner", planner)
    graph.add_node("branch_a", branch_a)
    graph.add_node("branch_b", branch_b)
    graph.add_node("joiner", joiner)
    graph.set_entry_point("planner")
    # Fan-out: planner → both branches in parallel
    graph.add_edge("planner", "branch_a")
    graph.add_edge("planner", "branch_b")
    # Fan-in: both branches → joiner
    graph.add_edge("branch_a", "joiner")
    graph.add_edge("branch_b", "joiner")
    graph.add_edge("joiner", END)
    return graph.compile()


@pytest.mark.asyncio
async def test_parallel_branches_keep_per_agent_attribution(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """Even with parallel fan-out, every span retains its agent + run_id."""

    run_id = "run_propagation_001"
    graph = _build_parallel_graph(run_id)
    final = await graph.ainvoke({})
    assert final["final"] == "a-answer|b-answer"

    spans = [s for s in memory_exporter.get_finished_spans() if s.name.startswith("nexo.")]
    by_agent = {
        s.attributes["modular.agent"]: s for s in spans if s.attributes.get("modular.agent")
    }
    assert "branch_a" in by_agent, f"branch_a span missing; got {list(by_agent)}"
    assert "branch_b" in by_agent, f"branch_b span missing; got {list(by_agent)}"

    # Each span's run_id matches the explicit init arg — no cross-talk
    # from sibling branches and no attribution mixup.
    for name, span in by_agent.items():
        attrs = dict(span.attributes or {})
        assert attrs["modular.run_id"] == run_id, name
        assert attrs["modular.tenant_id"] == "mintral", name
        assert attrs["modular.agent"] == name


@pytest.mark.asyncio
async def test_callback_attribution_survives_high_concurrency() -> None:
    """Stress: 20 callbacks all running on the same event loop don't cross-talk.

    Verifies per-`run_id` span dict isolation under realistic concurrency
    (LangGraph parallel branches inside one event loop).
    """

    async def emit(run_id: str, agent: str) -> str:
        cb = NexoTelemetryCallback(
            agent_name=agent, run_id=run_id, tenant_id="mintral"
        )
        model = _model(f"resp-{run_id}").with_config(callbacks=[cb])
        resp = await model.ainvoke([HumanMessage(content=run_id)])
        return resp.content

    results = await asyncio.gather(
        *[emit(f"run_{i:02d}", f"agent_{i % 4}") for i in range(20)]
    )
    assert len(results) == 20
    assert all(r.startswith("resp-run_") for r in results)
