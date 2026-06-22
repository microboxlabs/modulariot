"""End-to-end test: edit-decision changes the arguments a tool executes with.

Approach (FALLBACK — see NOTE):
    The test drives `HarnessTool.invoke` directly (not through a full graph
    run), sharing the *same* `RunControlRegistry` instance that the FastAPI
    app owns.  Resolution is submitted through the real HTTP endpoint
    (`POST /runs/{run_id}/decisions/{decision_id}`).  The tool's `call`
    function captures the `_Inp` instance it actually ran with so we can
    assert the edited values reached it.

NOTE:
    What IS exercised:
    - The tool's `check_permission` → `ask` → `decision.requested` emission.
    - The tool's async wait on `RunControlRegistry.register`.
    - The HTTP `POST /runs/{run_id}/decisions/{decision_id}` endpoint with
      `{"resolution": "edit", "updated_input": {...}}`.
    - `RunControlRegistry.resolve` recording an `edit` Resolution.
    - `HarnessTool.invoke`'s edit branch: re-parsing the updated_input via
      the input model, re-running `check_permission`, and passing the
      re-parsed input to `call`.
    - The tool completing successfully with the EDITED input values (not the
      original ones).

    What is NOT exercised:
    - The full supervisor run path (`POST /runs:start` → graph → tool).
    - SSE streaming of the events while the decision is pending.

    A full-path test was not attempted because live in-flight SSE streaming
    requires async ASGI transport plumbing (see the `@pytest.mark.skip` on
    `test_stream_receives_live_events_during_in_flight` in test_runs_stream.py).
    That fixture gap is pre-existing and out of scope for this task.
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
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.control import RunControlRegistry
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool


@pytest.fixture(autouse=True)
def _clean(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_IDENTITY_SIGNING_KEY", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


# ---------------------------------------------------------------------------
# Fixtures: input/output models + tool factory
# ---------------------------------------------------------------------------


class _Inp(BaseModel):
    value: int = 1
    label: str = "original"


class _Out(BaseModel):
    received_value: int
    received_label: str


def _make_ask_tool(
    captured: list[_Inp],
) -> HarnessTool[_Inp, _Out]:
    """Build a tool whose check_permission always returns `ask`.

    The `call` function appends the actual `_Inp` it was invoked with to
    `captured` so the test can inspect the post-edit values.
    """

    async def _ask(_ctx: HarnessContext, _i: _Inp) -> PermissionResult:
        return PermissionResult(decision="ask", reason="needs human approval")

    async def _call(
        _ctx: HarnessContext, inp: _Inp, _progress: Any
    ) -> _Out:
        captured.append(inp)
        return _Out(received_value=inp.value, received_label=inp.label)

    return HarnessTool(
        name="edit_target_tool",
        description="Tool that asks for approval and can be edited",
        input_model=_Inp,
        output_model=_Out,
        check_permission=_ask,
        call=_call,
    )


def _make_ctx(*, registry: RunControlRegistry, run_id: str = "run_edit_test") -> HarnessContext:
    return HarnessContext(
        run_id=run_id,
        thread_id="t",
        tenant_id="demo",
        user_id="u",
        debug=False,
        approval_registry=registry,
    )


# ---------------------------------------------------------------------------
# The e2e test
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_edit_decision_changes_tool_executed_args() -> None:
    """Submitting an edit resolution via the HTTP endpoint changes the
    arguments the tool actually executes with.

    Flow:
    1. Create the FastAPI app and extract the shared RunControlRegistry.
    2. Build a tool that always asks for approval.
    3. Invoke the tool in a background asyncio task with the original input
       (value=1, label="original").
    4. Wait for the tool to emit `decision.requested` and block on the registry.
    5. POST to `/runs/{run_id}/decisions/{decision_id}` with
       `{"resolution": "edit", "updated_input": {"value": 99, "label": "edited"}}`.
    6. Assert the tool ran to completion with value=99 and label="edited".
    """

    app = create_app()

    # Pull the registry out once the lifespan is active.
    with TestClient(app) as client:
        registry: RunControlRegistry = app.state.harness.approval_registry
        assert registry is not None, "RunControlRegistry must be wired on app.state.harness"

        run_id = "run_edit_e2e"
        captured: list[_Inp] = []
        tool = _make_ask_tool(captured)
        ctx = _make_ctx(registry=registry, run_id=run_id)
        events: list[HarnessEvent] = []

        # --- Step 3: start tool in background task ---
        invoke_task = asyncio.create_task(
            tool.invoke(ctx, {"value": 1, "label": "original"}, events.append)
        )

        # --- Step 4: wait for decision.requested ---
        for _ in range(100):
            await asyncio.sleep(0)
            decision_events = [e for e in events if e.type == "decision.requested"]
            if decision_events:
                break
        else:
            pytest.fail(
                "decision.requested was never emitted; "
                f"events so far: {[e.type for e in events]}"
            )

        decision_id: str = decision_events[0].data["decision_id"]

        # --- Step 5: resolve via HTTP endpoint with edited input ---
        resp = client.post(
            f"/runs/{run_id}/decisions/{decision_id}",
            json={
                "resolution": "edit",
                "updated_input": {"value": 99, "label": "edited"},
            },
        )
        assert resp.status_code == 204, (
            f"Expected 204 from /decisions endpoint, got {resp.status_code}: {resp.text}"
        )

        # --- Step 6: wait for tool to complete ---
        output = await asyncio.wait_for(invoke_task, timeout=2.0)

        # Assert the OUTPUT reflects the edited input.
        assert output.received_value == 99, (
            f"Tool should have executed with edited value=99, got {output.received_value}"
        )
        assert output.received_label == "edited", (
            f"Tool should have executed with edited label='edited', got {output.received_label!r}"
        )

        # Assert the captured _Inp instance inside `call` matches the edited values.
        assert len(captured) == 1, (
            f"Expected tool.call to be invoked exactly once, got {len(captured)}"
        )
        assert captured[0].value == 99
        assert captured[0].label == "edited"

        # Assert event sequence integrity.
        event_types = [e.type for e in events]
        assert "decision.requested" in event_types
        assert "decision.resolved" in event_types
        assert "tool.started" in event_types
        assert "tool.completed" in event_types

        # decision events must precede tool lifecycle events.
        assert event_types.index("decision.requested") < event_types.index("tool.started")
        assert event_types.index("decision.resolved") < event_types.index("tool.started")
