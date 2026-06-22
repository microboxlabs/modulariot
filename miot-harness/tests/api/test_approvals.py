"""Approval flow — POST /runs/{run_id}/approvals/{approval_id}.

Contract:
- A tool whose check_permission returns "ask" emits approval.requested
  with an approval_id and blocks on the in-process registry.
- POST /runs/{id}/approvals/{aid} with {"decision": "approve"|"deny"}
  resolves the wait. 204 on success, 404 when the approval is unknown.
- "approve" lets the tool proceed (tool.started → tool.completed).
- "deny" emits tool.failed and raises PermissionError into the
  supervisor's failure path (run.failed).
"""

from __future__ import annotations

import asyncio
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from pydantic import BaseModel

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.approvals import ApprovalRegistry
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_resolve_unknown_approval_returns_404() -> None:
    """POST /runs/{id}/approvals/{aid} for an unknown approval_id (never
    requested, already resolved, or discarded) returns 404. The
    approval_id alone identifies the entry — the run_id is in the path
    for audit clarity, not for lookup.
    """

    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs/run_anything/approvals/missing_id",
            json={"decision": "approve"},
        )
    assert resp.status_code == 404


def test_resolve_rejects_unknown_decision() -> None:
    """Pydantic Literal rejects anything outside {approve, deny} with
    a 422 before the route handler runs.
    """

    app = create_app()
    with TestClient(app) as client:
        resp = client.post(
            "/runs/run_x/approvals/aid_x",
            json={"decision": "maybe"},
        )
    assert resp.status_code == 422


def test_resolve_unblocks_pending_approval() -> None:
    """Smoke test the round trip directly through the registry: a tool
    awaiting an approval is unblocked when the endpoint posts a decision.
    """

    app = create_app()
    registry: ApprovalRegistry = app.state  # placeholder; replaced below

    with TestClient(app):
        registry = app.state.harness.approval_registry
        assert registry is not None

        # Register an approval scoped to a specific run; the TestClient
        # lifespan has put a real ApprovalRegistry on the harness, so we
        # can drive both sides.
        approval_id = "test_aid"
        event = registry.register(approval_id, "run_test")

        # Resolve via the HTTP endpoint. The path's run_id must match
        # the registered run_id; the registry refuses the mismatch.
        with TestClient(app) as client:
            resp = client.post(
                f"/runs/run_test/approvals/{approval_id}",
                json={"decision": "approve"},
            )
        assert resp.status_code == 204
        # The wait-event is now set; the decision is readable.
        assert event.is_set()
        decision = registry.decision(approval_id)
        assert decision is not None and decision.action == "approve"


def test_resolve_is_single_shot_first_writer_wins() -> None:
    """A second resolve() against the same approval is a no-op: the
    first decision sticks, the second returns False. This closes a
    race-window flip where the second call could otherwise overwrite
    `entry.decision` between the waiter's `event.wait()` returning and
    its `decision()` read.
    """

    registry = ApprovalRegistry()
    registry.register("aid_once", "run_x")

    assert registry.resolve("aid_once", "approve", "run_x") is True
    # Second resolve sees the event already set → no-op, no overwrite.
    assert registry.resolve("aid_once", "deny", "run_x") is False
    decision = registry.decision("aid_once")
    assert decision is not None and decision.action == "approve"


def test_resolve_with_mismatched_run_id_returns_404() -> None:
    """A leaked approval_id can't be weaponized against another run:
    POST against a different run_id than the one the approval was
    registered with returns 404 (collapsed with "unknown" so
    differential responses don't leak ownership).
    """

    app = create_app()
    with TestClient(app):
        registry = app.state.harness.approval_registry
        registry.register("attacker_target_aid", "run_owner")

        with TestClient(app) as client:
            resp = client.post(
                "/runs/run_attacker/approvals/attacker_target_aid",
                json={"decision": "approve"},
            )
        assert resp.status_code == 404
        # The approval is still pending — the mismatched call was a no-op.
        assert registry.decision("attacker_target_aid") is None


class _Inp(BaseModel):
    p: int = 1


class _Out(BaseModel):
    ok: bool = True


def _make_ctx(*, registry: ApprovalRegistry | None) -> HarnessContext:
    return HarnessContext(
        thread_id="t",
        tenant_id="demo",
        user_id="u",
        debug=False,
        approval_registry=registry,
    )


