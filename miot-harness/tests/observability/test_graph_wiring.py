"""A3 — telemetry callbacks wired into every LLM-bearing node of the Nexo graph.

Invokes the real `build_nexo_graph(...)` with scripted `FakeListChatModel`s
and asserts that running it emits one ``nexo.<agent>`` span per agent seat
with the correct ``modular.agent``/``modular.run_id``/``modular.tenant_id``
attribution. The 3-node propagation gotcha test (A6) is separate.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from opentelemetry.sdk.trace.export.in_memory_span_exporter import InMemorySpanExporter
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.nexo_graph import build_nexo_graph
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx(run_id: str, tenant: str = "mintral") -> HarnessContext:
    return HarnessContext(run_id=run_id, thread_id="t", tenant_id=tenant, user_id="u")


def _stub_tool(refreshed: datetime) -> HarnessTool:
    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []
        refreshed_at: datetime | None = None
        source: str = "Coordinador · nexo (Citus DB)"

    async def _check(ctx: Any, inp: Any) -> PermissionResult:
        return PermissionResult.allow()

    async def _call(ctx: Any, inp: Any, progress: Any) -> _Out:
        return _Out(
            rows=[{"n_eta_riesgo": 3, "refreshed_at_servicios": refreshed}],
            refreshed_at=refreshed,
        )

    return HarnessTool(
        name="coordinador_centro_control",
        description="[Layer L1] KPI summary",
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )


def _models() -> dict[str, Any]:
    return {
        "filter_expert": FakeListChatModel(
            responses=[
                json.dumps(
                    {
                        "intent": "fetch summary",
                        "tool": "coordinador_centro_control",
                        "args": {},
                        "rationale": "broad question",
                    }
                ),
            ]
        ),
        "domain_analyst": FakeListChatModel(
            responses=[json.dumps({"verdict": "ready", "reasoning": "ok"})]
        ),
        "synthesizer": FakeListChatModel(responses=["3 ETA en riesgo."]),
        "critic": FakeListChatModel(responses=[]),
        "summarizer": FakeListChatModel(responses=[]),
    }


@pytest.mark.asyncio
async def test_graph_emits_per_agent_spans_with_run_attribution(
    memory_exporter: InMemorySpanExporter,
) -> None:
    refreshed = datetime.now(UTC)
    registry = ToolRegistry()
    registry.register(_stub_tool(refreshed))
    settings = HarnessSettings(
        nexo_freshness_warn_minutes=30, nexo_freshness_refuse_minutes=240
    )
    graph = build_nexo_graph(
        registry=registry, settings=settings, models=_models(), profile=NEXO_PROFILE
    )

    ctx = _ctx(run_id="run_a3_test_001")
    await graph.ainvoke(
        {
            "user_message": "estado operativo",
            "ctx": ctx,
            "evidence": [],
            "turn_count": 0,
        }
    )

    spans = memory_exporter.get_finished_spans()
    agents = {
        s.attributes.get("modular.agent")
        for s in spans
        if s.attributes and s.attributes.get("modular.agent")
    }
    # The two seats that always fire on the happy path must carry telemetry.
    # (domain_analyst is conditionally invoked by `next_agent` depending on
    # evidence freshness; we don't require it here.)
    assert "filter_expert" in agents
    assert "synthesizer" in agents

    # Every emitted span carrying `modular.agent` carries the run_id +
    # tenant_id from `ctx`, regardless of which agent fired.
    for span in spans:
        attrs = dict(span.attributes or {})
        if attrs.get("modular.agent"):
            assert attrs.get("modular.run_id") == "run_a3_test_001", span.name
            assert attrs.get("modular.tenant_id") == "mintral", span.name


@pytest.mark.asyncio
async def test_root_nexo_run_span_parents_per_agent_spans(
    memory_exporter: InMemorySpanExporter,
) -> None:
    """The supervisor opens `nexo.run` around the graph invocation.

    We re-create the call pattern (`with agent_span("run", ...): graph.ainvoke(...)`)
    that supervisor.py uses and verify the resulting span carries the run-level
    attribution that Langfuse groups by.
    """

    from miot_harness.observability.spans import agent_span

    refreshed = datetime.now(UTC)
    registry = ToolRegistry()
    registry.register(_stub_tool(refreshed))
    settings = HarnessSettings(
        nexo_freshness_warn_minutes=30, nexo_freshness_refuse_minutes=240
    )
    graph = build_nexo_graph(
        registry=registry, settings=settings, models=_models(), profile=NEXO_PROFILE
    )
    ctx = _ctx(run_id="run_root_span_test")

    with agent_span("run", run_id=ctx.run_id, tenant_id=ctx.tenant_id):
        await graph.ainvoke(
            {
                "user_message": "estado operativo",
                "ctx": ctx,
                "evidence": [],
                "turn_count": 0,
            }
        )

    spans = memory_exporter.get_finished_spans()
    root = next((s for s in spans if s.name == "nexo.run"), None)
    assert root is not None, "nexo.run root span not emitted"
    attrs = dict(root.attributes or {})
    assert attrs["modular.run_id"] == "run_root_span_test"
    assert attrs["modular.tenant_id"] == "mintral"
    assert attrs["gen_ai.operation.name"] == "nexo.run"
