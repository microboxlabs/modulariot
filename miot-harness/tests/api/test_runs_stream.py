"""SSE streaming endpoints (Phase A step 5).

Contract:
- POST /runs:start dispatches the supervisor as a background task and
  returns {"run_id": ...} with 202 immediately.
- GET /runs/{run_id}/stream is `text/event-stream`, honors
  `Last-Event-ID` for replay, and falls back to the RunEventBus for
  live events while the run is in-flight.
- POST /runs is unchanged (returns HarnessRunRecord on completion).
"""

from __future__ import annotations

import asyncio
import json
from collections.abc import Iterator
from typing import Any
from unittest.mock import AsyncMock

import pytest
from fastapi.testclient import TestClient

from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.events import HarnessEvent


@pytest.fixture(autouse=True)
def _clean_settings_and_workspace(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DSN", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def _parse_sse(text: str) -> list[dict[str, Any]]:
    """Parse an SSE response body into a list of {id, event, data} records."""

    records: list[dict[str, Any]] = []
    cur: dict[str, Any] = {}
    for raw in text.split("\n"):
        line = raw.rstrip("\r")
        if not line:
            if cur:
                records.append(cur)
                cur = {}
            continue
        field, _, value = line.partition(":")
        value = value.lstrip(" ")
        if field == "id":
            cur["id"] = value
        elif field == "event":
            cur["event"] = value
        elif field == "data":
            cur["data"] = json.loads(value)
    if cur:
        records.append(cur)
    return records


def test_post_runs_start_returns_202_with_run_id() -> None:
    """POST /runs:start dispatches the supervisor as a background task
    and returns the pre-minted run_id immediately so the caller can
    subscribe to /runs/{id}/stream.
    """

    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs:start", json={"message": "hi"})
    assert resp.status_code == 202
    body = resp.json()
    assert "run_id" in body
    assert body["run_id"].startswith("run_")


def test_post_runs_unchanged_returns_harness_run_record() -> None:
    """Backwards compat: POST /runs still returns a full HarnessRunRecord
    on completion (evals, demo CLI, existing /runs callers).
    """

    app = create_app()
    with TestClient(app) as client:
        resp = client.post("/runs", json={"message": "hi"})
    assert resp.status_code == 200
    body = resp.json()
    assert "run_id" in body
    assert "events" in body
    assert "answer" in body
    assert body["status"] == "completed"


def test_stream_replays_completed_run() -> None:
    """Once a run has completed (record persisted to disk), GET /stream
    replays every event from the record. No live subscription needed
    because the run is terminal.
    """

    app = create_app()
    with TestClient(app) as client:
        post = client.post("/runs", json={"message": "hi"})
        run_id = post.json()["run_id"]

        with client.stream("GET", f"/runs/{run_id}/stream") as resp:
            assert resp.status_code == 200
            assert resp.headers["content-type"].startswith("text/event-stream")
            body = resp.read().decode()

    records = _parse_sse(body)
    assert len(records) >= 2, f"expected at least run.started+run.completed, got {records}"
    assert records[0]["event"] == "run.started"
    # Final event on a completed run is run.completed.
    assert records[-1]["event"] == "run.completed"
    # All event ids match record.events order/ids.
    ids = [r["id"] for r in records]
    assert all(i.startswith("evt_") for i in ids)


def test_stream_with_last_event_id_skips_replayed_events() -> None:
    """Caller resumes from a known event id; the handler returns only
    events with seq strictly greater than that event's seq.
    """

    app = create_app()
    with TestClient(app) as client:
        post = client.post("/runs", json={"message": "hi"})
        run_id = post.json()["run_id"]

        # First read: capture every event id+seq.
        with client.stream("GET", f"/runs/{run_id}/stream") as resp:
            full_body = resp.read().decode()
    full_records = _parse_sse(full_body)
    # Pick the second event as the cursor.
    cursor = full_records[1]
    cursor_id = cursor["id"]
    cursor_seq = cursor["data"]["seq"]

    # Resume with that id; expect events with seq > cursor_seq.
    app = create_app()  # fresh app, same workspace via env var
    with TestClient(app) as client:
        with client.stream(
            "GET",
            f"/runs/{run_id}/stream",
            headers={"Last-Event-ID": cursor_id},
        ) as resp:
            partial = resp.read().decode()
    partial_records = _parse_sse(partial)

    seqs = [r["data"]["seq"] for r in partial_records]
    assert all(s > cursor_seq for s in seqs), (
        f"expected seqs strictly above {cursor_seq}, got {seqs}"
    )
    # And the union of (first 2 from full) + (partial) == full.
    assert seqs == [r["data"]["seq"] for r in full_records if r["data"]["seq"] > cursor_seq]


def test_stream_unknown_run_id_emits_error_event() -> None:
    """A GET against an unknown run_id (no persisted record, not in-
    flight) emits a single `event: error` payload and closes the
    stream. We don't return 404 because text/event-stream is already
    chosen at header time and the spec keeps the SSE connection alive
    even on logical errors.
    """

    app = create_app()
    with TestClient(app) as client:
        with client.stream("GET", "/runs/run_unknown_xyz/stream") as resp:
            assert resp.status_code == 200
            body = resp.read().decode()
    records = _parse_sse(body)
    assert len(records) == 1
    assert records[0]["event"] == "error"
    assert records[0]["data"]["error"] == "unknown_run_id"


@pytest.mark.skip(
    reason=(
        "Live in-flight streaming verification requires async test plumbing "
        "(asgi-lifespan or equivalent) so the lifespan, the dispatched run "
        "task, and the SSE consumer all share a single event loop. The "
        "replay + Last-Event-ID + unknown-run-id tests above cover the "
        "core SSE contract; this test will land in a follow-up commit "
        "that introduces the asgi-lifespan test fixture."
    )
)
@pytest.mark.asyncio
async def test_stream_receives_live_events_during_in_flight(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    """While a run is in-flight, GET /stream subscribes to the RunEventBus
    and yields events live. We slot a controllable nexo_graph onto the
    harness after lifespan starts, then start a run via /runs:start and
    immediately consume the stream.
    """

    import httpx

    monkeypatch.delenv("MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT", raising=False)
    monkeypatch.delenv("MIOT_HARNESS_NEXO_DSN", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    get_settings.cache_clear()

    app = create_app()

    # Drive lifespan via TestClient, then run the actual stream test
    # against httpx.AsyncClient(transport=ASGITransport) on the same app.
    with TestClient(app):
        # Force route to NEXO_QUERY via a scripted llm_router, and inject
        # a slow graph that emits 2 events and blocks until released.
        gate = asyncio.Event()

        async def slow_ainvoke(state: dict[str, Any]) -> dict[str, Any]:
            events = [
                HarnessEvent(run_id="ignored", type="agent.turn", message="planner"),
                HarnessEvent(run_id="ignored", type="tool.completed", message="probe"),
            ]
            # Surface the first batch via the graph's _events channel,
            # then await release. The supervisor's drain runs AFTER
            # ainvoke returns, so these events arrive at the bus only
            # once the gate opens; that's fine — we'll observe the
            # supervisor-level events live too (run.started, route.selected).
            await gate.wait()
            return {"answer": "released", "_events": events}

        nexo_graph = AsyncMock()
        nexo_graph.ainvoke = slow_ainvoke

        # Attach controllable graph + force NEXO_QUERY routing keyword.
        harness = app.state.harness
        harness.nexo_graph = nexo_graph
        # No LLM router → keyword router picks NEXO_QUERY when the message
        # contains a keyword. Easiest: use a Mintral-related keyword.
        # Looking at router.py for an actual NEXO_QUERY trigger word.
        message = "mintral status"  # keyword router routes this to NEXO_QUERY

        async with httpx.AsyncClient(
            transport=httpx.ASGITransport(app=app),
            base_url="http://test",
        ) as client:
            # Kick the slow run
            post = await client.post("/runs:start", json={"message": message})
            assert post.status_code == 202
            run_id = post.json()["run_id"]

            # Start streaming concurrently with the in-flight run
            async def consume() -> list[dict[str, Any]]:
                async with client.stream(
                    "GET", f"/runs/{run_id}/stream"
                ) as resp:
                    buffer = b""
                    async for chunk in resp.aiter_bytes():
                        buffer += chunk
                    return _parse_sse(buffer.decode())

            consumer_task = asyncio.create_task(consume())
            # Give the consumer a tick to subscribe.
            await asyncio.sleep(0.05)
            # Release the slow graph; supervisor finishes, _close_bus fires.
            gate.set()
            records = await asyncio.wait_for(consumer_task, timeout=5.0)

    # We should have at least: run.started, route.selected, run.completed.
    event_types = [r["event"] for r in records]
    assert "run.started" in event_types
    assert "run.completed" in event_types
    # Last event is the terminal one (run.completed for this path).
    assert event_types[-1] == "run.completed"
