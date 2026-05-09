from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.filter_expert import (
    build_tool_catalog,
    filter_expert_node,
)
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.plan import NexoPlan, NexoStep
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _stub_tool(name: str, description: str) -> HarnessTool:
    """Build a minimal HarnessTool fixture for catalog tests."""
    from pydantic import BaseModel

    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        pass

    async def _check(ctx, inp):
        from miot_harness.runtime.permissions import PermissionResult

        return PermissionResult.allow()

    async def _call(ctx, inp, progress):
        return _Out()

    return HarnessTool(
        name=name,
        description=description,
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
    )


def test_build_tool_catalog_includes_all_coordinador_tools():
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary"))
    registry.register(_stub_tool("coordinador_kpi_servicio", "[Layer L3] per-service KPI"))
    registry.register(_stub_tool("get_delivery_compliance_metrics", "non-Nexo"))

    catalog = build_tool_catalog(registry)

    assert "coordinador_centro_control" in catalog
    assert "coordinador_kpi_servicio" in catalog
    # Non-coordinador tools are excluded from this catalog
    assert "get_delivery_compliance_metrics" not in catalog


def test_build_tool_catalog_includes_layer_hint():
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary text"))
    catalog = build_tool_catalog(registry)
    assert "L1" in catalog
    assert "KPI summary text" in catalog


@pytest.mark.asyncio
async def test_filter_expert_produces_single_step():
    """Given a user message and a tool catalog, filter_expert returns a
    state update with a NexoStep added to the plan."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary"))

    fake_response = json.dumps({
        "intent": "fetch operational summary",
        "tool": "coordinador_centro_control",
        "args": {},
        "rationale": "broad question; L1 first",
    })
    model = FakeListChatModel(responses=[fake_response])

    state: dict[str, Any] = {
        "user_message": "¿estado operativo de hoy?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }

    update = await filter_expert_node(state, registry=registry, model=model)

    plan = update["plan"]
    assert isinstance(plan, NexoPlan)
    assert len(plan.steps) == 1
    step = plan.steps[0]
    assert isinstance(step, NexoStep)
    assert step.tool == "coordinador_centro_control"
    assert step.intent
    assert step.rationale
    assert update.get("next_action") in (None, "")  # supervisor routes by pending_step_index


@pytest.mark.asyncio
async def test_filter_expert_appends_to_existing_plan():
    """When called again (analyst said 'need more tools'), the new step
    is appended to the existing plan rather than replacing it."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_kpi_servicio", "[Layer L3] per-service"))

    fake_response = json.dumps({
        "intent": "drill into service 42",
        "tool": "coordinador_kpi_servicio",
        "args": {"p_servicio_id": 42},
        "rationale": "follow-up for failing service",
    })
    model = FakeListChatModel(responses=[fake_response])

    existing_plan = NexoPlan(
        steps=[NexoStep(intent="initial", tool="coordinador_centro_control", args={}, rationale="r")]
    )
    state = {
        "user_message": "and service 42?",
        "ctx": _ctx(),
        "plan": existing_plan,
        "pending_step_index": 1,
        "evidence": [],
        "turn_count": 1,
    }

    update = await filter_expert_node(state, registry=registry, model=model)
    new_plan = update["plan"]

    assert len(new_plan.steps) == 2
    assert new_plan.steps[1].tool == "coordinador_kpi_servicio"
    assert new_plan.steps[1].args == {"p_servicio_id": 42}


@pytest.mark.asyncio
async def test_filter_expert_refuses_unknown_tool():
    """If the model hallucinates a non-existent tool, the node sets a
    failure flag rather than passing the bad step downstream."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "L1"))

    fake_response = json.dumps({
        "intent": "x",
        "tool": "coordinador_does_not_exist",
        "args": {},
        "rationale": "r",
    })
    model = FakeListChatModel(responses=[fake_response])

    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }

    update = await filter_expert_node(state, registry=registry, model=model)
    assert update.get("failure")
