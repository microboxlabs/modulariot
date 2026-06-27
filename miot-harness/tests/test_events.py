from __future__ import annotations

from typing import get_args

from miot_harness.runtime.events import HarnessEvent, HarnessEventType


def test_event_type_includes_nexo_literals():
    members = set(get_args(HarnessEventType))
    expected_new = {
        "plan.created",
        "agent.turn",
        "tool.failed",
        "freshness.warning",
        "answer.completed",
    }
    assert expected_new.issubset(members)


def test_event_type_includes_rich_streaming_literals():
    """Pins the rich-streaming event surface (plan: SSE thinking + agent + tool I/O)."""
    members = set(get_args(HarnessEventType))
    expected_rich = {
        "agent.started",
        "agent.completed",
        "thinking.delta",
        "thinking.completed",
        "usage.recorded",
    }
    assert expected_rich.issubset(members)


def test_event_type_full_set_is_pinned():
    """Guards against silent drift. If you add a literal, update this set."""
    members = set(get_args(HarnessEventType))
    expected = {
        "run.started",
        "route.selected",
        "tool.started",
        "tool.completed",
        "tool.failed",
        "approval.requested",
        "approval.auto",
        "decision.requested",
        "decision.resolved",
        "steering.mode_denied",
        "steering.injected",
        "artifact.created",
        "plan.created",
        "agent.turn",
        "agent.started",
        "agent.completed",
        "thinking.delta",
        "thinking.completed",
        "usage.recorded",
        "freshness.warning",
        "answer.completed",
        "run.completed",
        "run.failed",
        "run.interrupted",
    }
    assert members == expected


def test_event_types_json_matches_python_literal():
    """The shared event_types.json mirrors the Python Literal so the
    TypeScript client can validate against the same source. If you add
    a literal in Python, you must also update event_types.json; both
    sides fail loudly until they agree.
    """
    import json
    from pathlib import Path

    json_path = (
        Path(__file__).resolve().parent.parent
        / "src" / "miot_harness" / "runtime" / "event_types.json"
    )
    payload = json.loads(json_path.read_text())
    assert set(payload["event_types"]) == set(get_args(HarnessEventType))


def test_event_type_preserves_existing_literals():
    members = set(get_args(HarnessEventType))
    expected_existing = {
        "run.started",
        "route.selected",
        "tool.started",
        "tool.completed",
        "approval.requested",
        "artifact.created",
        "run.completed",
        "run.failed",
    }
    assert expected_existing.issubset(members)


def test_event_has_seq_field_default_zero():
    event = HarnessEvent(run_id="run_x", type="run.started", message="hi")
    assert event.seq == 0


def test_event_seq_settable():
    event = HarnessEvent(run_id="run_x", type="run.started", message="hi", seq=42)
    assert event.seq == 42


def test_event_seq_must_be_int():
    import pytest
    from pydantic import ValidationError

    with pytest.raises(ValidationError):
        HarnessEvent(run_id="run_x", type="run.started", message="hi", seq="not-int")
