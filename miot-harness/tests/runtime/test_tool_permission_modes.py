from __future__ import annotations

import pytest
from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import (
    PermissionDecision,
    PermissionMode,
    PermissionPolicy,
    PermissionResult,
    PermissionRule,
)
from miot_harness.runtime.tool import HarnessTool


class _In(BaseModel):
    x: int = 1


class _Out(BaseModel):
    ok: bool = True


def _ctx(policy: PermissionPolicy | None) -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id="acme", user_id="u", permission_policy=policy
    )


def _ask_tool(*, destructive: bool = False) -> HarnessTool[_In, _Out]:
    async def check(ctx: HarnessContext, _in: _In) -> PermissionResult:
        return PermissionResult.ask("needs approval")

    async def call(ctx: HarnessContext, _in: _In, progress) -> _Out:  # type: ignore[no-untyped-def]
        return _Out()

    return HarnessTool[_In, _Out](
        name="run_sql",
        description="t",
        input_model=_In,
        output_model=_Out,
        read_only=not destructive,
        destructive=destructive,
        check_permission=check,
        call=call,
    )


@pytest.mark.asyncio
async def test_bypass_auto_approves_and_emits_audit() -> None:
    events: list[HarnessEvent] = []
    tool = _ask_tool()
    out = await tool.invoke(
        _ctx(PermissionPolicy(mode=PermissionMode.BYPASS)), {"x": 1}, events.append
    )
    assert isinstance(out, _Out)
    types = [e.type for e in events]
    assert "approval.auto" in types
    assert "approval.requested" not in types


@pytest.mark.asyncio
async def test_auto_safe_approves_non_destructive_but_pauses_destructive() -> None:
    events: list[HarnessEvent] = []
    await _ask_tool(destructive=False).invoke(
        _ctx(PermissionPolicy(mode=PermissionMode.AUTO_SAFE)), {"x": 1}, events.append
    )
    assert "approval.auto" in [e.type for e in events]

    with pytest.raises(PermissionError):
        await _ask_tool(destructive=True).invoke(
            _ctx(PermissionPolicy(mode=PermissionMode.AUTO_SAFE)), {"x": 1}, [].append
        )


@pytest.mark.asyncio
async def test_deny_rule_refuses_before_check_permission() -> None:
    tool = _ask_tool()
    policy = PermissionPolicy(
        rules=[PermissionRule(tool="run_sql", decision=PermissionDecision.DENY)]
    )
    with pytest.raises(PermissionError):
        await tool.invoke(_ctx(policy), {"x": 1}, [].append)


@pytest.mark.asyncio
async def test_allow_rule_skips_pause() -> None:
    events: list[HarnessEvent] = []
    tool = _ask_tool()
    policy = PermissionPolicy(
        rules=[PermissionRule(tool="run_sql", decision=PermissionDecision.ALLOW)]
    )
    out = await tool.invoke(_ctx(policy), {"x": 1}, events.append)
    assert isinstance(out, _Out)
    assert "approval.requested" not in [e.type for e in events]


def _allow_tool() -> HarnessTool[_In, _Out]:
    """A tool whose own check_permission would ALLOW — used to prove an
    `ask` rule still forces a pause."""

    async def check(ctx: HarnessContext, _in: _In) -> PermissionResult:
        return PermissionResult.allow("read-only")

    async def call(ctx: HarnessContext, _in: _In, progress) -> _Out:  # type: ignore[no-untyped-def]
        return _Out()

    return HarnessTool[_In, _Out](
        name="run_sql",
        description="t",
        input_model=_In,
        output_model=_Out,
        read_only=True,
        destructive=False,
        check_permission=check,
        call=call,
    )


@pytest.mark.asyncio
async def test_ask_rule_forces_pause_over_allowing_check() -> None:
    # check_permission would ALLOW, but an `ask` rule forces the human-pause
    # decision. With no registry on the context (DEFAULT mode), the pause
    # path refuses — proving the rule changed behaviour rather than no-op'd.
    events: list[HarnessEvent] = []
    tool = _allow_tool()
    policy = PermissionPolicy(
        rules=[PermissionRule(tool="run_sql", decision=PermissionDecision.ASK)]
    )
    with pytest.raises(PermissionError):
        await tool.invoke(_ctx(policy), {"x": 1}, events.append)
    assert "approval.requested" in [e.type for e in events]


@pytest.mark.asyncio
async def test_deny_rule_not_escalatable_by_bypass() -> None:
    # The most critical invariant: a hard deny rule is honoured even under
    # BYPASS mode — auto-approval can never escalate past a deny.
    policy = PermissionPolicy(
        mode=PermissionMode.BYPASS,
        rules=[PermissionRule(tool="run_sql", decision=PermissionDecision.DENY)],
    )
    with pytest.raises(PermissionError):
        await _ask_tool().invoke(_ctx(policy), {"x": 1}, [].append)
