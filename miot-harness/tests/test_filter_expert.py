from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.filter_expert import (
    build_tool_catalog,
    filter_expert_node,
)
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.plan import DataPlan, DataStep
from miot_harness.runtime.tool import HarnessTool  # noqa: F401
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

    catalog = build_tool_catalog(registry, profile=NEXO_PROFILE)

    assert "coordinador_centro_control" in catalog
    assert "coordinador_kpi_servicio" in catalog
    # Non-coordinador tools are excluded from this catalog
    assert "get_delivery_compliance_metrics" not in catalog


def test_build_tool_catalog_includes_layer_hint():
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary text"))
    catalog = build_tool_catalog(registry, profile=NEXO_PROFILE)
    assert "L1" in catalog
    assert "KPI summary text" in catalog


@pytest.mark.asyncio
async def test_filter_expert_produces_single_step():
    """Given a user message and a tool catalog, filter_expert returns a
    state update with a DataStep added to the plan."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary"))

    fake_response = json.dumps(
        {
            "intent": "fetch operational summary",
            "tool": "coordinador_centro_control",
            "args": {},
            "rationale": "broad question; L1 first",
        }
    )
    model = FakeListChatModel(responses=[fake_response])

    state: dict[str, Any] = {
        "user_message": "¿estado operativo de hoy?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }

    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )

    plan = update["plan"]
    assert isinstance(plan, DataPlan)
    assert len(plan.steps) == 1
    step = plan.steps[0]
    assert isinstance(step, DataStep)
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

    fake_response = json.dumps(
        {
            "intent": "drill into service 42",
            "tool": "coordinador_kpi_servicio",
            "args": {"p_servicio_id": 42},
            "rationale": "follow-up for failing service",
        }
    )
    model = FakeListChatModel(responses=[fake_response])

    existing_plan = DataPlan(
        steps=[
            DataStep(intent="initial", tool="coordinador_centro_control", args={}, rationale="r")
        ]
    )
    state = {
        "user_message": "and service 42?",
        "ctx": _ctx(),
        "plan": existing_plan,
        "pending_step_index": 1,
        "evidence": [],
        "turn_count": 1,
    }

    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    new_plan = update["plan"]

    assert len(new_plan.steps) == 2
    assert new_plan.steps[1].tool == "coordinador_kpi_servicio"
    assert new_plan.steps[1].args == {"p_servicio_id": 42}


@pytest.mark.asyncio
async def test_filter_expert_clears_next_action():
    """Regression: when invoked because previous turn had
    next_action='need_more_tools', filter_expert MUST clear next_action
    so the supervisor doesn't loop right back into this node."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI"))
    fake_response = json.dumps(
        {
            "intent": "x",
            "tool": "coordinador_centro_control",
            "args": {},
            "rationale": "r",
        }
    )
    model = FakeListChatModel(responses=[fake_response])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 1,
        "next_action": "need_more_tools",
    }
    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    assert update.get("next_action") is None


@pytest.mark.asyncio
async def test_filter_expert_handles_json_fenced_response():
    """Real Claude often wraps JSON in ```json ... ``` fences."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI"))
    fenced = (
        '```json\n'
        '{"intent": "x", "tool": "coordinador_centro_control", '
        '"args": {}, "rationale": "r"}\n'
        '```'
    )
    model = FakeListChatModel(responses=[fenced])
    state = {"user_message": "?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    assert "plan" in update
    assert update["plan"].steps[0].tool == "coordinador_centro_control"


@pytest.mark.asyncio
async def test_filter_expert_handles_plan_max_steps():
    """When DataPlan's max_length=4 cap is hit, fail soft → route to synth."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI"))
    fake_response = json.dumps(
        {
            "intent": "x",
            "tool": "coordinador_centro_control",
            "args": {},
            "rationale": "r",
        }
    )
    model = FakeListChatModel(responses=[fake_response])
    full_plan = DataPlan(
        steps=[
            DataStep(intent=f"i{i}", tool="coordinador_centro_control", args={}, rationale="r")
            for i in range(4)
        ]
    )
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "plan": full_plan,
        "pending_step_index": 4,
        "evidence": [],
        "turn_count": 4,
    }
    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    assert update.get("failure")
    assert update.get("next_action") == "ready_to_synthesize"


@pytest.mark.asyncio
async def test_filter_expert_refuses_non_coordinador_tool():
    """Defense: model could pick a non-Nexo tool that's in the registry."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI"))
    registry.register(_stub_tool("get_delivery_compliance_metrics", "non-Nexo"))
    fake_response = json.dumps(
        {
            "intent": "x",
            "tool": "get_delivery_compliance_metrics",
            "args": {},
            "rationale": "r",
        }
    )
    model = FakeListChatModel(responses=[fake_response])
    state = {"user_message": "?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    assert update.get("failure")
    assert "out-of-scope" in update["failure"] or "scope" in update["failure"].lower()


@pytest.mark.asyncio
async def test_filter_expert_emits_plan_created_event_on_first_step():
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI"))
    fake_response = json.dumps(
        {
            "intent": "x",
            "tool": "coordinador_centro_control",
            "args": {},
            "rationale": "r",
        }
    )
    model = FakeListChatModel(responses=[fake_response])
    state = {"user_message": "?", "ctx": _ctx(), "evidence": [], "turn_count": 0}
    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    events = update.get("_events") or []
    assert any(e.type == "plan.created" for e in events)


@pytest.mark.asyncio
async def test_filter_expert_refuses_unknown_tool():
    """If the model hallucinates a non-existent tool, the node sets a
    failure flag rather than passing the bad step downstream."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "L1"))

    fake_response = json.dumps(
        {
            "intent": "x",
            "tool": "coordinador_does_not_exist",
            "args": {},
            "rationale": "r",
        }
    )
    model = FakeListChatModel(responses=[fake_response])

    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }

    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    assert update.get("failure")


@pytest.mark.asyncio
async def test_filter_expert_non_object_json_is_malformed_step():
    """Valid JSON that isn't an object (e.g. "[]") must hit the
    malformed-step fallback, not raise AttributeError on payload.get."""
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary"))
    model = FakeListChatModel(responses=["[]"])

    state: dict[str, Any] = {
        "user_message": "¿estado operativo de hoy?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }
    update = await filter_expert_node(
        state, registry=registry, model=model, profile=NEXO_PROFILE
    )
    assert update.get("failure") == "filter_expert returned malformed step"
