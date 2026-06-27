"""Agentic planner — one Sonnet seat per turn deciding call_tool vs final."""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from pydantic import BaseModel

from miot_harness.agents.agentic_planner import agentic_planner_node
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.plan import DataEvidence
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _stub_tool(name: str, description: str, *, kind: str = "curated") -> HarnessTool:
    class _In(BaseModel):
        pass

    class _Out(BaseModel):
        rows: list[dict[str, Any]] = []

    async def _check(ctx: HarnessContext, inp: Any) -> PermissionResult:
        return PermissionResult.allow()

    async def _call(ctx: HarnessContext, inp: Any, progress: Any) -> Any:
        return _Out(rows=[])

    return HarnessTool(
        name=name,
        description=description,
        input_model=_In,
        output_model=_Out,
        check_permission=_check,
        call=_call,
        kind=kind,
    )


def _registry() -> ToolRegistry:
    registry = ToolRegistry()
    registry.register(_stub_tool("coordinador_centro_control", "[Layer L1] KPI summary"))
    registry.register(
        _stub_tool("nexo_select", "Bounded SELECT against nexo.dx_*", kind="primitive")
    )
    return registry


def _state(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "user_message": "¿estado operativo?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }
    base.update(overrides)
    return base


def _evidence() -> DataEvidence:
    return DataEvidence(
        step_id="step_1",
        tool="coordinador_centro_control",
        source="src",
        refreshed_at=datetime.now(UTC),
        output={"rows": [{"a": 1}]},
        sample_size=1,
        is_stale=False,
    )


@pytest.mark.asyncio
async def test_call_tool_action_produces_current_step() -> None:
    response = json.dumps(
        {
            "action": "call_tool",
            "tool": "coordinador_centro_control",
            "args": {},
            "intent": "fetch KPIs",
            "rationale": "broad question",
        }
    )
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    step = delta["current_step"]
    assert step is not None
    assert step.tool == "coordinador_centro_control"
    assert delta["turn_count"] == 1
    assert not delta.get("failure")


@pytest.mark.asyncio
async def test_plan_action_produces_pending_steps() -> None:
    response = json.dumps(
        {
            "action": "plan",
            "steps": [
                {"tool": "coordinador_centro_control", "args": {}, "intent": "kpis",
                 "rationale": "overview"},
                {"tool": "nexo_select", "args": {"table": "nexo.dx_servicios"},
                 "intent": "rows", "rationale": "enumerate"},
            ],
        }
    )
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    steps = delta["pending_steps"]
    assert [s.tool for s in steps] == ["coordinador_centro_control", "nexo_select"]
    assert delta["next_action"] == "execute_plan"
    assert delta["turn_count"] == 1
    assert delta["current_step"] is None
    assert not delta.get("failure")


@pytest.mark.asyncio
async def test_plan_with_invalid_step_fails() -> None:
    response = json.dumps(
        {
            "action": "plan",
            "steps": [
                {"tool": "coordinador_centro_control", "args": {}},
                {"tool": "coordinador_inventada", "args": {}},  # unknown
            ],
        }
    )
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert "unknown tool" in delta["failure"]
    assert not delta.get("pending_steps")


@pytest.mark.asyncio
async def test_empty_plan_fails() -> None:
    response = json.dumps({"action": "plan", "steps": []})
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert "empty or malformed plan" in delta["failure"]


@pytest.mark.asyncio
async def test_verification_gap_is_surfaced_to_planner() -> None:
    captured: list[list[Any]] = []

    class _Recording(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    response = json.dumps({"action": "final", "reasoning": "done"})
    delta = await agentic_planner_node(
        _state(
            evidence=[_evidence()],
            verification_gap="solo corriste un grep; falta el COUNT real",
        ),
        registry=_registry(),
        model=_Recording(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    human = [m for m in captured[0] if isinstance(m, HumanMessage)][-1]
    assert "INCOMPLETE" in human.content
    assert "falta el COUNT real" in human.content
    # The gap is consumed: cleared from the delta so a later turn (e.g. the
    # post-execution finish turn) doesn't re-see a stale note.
    assert delta["verification_gap"] is None


@pytest.mark.asyncio
async def test_plan_and_call_tool_clear_verification_gap() -> None:
    plan = json.dumps(
        {"action": "plan", "steps": [{"tool": "coordinador_centro_control", "args": {}}]}
    )
    plan_delta = await agentic_planner_node(
        _state(verification_gap="gap"),
        registry=_registry(),
        model=FakeListChatModel(responses=[plan]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert plan_delta["verification_gap"] is None

    call = json.dumps(
        {"action": "call_tool", "tool": "coordinador_centro_control", "args": {}}
    )
    call_delta = await agentic_planner_node(
        _state(verification_gap="gap"),
        registry=_registry(),
        model=FakeListChatModel(responses=[call]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert call_delta["verification_gap"] is None


@pytest.mark.asyncio
async def test_primitive_tool_is_in_scope() -> None:
    response = json.dumps(
        {
            "action": "call_tool",
            "tool": "nexo_select",
            "args": {"table": "nexo.dx_servicios"},
            "intent": "explore",
            "rationale": "no curated tool covers it",
        }
    )
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert delta["current_step"].tool == "nexo_select"
    assert not delta.get("failure")


@pytest.mark.asyncio
async def test_final_action_routes_to_synthesizer() -> None:
    response = json.dumps({"action": "final", "reasoning": "evidence suffices"})
    delta = await agentic_planner_node(
        _state(evidence=[_evidence()]),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert delta["next_action"] == "ready_to_synthesize"
    assert not delta.get("failure")


@pytest.mark.asyncio
async def test_malformed_response_with_evidence_degrades_to_synthesis() -> None:
    delta = await agentic_planner_node(
        _state(evidence=[_evidence()]),
        registry=_registry(),
        model=FakeListChatModel(responses=["I think we should look at services"]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert delta["next_action"] == "ready_to_synthesize"
    assert not delta.get("failure")


@pytest.mark.asyncio
async def test_malformed_response_without_evidence_fails() -> None:
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=["not json"]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert "malformed" in delta["failure"]


@pytest.mark.asyncio
async def test_out_of_scope_tool_fails() -> None:
    """Tools that are neither curated (profile prefix) nor primitives —
    e.g. storytelling tools sharing the registry — are out of scope."""
    registry = _registry()
    registry.register(_stub_tool("create_story_draft", "Storytelling draft", kind="general"))
    response = json.dumps(
        {
            "action": "call_tool",
            "tool": "create_story_draft",
            "args": {},
            "intent": "x",
            "rationale": "y",
        }
    )
    delta = await agentic_planner_node(
        _state(),
        registry=registry,
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert "out-of-scope" in delta["failure"]


@pytest.mark.asyncio
async def test_unknown_tool_fails() -> None:
    response = json.dumps(
        {
            "action": "call_tool",
            "tool": "coordinador_inventada",
            "args": {},
            "intent": "x",
            "rationale": "y",
        }
    )
    delta = await agentic_planner_node(
        _state(),
        registry=_registry(),
        model=FakeListChatModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert "unknown tool" in delta["failure"]


@pytest.mark.asyncio
async def test_turn_cap_with_evidence_synthesizes() -> None:
    """At the cap with evidence in hand → answer with what we have; the
    model must NOT be invoked (empty responses would IndexError)."""
    delta = await agentic_planner_node(
        _state(evidence=[_evidence()], turn_count=12),
        registry=_registry(),
        model=FakeListChatModel(responses=[]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert delta["next_action"] == "ready_to_synthesize"
    assert not delta.get("failure")


@pytest.mark.asyncio
async def test_turn_cap_without_evidence_fails() -> None:
    delta = await agentic_planner_node(
        _state(turn_count=12),
        registry=_registry(),
        model=FakeListChatModel(responses=[]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    assert "turn cap" in delta["failure"]


@pytest.mark.asyncio
async def test_prior_messages_spliced_into_prompt() -> None:
    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    prior = [
        HumanMessage(content="¿estado del coordinador hoy?"),
        AIMessage(content="1822 críticos."),
    ]
    response = json.dumps({"action": "final", "reasoning": "done"})
    await agentic_planner_node(
        _state(prior_messages=prior, evidence=[_evidence()]),
        registry=_registry(),
        model=_RecordingModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    sent = captured[0]
    assert isinstance(sent[0], SystemMessage)
    assert isinstance(sent[1], HumanMessage)
    assert sent[1].content == "¿estado del coordinador hoy?"
    assert isinstance(sent[2], AIMessage)
    # Current question (with evidence context) is last.
    assert isinstance(sent[-1], HumanMessage)
    assert "¿estado operativo?" in sent[-1].content


@pytest.mark.asyncio
async def test_planner_prompt_lists_curated_and_primitive_catalogs() -> None:
    captured: list[list[Any]] = []

    class _RecordingModel(FakeListChatModel):
        async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
            captured.append(list(input))
            return await super().ainvoke(input, *args, **kwargs)

    response = json.dumps({"action": "final", "reasoning": "done"})
    await agentic_planner_node(
        _state(evidence=[_evidence()]),
        registry=_registry(),
        model=_RecordingModel(responses=[response]),
        profile=NEXO_PROFILE,
        max_turns=12,
    )
    system = captured[0][0].content
    assert "coordinador_centro_control" in system
    assert "nexo_select" in system
