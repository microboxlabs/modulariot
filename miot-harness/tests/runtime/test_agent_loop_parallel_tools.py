import asyncio
from time import monotonic

import pytest
from langchain_core.messages import AIMessage, ToolMessage
from pydantic import BaseModel

from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunner
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool
from miot_harness.tools.registry import ToolRegistry
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel

_DELAY = 0.3


class _In(BaseModel):
    n: int = 0


class _Out(BaseModel):
    rows: list[dict] = []


class _Tracker:
    def __init__(self) -> None:
        self.running = 0
        self.peak = 0
        self.running_at_approval: list[int] = []


def _tool(name: str, tracker: _Tracker, *, read_only: bool = True) -> HarnessTool:
    async def _permission(ctx: HarnessContext, value: _In) -> PermissionResult:
        if read_only:
            return PermissionResult.allow("test")
        return PermissionResult.ask("changes data")

    async def _call(ctx: HarnessContext, value: _In, progress) -> _Out:
        tracker.running += 1
        tracker.peak = max(tracker.peak, tracker.running)
        try:
            await asyncio.sleep(_DELAY)
        finally:
            tracker.running -= 1
        return _Out(rows=[{"tool": name, "n": value.n}])

    return HarnessTool(
        name=name,
        description=name,
        input_model=_In,
        output_model=_Out,
        read_only=read_only,
        kind="curated",
        check_permission=_permission,
        call=_call,
    )


def _runner(model: ScriptedModel, tracker: _Tracker, concurrency: int = 4) -> AgentLoopRunner:
    registry = ToolRegistry.__new__(ToolRegistry)
    registry._tools = {}
    registry.register(_tool("fake_slow_a", tracker))
    registry.register(_tool("fake_slow_b", tracker))
    registry.register(_tool("fake_change", tracker, read_only=False))
    return AgentLoopRunner(
        model=model,
        registry=registry,
        settings=HarnessSettings(
            agents_agent_loop_max_turns=3, agents_agent_loop_tool_concurrency=concurrency
        ),
        profile=FAKE_PROFILE,
    )


def _call(name: str, call_id: str, n: int = 0) -> dict:
    return {"name": name, "args": {"n": n}, "id": call_id, "type": "tool_call"}


def _model(calls: list[dict]) -> ScriptedModel:
    return ScriptedModel([AIMessage(content="", tool_calls=calls), AIMessage(content="done")])


def _results(result: dict) -> list[ToolMessage]:
    return [m for m in result["messages"] if isinstance(m, ToolMessage)]


@pytest.mark.asyncio
async def test_read_only_calls_of_one_turn_overlap_and_keep_their_order() -> None:
    tracker = _Tracker()
    calls = [_call("fake_slow_a", "c1", 1), _call("fake_slow_b", "c2", 2)]
    events: list[HarnessEvent] = []
    ctx = HarnessContext(thread_id="t", tenant_id="acme", user_id="u", debug=False)

    started = monotonic()
    result = await _runner(_model(calls), tracker).run(
        user_message="q", ctx=ctx, prior_messages=[], progress=events.append
    )
    elapsed = monotonic() - started

    assert tracker.peak == 2
    assert elapsed < 1.6 * _DELAY
    assert [m.tool_call_id for m in _results(result)] == ["c1", "c2"]
    assert [e.tool for e in result["evidence"]] == ["fake_slow_a", "fake_slow_b"]
    started_ids = {e.data["call_id"] for e in events if e.type == "tool.started"}
    completed_ids = {e.data["call_id"] for e in events if e.type == "tool.completed"}
    assert len(started_ids) == 2
    assert started_ids == completed_ids


@pytest.mark.asyncio
async def test_a_concurrency_of_one_runs_the_calls_in_turn() -> None:
    tracker = _Tracker()
    calls = [_call("fake_slow_a", "c1"), _call("fake_slow_b", "c2")]
    ctx = HarnessContext(thread_id="t", tenant_id="acme", user_id="u", debug=False)

    await _runner(_model(calls), tracker, concurrency=1).run(
        user_message="q", ctx=ctx, prior_messages=[], progress=lambda _e: None
    )

    assert tracker.peak == 1


@pytest.mark.asyncio
async def test_a_call_that_asks_for_approval_runs_alone() -> None:
    tracker = _Tracker()
    approvals = ApprovalRegistry()
    ctx = HarnessContext(
        thread_id="t", tenant_id="acme", user_id="u", debug=False, approval_registry=approvals
    )

    def progress(event: HarnessEvent) -> None:
        if event.type == "approval.requested":
            tracker.running_at_approval.append(tracker.running)
            approvals.resolve(event.data["approval_id"], "approve", ctx.run_id)

    calls = [
        _call("fake_slow_a", "c1"),
        _call("fake_change", "c2"),
        _call("fake_slow_a", "c3"),
        _call("fake_slow_b", "c4"),
    ]
    result = await _runner(_model(calls), tracker).run(
        user_message="q", ctx=ctx, prior_messages=[], progress=progress
    )

    assert tracker.running_at_approval == [0]
    assert tracker.peak == 2
    assert [m.tool_call_id for m in _results(result)] == ["c1", "c2", "c3", "c4"]
    assert all(m.status != "error" for m in _results(result))
