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
