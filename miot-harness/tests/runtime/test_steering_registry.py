from __future__ import annotations

from miot_harness.runtime.steering import SteeringRegistry


def test_push_then_drain_returns_notes_then_empty() -> None:
    reg = SteeringRegistry()
    reg.open("r1")
    assert reg.push("r1", "first") is True
    assert reg.drain("r1") == ["first"]
    assert reg.drain("r1") == []  # already drained


def test_multiple_pushes_accumulate_and_drain_clears() -> None:
    reg = SteeringRegistry()
    reg.open("r1")
    reg.push("r1", "a")
    reg.push("r1", "b")
    reg.push("r1", "c")
    assert reg.drain("r1") == ["a", "b", "c"]
    assert reg.drain("r1") == []


def test_unknown_run_is_all_noops() -> None:
    reg = SteeringRegistry()
    assert reg.push("nope", "x") is False
    assert reg.interrupt("nope") is False
    assert reg.drain("nope") == []
    assert reg.is_interrupted("nope") is False


def test_interrupt_sets_flag_and_open_resets_it() -> None:
    reg = SteeringRegistry()
    reg.open("r1")
    assert reg.is_interrupted("r1") is False
    assert reg.interrupt("r1") is True
    assert reg.is_interrupted("r1") is True
    reg.open("r1")  # fresh channel resets the flag
    assert reg.is_interrupted("r1") is False


def test_close_discards_channel() -> None:
    reg = SteeringRegistry()
    reg.open("r1")
    reg.interrupt("r1")
    reg.close("r1")
    assert reg.push("r1", "x") is False
    assert reg.is_interrupted("r1") is False


def test_channel_survives_drain() -> None:
    reg = SteeringRegistry()
    reg.open("r1")
    reg.push("r1", "first")
    assert reg.drain("r1") == ["first"]
    reg.push("r1", "second")
    assert reg.drain("r1") == ["second"]
