from __future__ import annotations

import asyncio

import pytest

from miot_harness.runtime.control import Resolution, RunControlRegistry


def test_approve_resolution_roundtrip() -> None:
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1", kind="tool_approval")
    assert reg.resolve("d1", Resolution(action="approve"), run_id="r1") is True
    res = reg.decision("d1")
    assert res is not None and res.action == "approve"


def test_resolve_accepts_plain_string_for_backcompat() -> None:
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1")  # kind defaults to tool_approval
    assert reg.resolve("d1", "approve", run_id="r1") is True  # legacy string
    res = reg.decision("d1")
    assert res is not None and res.action == "approve"


def test_edit_resolution_carries_updated_input() -> None:
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1", kind="tool_approval")
    assert reg.resolve("d1", Resolution(action="edit", updated_input={"x": 9}), run_id="r1") is True
    res = reg.decision("d1")
    assert res is not None and res.action == "edit" and res.updated_input == {"x": 9}


def test_choose_resolution_carries_option_id() -> None:
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1", kind="choice")
    reg.resolve("d1", Resolution(action="choose", option_id="opt-b"), run_id="r1")
    res = reg.decision("d1")
    assert res is not None and res.option_id == "opt-b"
    assert reg.kind("d1") == "choice"


def test_cross_run_resolve_refused() -> None:
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1", kind="tool_approval")
    assert reg.resolve("d1", Resolution(action="approve"), run_id="OTHER") is False


def test_single_shot_first_writer_wins() -> None:
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1", kind="tool_approval")
    assert reg.resolve("d1", Resolution(action="approve"), run_id="r1") is True
    assert reg.resolve("d1", Resolution(action="deny"), run_id="r1") is False
    res = reg.decision("d1")
    assert res is not None and res.action == "approve"


def test_unknown_decision_resolve_false_and_discard_safe() -> None:
    reg = RunControlRegistry()
    assert reg.resolve("missing", Resolution(action="approve"), run_id="r1") is False
    reg.discard("missing")  # must not raise


@pytest.mark.asyncio
async def test_register_event_unblocks_on_resolve() -> None:
    reg = RunControlRegistry()
    event = reg.register("d1", run_id="r1", kind="tool_approval")

    async def resolver() -> None:
        await asyncio.sleep(0.01)
        reg.resolve("d1", Resolution(action="approve"), run_id="r1")

    asyncio.create_task(resolver())
    await asyncio.wait_for(event.wait(), timeout=1.0)
    res = reg.decision("d1")
    assert res is not None and res.action == "approve"


# ── FIX 2: invalid string action returns False instead of raising ─────────────

def test_resolve_invalid_string_returns_false() -> None:
    """resolve() with a bogus action string must return False, not raise ValidationError."""
    reg = RunControlRegistry()
    reg.register("d1", run_id="r1")
    assert reg.resolve("d1", "garbage", run_id="r1") is False  # type: ignore[arg-type]
    assert reg.decision("d1") is None  # never resolved
