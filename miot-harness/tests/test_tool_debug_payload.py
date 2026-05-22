"""Verifies tool.started / tool.completed payload shape with and without
the `debug` flag.

Plan: SSE rich events. The harness ships a lightweight default (input
*keys* + result *shape*) and an opt-in debug mode that adds the full
input dict and a truncated output (~2 KB cap).
"""

from __future__ import annotations

import json

import pytest
from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool


class _Inp(BaseModel):
    p_window_hours: int = 24
    tenant_id: str = "demo"


class _Out(BaseModel):
    rows: list[dict[str, int]]
    refreshed_at: str = "2026-05-22T00:00:00Z"


def _make_ctx(*, debug: bool) -> HarnessContext:
    return HarnessContext(
        thread_id="t", tenant_id="demo", user_id="u", debug=debug,
    )


def _make_tool() -> HarnessTool[_Inp, _Out]:
    async def _allow(_ctx: HarnessContext, _inp: _Inp) -> PermissionResult:
        return PermissionResult(decision="allow", reason="")

    async def _call(_ctx: HarnessContext, inp: _Inp, _progress) -> _Out:
        return _Out(rows=[{"x": i} for i in range(inp.p_window_hours)])

    return HarnessTool(
        name="my_tool",
        description="a tool",
        input_model=_Inp,
        output_model=_Out,
        check_permission=_allow,
        call=_call,
    )


def _events_for(ctx: HarnessContext) -> list[HarnessEvent]:
    events: list[HarnessEvent] = []
    tool = _make_tool()
    import asyncio
    asyncio.run(tool.invoke(ctx, {"p_window_hours": 3}, events.append))
    return events


def test_default_started_event_carries_input_keys_only() -> None:
    events = _events_for(_make_ctx(debug=False))
    started = [e for e in events if e.type == "tool.started"][0]
    assert started.data["tool"] == "my_tool"
    assert started.data["input_keys"] == ["p_window_hours", "tenant_id"]
    assert "input" not in started.data


def test_default_completed_event_carries_result_shape_only() -> None:
    events = _events_for(_make_ctx(debug=False))
    completed = [e for e in events if e.type == "tool.completed"][0]
    assert completed.data["tool"] == "my_tool"
    assert completed.data["result_shape"] == {"type": "rows", "length": 3}
    assert "output" not in completed.data
    assert "truncated" not in completed.data
    # lifted metadata is still surfaced
    assert completed.data["refreshed_at"] == "2026-05-22T00:00:00Z"


def test_debug_started_event_includes_full_input() -> None:
    events = _events_for(_make_ctx(debug=True))
    started = [e for e in events if e.type == "tool.started"][0]
    assert started.data["input"] == {"p_window_hours": 3, "tenant_id": "demo"}
    # Small inputs survive untruncated, but the flag is always present
    # so SSE consumers don't have to special-case absence.
    assert started.data["truncated"] is False


def test_debug_started_event_caps_oversized_input_payload() -> None:
    """A pathological input arg must not blow the SSE frame. The input
    is capped at the same 2 KB byte ceiling used for outputs.
    """
    from pydantic import BaseModel

    from miot_harness.runtime.permissions import PermissionResult
    from miot_harness.runtime.tool import _DEBUG_OUTPUT_BYTES_CAP, HarnessTool

    class _BigInp(BaseModel):
        blob: str

    class _Out(BaseModel):
        ok: bool = True

    async def _allow(_ctx, _i):
        return PermissionResult(decision="allow", reason="")

    async def _call(_ctx, _i, _p):
        return _Out()

    tool = HarnessTool(
        name="big_input_tool",
        description="d",
        input_model=_BigInp,
        output_model=_Out,
        check_permission=_allow,
        call=_call,
    )

    events: list[HarnessEvent] = []
    import asyncio
    asyncio.run(
        tool.invoke(
            _make_ctx(debug=True),
            {"blob": "x" * (_DEBUG_OUTPUT_BYTES_CAP * 2)},
            events.append,
        )
    )
    started = [e for e in events if e.type == "tool.started"][0]
    assert started.data["truncated"] is True
    # The capped representation is a string slice (JSON-serialized),
    # never larger than the byte ceiling.
    capped = started.data["input"]
    assert isinstance(capped, str)
    assert len(capped.encode("utf-8")) <= _DEBUG_OUTPUT_BYTES_CAP


def test_debug_completed_event_includes_truncated_output() -> None:
    events = _events_for(_make_ctx(debug=True))
    completed = [e for e in events if e.type == "tool.completed"][0]
    assert "output" in completed.data
    assert "truncated" in completed.data
    # Output is JSON-serializable
    json.dumps(completed.data["output"], default=str)


@pytest.mark.parametrize(
    "payload,expected",
    [
        ([1, 2, 3], {"type": "list", "length": 3}),
        ({"a": 1, "b": 2}, {"type": "dict", "length": 2}),
        ({"rows": [1, 2, 3, 4]}, {"type": "rows", "length": 4}),
        (None, {"type": "none", "length": 0}),
        ("hello", {"type": "str", "length": 1}),
    ],
)
def test_compute_result_shape_dispatch(payload, expected) -> None:
    from miot_harness.runtime.tool import _compute_result_shape

    assert _compute_result_shape(payload) == expected
