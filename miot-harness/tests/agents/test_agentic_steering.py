"""Agentic planner — live steering channel (Steering Plan C, Task 4).

Covers the interrupt gate and operator-guidance injection at the planner
boundary: notes drained from the SteeringRegistry are spliced into the LLM
call, emit `steering.injected` events, and persist forward via prior_messages;
a cooperative interrupt short-circuits before the model is ever invoked.
"""

from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel
from langchain_core.messages import HumanMessage
from pydantic import BaseModel

from miot_harness.agents.agentic_planner import agentic_planner_node
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.plan import DataEvidence
from miot_harness.runtime.steering import SteeringRegistry
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry


def _ctx(*, with_registry: bool = True) -> tuple[HarnessContext, SteeringRegistry | None]:
    ctx = HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")
    if not with_registry:
        return ctx, None
    reg = SteeringRegistry()
    reg.open(ctx.run_id)
    ctx = ctx.model_copy(update={"steering_registry": reg})
    return ctx, reg


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


class _RecordingModel(FakeListChatModel):
    """Captures the messages passed to each ainvoke, and records call count."""

    def __init__(self, *, responses: list[str]) -> None:
        super().__init__(responses=responses)
        # FakeListChatModel is a pydantic model; stash state off-instance.
        _RecordingModel._captured = []  # type: ignore[attr-defined]
        _RecordingModel._calls = 0  # type: ignore[attr-defined]

    async def ainvoke(self, input, *args, **kwargs):  # type: ignore[override]
        _RecordingModel._captured.append(list(input))  # type: ignore[attr-defined]
        _RecordingModel._calls += 1  # type: ignore[attr-defined]
        return await super().ainvoke(input, *args, **kwargs)


def _state(ctx: HarnessContext, **overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "user_message": "¿estado operativo?",
        "ctx": ctx,
        "evidence": [],
        "turn_count": 0,
    }
    base.update(overrides)
    return base


@pytest.mark.asyncio
async def test_steer_note_injected_into_llm_and_events() -> None:
    ctx, reg = _ctx()
    assert reg is not None
    note = "focus on overdue tickets only"
    reg.push(ctx.run_id, note)

    model = _RecordingModel(responses=[json.dumps({"action": "final", "reasoning": "x"})])
    delta = await agentic_planner_node(
        _state(ctx),
        registry=_registry(),
        model=model,
        profile=NEXO_PROFILE,
        max_turns=12,
    )

    # Guidance HumanMessage reached the model.
    sent = _RecordingModel._captured[0]  # type: ignore[attr-defined]
    assert any(
        isinstance(m, HumanMessage) and note in m.content for m in sent
    ), "operator guidance not passed to model"

    # steering.injected event emitted.
    events = delta.get("_events", [])
    injected = [e for e in events if e.type == "steering.injected"]
    assert len(injected) == 1
    assert injected[0].message == note
    assert injected[0].data["note"] == note

    # Guidance persisted forward in prior_messages.
    persisted = delta.get("prior_messages", [])
    assert any(
        isinstance(m, HumanMessage) and note in m.content for m in persisted
    ), "guidance not persisted into prior_messages"


@pytest.mark.asyncio
async def test_steer_persists_and_emitted_on_call_tool_branch() -> None:
    ctx, reg = _ctx()
    assert reg is not None
    note = "use the primitive select"
    reg.push(ctx.run_id, note)

    response = json.dumps(
        {
            "action": "call_tool",
            "tool": "coordinador_centro_control",
            "args": {},
            "intent": "fetch KPIs",
            "rationale": "broad question",
        }
    )
    model = _RecordingModel(responses=[response])
    delta = await agentic_planner_node(
        _state(ctx),
        registry=_registry(),
        model=model,
        profile=NEXO_PROFILE,
        max_turns=12,
    )

    # Took the call_tool branch.
    assert delta["current_step"].tool == "coordinador_centro_control"

    events = delta.get("_events", [])
    injected = [e for e in events if e.type == "steering.injected"]
    assert len(injected) == 1
    assert injected[0].message == note

    persisted = delta.get("prior_messages", [])
    assert any(isinstance(m, HumanMessage) and note in m.content for m in persisted)


@pytest.mark.asyncio
async def test_interrupt_with_evidence_routes_to_synthesis_without_model() -> None:
    ctx, reg = _ctx()
    assert reg is not None
    reg.interrupt(ctx.run_id)

    model = _RecordingModel(responses=[])
    delta = await agentic_planner_node(
        _state(ctx, evidence=[_evidence()]),
        registry=_registry(),
        model=model,
        profile=NEXO_PROFILE,
        max_turns=12,
    )

    assert delta["next_action"] == "ready_to_synthesize"
    assert delta["current_step"] is None
    events = delta.get("_events", [])
    assert any(e.type == "run.interrupted" for e in events)
    assert _RecordingModel._calls == 0  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_interrupt_without_evidence_fails_without_model() -> None:
    ctx, reg = _ctx()
    assert reg is not None
    reg.interrupt(ctx.run_id)

    model = _RecordingModel(responses=[])
    delta = await agentic_planner_node(
        _state(ctx),
        registry=_registry(),
        model=model,
        profile=NEXO_PROFILE,
        max_turns=12,
    )

    assert delta["failure"] == "run interrupted"
    events = delta.get("_events", [])
    assert any(e.type == "run.interrupted" for e in events)
    assert _RecordingModel._calls == 0  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_no_registry_behaves_as_before() -> None:
    ctx, reg = _ctx(with_registry=False)
    assert reg is None
    assert ctx.steering_registry is None

    model = _RecordingModel(responses=[json.dumps({"action": "final", "reasoning": "x"})])
    delta = await agentic_planner_node(
        _state(ctx, evidence=[_evidence()]),
        registry=_registry(),
        model=model,
        profile=NEXO_PROFILE,
        max_turns=12,
    )

    assert delta["next_action"] == "ready_to_synthesize"
    assert _RecordingModel._calls == 1  # type: ignore[attr-defined]
    events = delta.get("_events", [])
    assert not any(e.type == "steering.injected" for e in events)
    assert not any(e.type == "run.interrupted" for e in events)
    assert "prior_messages" not in delta
