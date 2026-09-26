"""Supervisor and RunEventBus.

With a bus, every event that lands on `record.events` is also published,
and the bus closes at every terminal point in `run()`. Without one the run
behaves the same and saves only at the end.
"""

from __future__ import annotations

import asyncio
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import HarnessRunRecord, JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.tools.registry import ToolRegistry


class _Loop:
    """Emits `emits` agent events through `progress`, then answers or raises."""

    def __init__(self, *, emits: int = 0, raises: BaseException | None = None) -> None:
        self.emits = emits
        self.raises = raises

    async def run(self, *, user_message, ctx, prior_messages, progress) -> dict[str, Any]:
        for i in range(self.emits):
            progress(HarnessEvent(run_id=ctx.run_id, type="agent.started", message=f"m{i}"))
        if self.raises is not None:
            raise self.raises
        return {"answer": "ok", "messages": [AIMessage(content="ok")]}


def _supervisor(
    tmp_path: Any,
    loop: _Loop | None,
    *,
    event_bus: RunEventBus | None = None,
    run_store: JsonRunStore | None = None,
    checkpoint_every_n_events: int = 10,
) -> HarnessSupervisor:
    return HarnessSupervisor(
        tools=ToolRegistry(),
        run_store=run_store or JsonRunStore(tmp_path),
        agent_loop=loop,
        event_bus=event_bus,
        checkpoint_every_n_events=checkpoint_every_n_events,
    )


def _request() -> UserRequest:
    return UserRequest(message="q", tenant_id="orion")


@pytest.mark.asyncio
async def test_events_published_to_bus_match_record_events(tmp_path: Any) -> None:
    bus = RunEventBus()
    received: list[HarnessEvent] = []
    real_publish = bus.publish

    def tap(run_id: str, event: HarnessEvent) -> None:
        received.append(event)
        real_publish(run_id, event)

    bus.publish = tap  # type: ignore[method-assign]
    sup = _supervisor(tmp_path, _Loop(emits=2), event_bus=bus)

    record = await sup.run(_request())

    assert [e.id for e in received] == [e.id for e in record.events]
    # Published after `_emit` stamps the sequence number.
    assert [e.seq for e in received] == [e.seq for e in record.events]


@pytest.mark.asyncio
async def test_bus_closed_on_happy_completion(tmp_path: Any) -> None:
    bus = RunEventBus()
    record = await _supervisor(tmp_path, _Loop(), event_bus=bus).run(_request())

    assert record.run_id not in bus._subscribers  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_bus_closed_when_no_model_is_configured(tmp_path: Any) -> None:
    bus = RunEventBus()
    record = await _supervisor(tmp_path, None, event_bus=bus).run(_request())

    assert record.status == "completed"
    assert record.run_id not in bus._subscribers  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_bus_closed_on_run_failure(tmp_path: Any) -> None:
    bus = RunEventBus()
    sup = _supervisor(tmp_path, _Loop(raises=RuntimeError("boom")), event_bus=bus)

    record = await sup.run(_request())

    assert record.status == "failed"
    assert record.run_id not in bus._subscribers  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_bus_emits_cancelled_run_failed_on_task_cancel(tmp_path: Any) -> None:
    """A cancelled run ends with `run.failed` (reason cancelled), so SSE
    subscribers can tell it from a dropped connection."""

    bus = RunEventBus()
    sup = _supervisor(tmp_path, _Loop(raises=asyncio.CancelledError()), event_bus=bus)

    with pytest.raises(asyncio.CancelledError):
        await sup.run(_request(), run_id_override="run_cancel_test")

    record = sup.run_store.load("run_cancel_test")
    assert record.status == "failed"
    [failed] = [e for e in record.events if e.type == "run.failed"]
    assert failed.data == {"error": "cancelled", "reason": "cancelled"}
    assert "run_cancel_test" not in bus._subscribers  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_supervisor_without_bus_behaves_unchanged(tmp_path: Any) -> None:
    record = await _supervisor(tmp_path, _Loop()).run(_request())

    assert record.status == "completed"
    assert record.answer == "ok"


@pytest.mark.asyncio
async def test_supervisor_honors_run_id_override(tmp_path: Any) -> None:
    record = await _supervisor(tmp_path, _Loop()).run(
        _request(), run_id_override="run_pre_minted_abc"
    )

    assert record.run_id == "run_pre_minted_abc"
    assert all(e.run_id == "run_pre_minted_abc" for e in record.events)


class _CountingStore(JsonRunStore):
    def __init__(self, root: Any) -> None:
        super().__init__(root)
        self.saves: list[int] = []

    def save(self, record: HarnessRunRecord) -> None:
        self.saves.append(len(record.events))
        super().save(record)


@pytest.mark.asyncio
async def test_supervisor_checkpoints_during_long_run(tmp_path: Any) -> None:
    store = _CountingStore(tmp_path)
    sup = _supervisor(
        tmp_path,
        _Loop(emits=5),
        event_bus=RunEventBus(),
        run_store=store,
        checkpoint_every_n_events=2,
    )

    await sup.run(_request())

    assert len(store.saves) > 1, f"expected mid-flight checkpoints, got {store.saves}"


@pytest.mark.asyncio
async def test_supervisor_skips_checkpoint_when_no_event_bus(tmp_path: Any) -> None:
    store = _CountingStore(tmp_path)
    sup = _supervisor(tmp_path, _Loop(emits=5), run_store=store, checkpoint_every_n_events=2)

    await sup.run(_request())

    assert len(store.saves) == 1, f"expected one terminal save, got {store.saves}"
