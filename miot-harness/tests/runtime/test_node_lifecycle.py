"""Verifies the `wrap_node_with_lifecycle` decorator emits agent.started
and agent.completed correctly for all three exit_reason branches plus
the failure-by-exception path.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.node_lifecycle import wrap_node_with_lifecycle


def _make_state(**overrides: Any) -> dict[str, Any]:
    ctx = HarnessContext(thread_id="t", tenant_id="demo", user_id="u")
    return {"ctx": ctx, "turn_count": 2, **overrides}


def _run(node_fn, state):
    return asyncio.run(node_fn(state))


def _events_of_type(delta: dict[str, Any], evt_type: str) -> list[HarnessEvent]:
    return [e for e in delta["_events"] if e.type == evt_type]


def test_lifecycle_ok_branch_emits_started_then_completed_ok() -> None:
    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        return {"answer": "hi"}

    wrapped = wrap_node_with_lifecycle("synthesizer", node, "fake")
    delta = _run(wrapped, _make_state())

    assert delta["answer"] == "hi"
    started = _events_of_type(delta, "agent.started")[0]
    completed = _events_of_type(delta, "agent.completed")[0]
    assert started.data == {"agent": "synthesizer", "graph": "fake", "turn": 2}
    assert completed.data["agent"] == "synthesizer"
    assert completed.data["graph"] == "fake"
    assert completed.data["exit_reason"] == "ok"
    assert isinstance(completed.data["duration_ms"], int)


def test_lifecycle_failure_branch_overrides_next_action() -> None:
    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        return {"failure": "tunnel down", "next_action": "analyze"}

    wrapped = wrap_node_with_lifecycle("data_fetcher", node, "fake")
    delta = _run(wrapped, _make_state())

    completed = _events_of_type(delta, "agent.completed")[0]
    assert completed.data["exit_reason"] == "failure"


def test_lifecycle_next_action_branch() -> None:
    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        return {"next_action": "need_more_tools"}

    wrapped = wrap_node_with_lifecycle("freshness_judge", node, "fake")
    delta = _run(wrapped, _make_state())

    completed = _events_of_type(delta, "agent.completed")[0]
    assert completed.data["exit_reason"] == "next_action"


def test_lifecycle_preserves_node_events_in_order() -> None:
    inner_event = HarnessEvent(
        run_id="run_x", type="tool.started", message="inner", data={"tool": "t"}
    )

    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        return {"_events": [inner_event]}

    wrapped = wrap_node_with_lifecycle("filter_expert", node, "fake")
    delta = _run(wrapped, _make_state())

    types = [e.type for e in delta["_events"]]
    assert types == ["agent.started", "tool.started", "agent.completed"]


def test_lifecycle_handles_sync_node() -> None:
    def node(_state: dict[str, Any]) -> dict[str, Any]:
        return {}

    wrapped = wrap_node_with_lifecycle("critic", node, "agentic")
    delta = _run(wrapped, _make_state())

    assert _events_of_type(delta, "agent.started")
    assert _events_of_type(delta, "agent.completed")


def test_lifecycle_handles_empty_delta() -> None:
    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        return {}

    wrapped = wrap_node_with_lifecycle("summarizer", node, "fake")
    delta = _run(wrapped, _make_state())

    completed = _events_of_type(delta, "agent.completed")[0]
    assert completed.data["exit_reason"] == "ok"


def test_lifecycle_propagates_exception() -> None:
    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("boom")

    wrapped = wrap_node_with_lifecycle("planner", node, "agentic")
    with pytest.raises(RuntimeError, match="boom"):
        _run(wrapped, _make_state())


def test_lifecycle_attaches_boundary_events_on_exception() -> None:
    """When a node raises, both agent.started and a failure-flavored
    agent.completed are stashed on the exception so the supervisor's
    outer handler can drain them before run.failed.
    """
    async def node(_state: dict[str, Any]) -> dict[str, Any]:
        raise RuntimeError("kaboom")

    wrapped = wrap_node_with_lifecycle("filter_expert", node, "fake")
    with pytest.raises(RuntimeError, match="kaboom") as excinfo:
        _run(wrapped, _make_state())

    events = getattr(excinfo.value, "_harness_lifecycle_events", None)
    assert events is not None and len(events) == 2
    started, failed = events
    assert started.type == "agent.started"
    assert started.data == {
        "agent": "filter_expert",
        "graph": "fake",
        "turn": 2,
    }
    assert failed.type == "agent.completed"
    assert failed.data["agent"] == "filter_expert"
    assert failed.data["graph"] == "fake"
    assert failed.data["exit_reason"] == "failure"
    assert failed.data["error"] == "kaboom"
    assert isinstance(failed.data["duration_ms"], int)
