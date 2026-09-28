"""GET /runs/{id}/stream for a subscriber that joins a run already in flight.

The run store is checkpointed every few events, so a late subscriber must
replay from the supervisor's in-memory record, then continue live.
"""

from __future__ import annotations

import asyncio
from types import SimpleNamespace
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.api import server
from miot_harness.api.server import _sse_iterator
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry


class _GatedLoop:
    def __init__(self) -> None:
        self.emitted = asyncio.Event()
        self.release = asyncio.Event()

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        progress(HarnessEvent(run_id=ctx.run_id, type="agent.started", message="a"))
        progress(HarnessEvent(run_id=ctx.run_id, type="tool.completed", message="b"))
        self.emitted.set()
        await self.release.wait()
        progress(HarnessEvent(run_id=ctx.run_id, type="agent.completed", message="c"))
        return {"answer": "ok", "messages": [AIMessage(content="ok")]}


def _event_types(frames: list[bytes]) -> list[str]:
    return [
        line.removeprefix("event: ")
        for frame in frames
        for line in frame.decode().splitlines()
        if line.startswith("event: ")
    ]


def _event_ids(frames: list[bytes]) -> list[str]:
    return [
        line.removeprefix("id: ")
        for frame in frames
        for line in frame.decode().splitlines()
        if line.startswith("id: ")
    ]


async def _next(stream: Any) -> bytes:
    return await asyncio.wait_for(anext(stream), timeout=5)


async def _start(tmp_path: Any) -> tuple[SimpleNamespace, _GatedLoop, str, asyncio.Task[Any]]:
    bus = RunEventBus()
    loop = _GatedLoop()
    harness = HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=JsonRunStore(tmp_path),
        agent_loop=loop,
        event_bus=bus,
        checkpoint_every_n_events=10,
    )
    run_id = "run_inflight"
    task = asyncio.create_task(
        harness.run(UserRequest(message="q", tenant_id="orion"), run_id_override=run_id)
    )
    app = SimpleNamespace(
        state=SimpleNamespace(harness=harness, event_bus=bus, in_flight={run_id: task})
    )
    await asyncio.wait_for(loop.emitted.wait(), timeout=5)
    return app, loop, run_id, task


@pytest.mark.asyncio
async def test_late_subscriber_replays_uncheckpointed_events_then_goes_live(
    tmp_path: Any,
) -> None:
    app, loop, run_id, task = await _start(tmp_path)
    # Nothing has been checkpointed yet: the disk has no record of this run.
    assert not (tmp_path / "runs" / f"{run_id}.json").exists()

    stream = _sse_iterator(app, run_id, None)  # type: ignore[arg-type]
    frames = [await _next(stream) for _ in range(3)]
    assert _event_types(frames) == ["run.started", "agent.started", "tool.completed"]

    loop.release.set()
    frames += [frame async for frame in stream]
    await task

    types = _event_types(frames)
    assert types[:4] == ["run.started", "agent.started", "tool.completed", "agent.completed"]
    assert types[-1] == "run.completed"
    assert len(_event_ids(frames)) == len(set(_event_ids(frames)))


@pytest.mark.asyncio
async def test_late_subscriber_resumes_past_last_event_id(tmp_path: Any) -> None:
    app, loop, run_id, task = await _start(tmp_path)
    first = [f async for f in _take(_sse_iterator(app, run_id, None), 2)]  # type: ignore[arg-type]
    cursor = _event_ids(first)[-1]

    stream = _sse_iterator(app, run_id, cursor)  # type: ignore[arg-type]
    assert _event_types([await _next(stream)]) == ["tool.completed"]

    loop.release.set()
    rest = [frame async for frame in stream]
    await task
    assert _event_types(rest)[-1] == "run.completed"


@pytest.mark.asyncio
async def test_idle_live_stream_sends_keepalive_comments(
    tmp_path: Any, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(server, "_SSE_KEEPALIVE_SECONDS", 0.01)
    app, loop, run_id, task = await _start(tmp_path)
    stream = _sse_iterator(app, run_id, None)  # type: ignore[arg-type]
    for _ in range(3):
        await _next(stream)

    assert await _next(stream) == b": keepalive\n\n"
    assert await _next(stream) == b": keepalive\n\n"

    loop.release.set()
    rest = [frame async for frame in stream]
    await task
    events = [frame for frame in rest if not frame.startswith(b":")]
    assert _event_types(events) == ["agent.completed", "run.completed"]


async def _take(stream: Any, n: int) -> Any:
    for _ in range(n):
        yield await _next(stream)
    await stream.aclose()
