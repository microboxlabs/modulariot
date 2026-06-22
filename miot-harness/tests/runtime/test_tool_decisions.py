from __future__ import annotations

import asyncio

import pytest
from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.control import Resolution, RunControlRegistry
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool


class _In(BaseModel):
    x: int = 1


class _Out(BaseModel):
    seen: int = 0


def _ask_tool() -> HarnessTool[_In, _Out]:
    async def check(ctx: HarnessContext, _in: _In) -> PermissionResult:
        return PermissionResult.ask("needs approval")

    async def call(ctx: HarnessContext, _in: _In, progress) -> _Out:  # type: ignore[no-untyped-def]
        return _Out(seen=_in.x)

    return HarnessTool[_In, _Out](
        name="run_sql", description="t", input_model=_In, output_model=_Out,
        read_only=True, destructive=False, check_permission=check, call=call,
    )


def _ctx(reg: RunControlRegistry) -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id="acme", user_id="u", run_id="r1", approval_registry=reg
    )


async def _resolve_after(
    reg: RunControlRegistry, events: list[HarnessEvent], res: Resolution
) -> None:
    for _ in range(200):
        ids = [e.data["decision_id"] for e in events if e.type == "decision.requested"]
        if ids:
            reg.resolve(ids[0], res, run_id="r1")
            return
        await asyncio.sleep(0.005)


@pytest.mark.asyncio
async def test_decision_requested_and_resolved_emitted() -> None:
    reg = RunControlRegistry()
    events: list[HarnessEvent] = []
    task = asyncio.create_task(_ask_tool().invoke(_ctx(reg), {"x": 1}, events.append))
    await _resolve_after(reg, events, Resolution(action="approve"))
    await task
    types = [e.type for e in events]
    assert "decision.requested" in types
    assert "approval.requested" in types  # legacy compat event still emitted
    assert "decision.resolved" in types
    req = next(e for e in events if e.type == "decision.requested")
    assert req.data["kind"] == "tool_approval" and "decision_id" in req.data


@pytest.mark.asyncio
async def test_edit_resolution_replaces_tool_input() -> None:
    reg = RunControlRegistry()
    events: list[HarnessEvent] = []
    task = asyncio.create_task(_ask_tool().invoke(_ctx(reg), {"x": 1}, events.append))
    await _resolve_after(reg, events, Resolution(action="edit", updated_input={"x": 42}))
    out = await task
    assert out.seen == 42  # tool ran with the edited input, not the original


@pytest.mark.asyncio
async def test_deny_resolution_raises() -> None:
    reg = RunControlRegistry()
    events: list[HarnessEvent] = []
    task = asyncio.create_task(_ask_tool().invoke(_ctx(reg), {"x": 1}, events.append))
    await _resolve_after(reg, events, Resolution(action="deny"))
    with pytest.raises(PermissionError):
        await task
