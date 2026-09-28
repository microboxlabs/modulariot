from __future__ import annotations

import asyncio
import json

import pytest
from pydantic import BaseModel

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.event_payload import (
    ARGS_BYTES_CAP,
    PREVIEW_BYTES_CAP,
    REDACTED,
    args_payload,
    bounded,
    preview_payload,
    redact,
    scrub_text,
)
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool


class _Inp(BaseModel):
    sql: str
    password: str = ""
    limit: int = 10


class _Out(BaseModel):
    rows: list[dict[str, int]]


def _tool(*, fail: Exception | None = None) -> HarnessTool[_Inp, _Out]:
    async def _allow(_ctx: HarnessContext, _inp: _Inp) -> PermissionResult:
        return PermissionResult.allow("")

    async def _call(_ctx: HarnessContext, inp: _Inp, _progress) -> _Out:
        if fail is not None:
            raise fail
        return _Out(rows=[{"x": i} for i in range(inp.limit)])

    return HarnessTool(
        name="query",
        description="q",
        input_model=_Inp,
        output_model=_Out,
        check_permission=_allow,
        call=_call,
    )


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="demo", user_id="u")


def _run(tool: HarnessTool, raw: dict) -> list[HarnessEvent]:
    events: list[HarnessEvent] = []
    try:
        asyncio.run(tool.invoke(_ctx(), raw, events.append))
    except Exception:
        pass
    return events


def test_redact_hides_secret_keys_at_any_depth() -> None:
    value = {
        "sql": "select 1",
        "password": "p",
        "nested": {"api_key": "k", "Authorization": "Bearer x", "dsn": "postgres://x"},
        "items": [{"access_token": "t"}],
        "max_tokens": 100,
    }
    out = redact(value)
    assert out["sql"] == "select 1"
    assert out["password"] == REDACTED
    assert out["nested"] == {"api_key": REDACTED, "Authorization": REDACTED, "dsn": REDACTED}
    assert out["items"] == [{"access_token": REDACTED}]
    assert out["max_tokens"] == 100


def test_redact_replaces_base64_blobs() -> None:
    blob = "QUJD" * 200
    out = redact({"file": blob, "uri": "data:image/png;base64,iVBORw0KGgo=", "word": "hello"})
    assert out["file"] == f"[base64, {len(blob)} characters]"
    assert out["uri"].startswith("[base64,")
    assert out["word"] == "hello"


def test_scrub_text_removes_url_credentials() -> None:
    text = "could not connect to postgresql://svc:hunter2@db.internal:5432/app"
    assert scrub_text(text) == "could not connect to postgresql://***@db.internal:5432/app"


def test_bounded_keeps_small_values_whole() -> None:
    assert bounded({"a": 1}, 100) == ({"a": 1}, False)


def test_bounded_shortens_long_strings_then_cuts_bytes() -> None:
    value, truncated = bounded({"sql": "select 1 " * 600}, ARGS_BYTES_CAP)
    assert truncated
    assert isinstance(value, dict)
    assert len(value["sql"]) < 1100

    value, truncated = bounded({f"k{i}": "y " * 450 for i in range(20)}, ARGS_BYTES_CAP)
    assert truncated
    assert isinstance(value, str)
    assert len(value.encode("utf-8")) <= ARGS_BYTES_CAP


def test_payload_helpers_flag_truncation() -> None:
    assert args_payload({"a": 1}) == {"args": {"a": 1}}
    assert args_payload({"a": "z " * 4500})["args_truncated"] is True
    preview = preview_payload({"rows": [{"x": i} for i in range(50)]})
    assert preview["preview_truncated"] is True
    assert len(json.dumps(preview["preview"]).encode()) <= PREVIEW_BYTES_CAP


def test_tool_events_carry_args_preview_and_duration() -> None:
    events = _run(_tool(), {"sql": "select *\nfrom trips", "password": "secret", "limit": 3})
    started = next(e for e in events if e.type == "tool.started")
    completed = next(e for e in events if e.type == "tool.completed")
    assert started.data["args"] == {"sql": "select *\nfrom trips", "password": REDACTED, "limit": 3}
    assert started.data["call_id"] == completed.data["call_id"]
    assert completed.data["ok"] is True
    assert isinstance(completed.data["duration_ms"], int)
    assert completed.data["preview"] == {"rows": [{"x": 0}, {"x": 1}, {"x": 2}]}
    assert "secret" not in json.dumps([e.data for e in events])


def test_failed_tool_event_carries_scrubbed_error() -> None:
    events = _run(_tool(fail=RuntimeError("dial postgres://u:pw@h/db refused")), {"sql": "s"})
    failed = next(e for e in events if e.type == "tool.failed")
    started = next(e for e in events if e.type == "tool.started")
    assert failed.data["ok"] is False
    assert failed.data["call_id"] == started.data["call_id"]
    assert "pw" not in failed.data["error"]
    assert "duration_ms" in failed.data


def test_invalid_input_emits_failed_with_args() -> None:
    events = _run(_tool(), {"limit": "many", "token": "t"})
    assert [e.type for e in events] == ["tool.failed"]
    data = events[0].data
    assert data["error_type"] == "ValidationError"
    assert data["args"] == {"limit": "many", "token": REDACTED}


@pytest.mark.parametrize("key", ["client_secret", "db_password", "apiKey", "api-key"])
def test_secret_key_variants(key: str) -> None:
    assert redact({key: "v"})[key] == REDACTED