def _make_ask_tool() -> HarnessTool[_Inp, _Out]:
    async def _ask(_ctx: HarnessContext, _i: _Inp) -> PermissionResult:
        return PermissionResult(decision="ask", reason="needs approval")

    async def _call(_ctx, _i, _p):
        return _Out()

    return HarnessTool(
        name="ask_tool",
        description="d",
        input_model=_Inp,
        output_model=_Out,
        check_permission=_ask,
        call=_call,
    )


def test_ask_without_registry_emits_tool_failed_and_raises() -> None:
    """When no registry is wired (CLI / eval path), an `ask` permission
    behaves as deny: emits tool.failed, raises PermissionError, and
    never reaches tool.started.
    """

    tool = _make_ask_tool()
    events: list[HarnessEvent] = []

    with pytest.raises(PermissionError):
        asyncio.run(tool.invoke(_make_ctx(registry=None), {}, events.append))

    assert any(e.type == "approval.requested" for e in events)
    failed = [e for e in events if e.type == "tool.failed"]
    assert len(failed) == 1
    assert failed[0].data["error_type"] == "PermissionError"
    # No tool.started because the approval was never resolved.
    assert not [e for e in events if e.type == "tool.started"]


@pytest.mark.asyncio
async def test_ask_with_approve_decision_proceeds_to_completion() -> None:
    """A tool awaits the registry; when the decision is approve, the
    tool proceeds through tool.started → tool.completed.
    """

    registry = ApprovalRegistry()
    tool = _make_ask_tool()
    ctx = _make_ctx(registry=registry)
    events: list[HarnessEvent] = []

    invoke_task = asyncio.create_task(tool.invoke(ctx, {}, events.append))

    # Let the tool register and start awaiting.
    for _ in range(50):
        await asyncio.sleep(0)
        approval_events = [e for e in events if e.type == "approval.requested"]
        if approval_events:
            break
    else:
        pytest.fail("approval.requested was never emitted")
    approval_id = approval_events[0].data["approval_id"]

    # Resolve to approve — must pass the same run_id the tool registered
    # with (ctx.run_id is the canonical source).
    assert registry.resolve(approval_id, "approve", ctx.run_id) is True
    output = await asyncio.wait_for(invoke_task, timeout=1.0)
    assert output.ok is True

    types = [e.type for e in events]
    # Both legacy and new decision events are emitted during the compat window.
    assert "approval.requested" in types
    assert "decision.requested" in types
    assert "decision.resolved" in types
    assert "tool.started" in types
    assert "tool.completed" in types
    # Order: approval/decision events precede tool lifecycle events.
    assert types.index("approval.requested") < types.index("tool.started")
    assert types.index("decision.resolved") < types.index("tool.started")


@pytest.mark.asyncio
async def test_registry_entry_discarded_when_wait_is_cancelled() -> None:
    """If the surrounding run is cancelled while a tool is waiting on
    an approval (event.wait()), the registry entry must still be
    discarded — otherwise _pending grows unbounded across the process
    lifetime. The try/finally in HarnessTool.invoke guarantees this.
    """

    registry = ApprovalRegistry()
    tool = _make_ask_tool()
    ctx = _make_ctx(registry=registry)
    events: list[HarnessEvent] = []

    invoke_task = asyncio.create_task(tool.invoke(ctx, {}, events.append))

    for _ in range(50):
        await asyncio.sleep(0)
        approval_events = [e for e in events if e.type == "approval.requested"]
        if approval_events:
            break
    else:
        pytest.fail("approval.requested was never emitted")
    approval_id = approval_events[0].data["approval_id"]
    # The entry exists while the tool is awaiting.
    assert approval_id in registry._pending  # type: ignore[attr-defined]

    invoke_task.cancel()
    with pytest.raises(asyncio.CancelledError):
        await invoke_task

    # finally clause must have removed it.
    assert approval_id not in registry._pending  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_ask_with_deny_decision_emits_failed_and_raises() -> None:
    """A tool awaits the registry; when the decision is deny, the tool
    emits tool.failed and raises PermissionError.
    """

    registry = ApprovalRegistry()
    tool = _make_ask_tool()
    ctx = _make_ctx(registry=registry)
    events: list[HarnessEvent] = []

    invoke_task = asyncio.create_task(tool.invoke(ctx, {}, events.append))
    for _ in range(50):
        await asyncio.sleep(0)
        approval_events = [e for e in events if e.type == "approval.requested"]
        if approval_events:
            break
    approval_id = approval_events[0].data["approval_id"]

    registry.resolve(approval_id, "deny", ctx.run_id)
    with pytest.raises(PermissionError):
        await asyncio.wait_for(invoke_task, timeout=1.0)

    types = [e.type for e in events]
    assert "tool.failed" in types
    assert "tool.started" not in types
