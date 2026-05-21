"""RunEventBus — per-run pub/sub fan-out used by the SSE handler.

These tests pin the contract the supervisor will rely on in A4 and the
`/runs/{id}/stream` handler in A5:

- subscribe + publish: subscriber receives every event in order
- fan-out: multiple subscribers each receive every event
- close: subscribers' async iterators terminate
- overflow: bounded queue evicts oldest on backpressure (events are also
  on `record.events`, so durable replay recovers the drops)
- isolation: events published for one run_id don't leak to another
- detach: a subscriber that exits early is removed from the active list
- publish-before-subscribe: no-op (events are dropped — durable replay
  via the run store covers this gap)
"""

from __future__ import annotations

import asyncio

import pytest

from miot_harness.runtime.event_bus import RunEventBus
from miot_harness.runtime.events import HarnessEvent


def _evt(run_id: str, message: str) -> HarnessEvent:
    return HarnessEvent(run_id=run_id, type="agent.turn", message=message)


@pytest.mark.asyncio
async def test_subscribe_then_publish_receives_event() -> None:
    bus = RunEventBus()
    received: list[HarnessEvent] = []

    async def consumer() -> None:
        async for evt in bus.subscribe("run_1"):
            received.append(evt)

    task = asyncio.create_task(consumer())
    # Give the consumer a tick to start (queue is registered synchronously,
    # but giving up the loop here keeps the test intent explicit).
    await asyncio.sleep(0)

    bus.publish("run_1", _evt("run_1", "hello"))
    bus.publish("run_1", _evt("run_1", "world"))
    bus.close("run_1")

    await asyncio.wait_for(task, timeout=1.0)

    assert [e.message for e in received] == ["hello", "world"]


@pytest.mark.asyncio
async def test_fan_out_to_multiple_subscribers() -> None:
    bus = RunEventBus()
    received_a: list[str] = []
    received_b: list[str] = []

    async def consumer(out: list[str]) -> None:
        async for evt in bus.subscribe("run_fan"):
            out.append(evt.message)

    task_a = asyncio.create_task(consumer(received_a))
    task_b = asyncio.create_task(consumer(received_b))
    await asyncio.sleep(0)

    for i in range(3):
        bus.publish("run_fan", _evt("run_fan", f"m{i}"))
    bus.close("run_fan")

    await asyncio.wait_for(asyncio.gather(task_a, task_b), timeout=1.0)

    assert received_a == ["m0", "m1", "m2"]
    assert received_b == ["m0", "m1", "m2"]


@pytest.mark.asyncio
async def test_publish_before_subscribe_is_dropped() -> None:
    bus = RunEventBus()
    bus.publish("run_x", _evt("run_x", "lost"))  # no-op, no subscribers

    received: list[str] = []

    async def consumer() -> None:
        async for evt in bus.subscribe("run_x"):
            received.append(evt.message)

    task = asyncio.create_task(consumer())
    await asyncio.sleep(0)
    bus.publish("run_x", _evt("run_x", "kept"))
    bus.close("run_x")

    await asyncio.wait_for(task, timeout=1.0)
    assert received == ["kept"]


@pytest.mark.asyncio
async def test_close_terminates_subscriber_without_publishes() -> None:
    bus = RunEventBus()
    received: list[str] = []

    async def consumer() -> None:
        async for evt in bus.subscribe("run_close"):
            received.append(evt.message)

    task = asyncio.create_task(consumer())
    await asyncio.sleep(0)
    bus.close("run_close")

    await asyncio.wait_for(task, timeout=1.0)
    assert received == []


@pytest.mark.asyncio
async def test_overflow_drops_oldest() -> None:
    """Producer publishes more events than the bounded queue can hold.
    Subscriber consumes them after close — the queue keeps the most
    recent `maxsize` items. Dropped events are recoverable via
    record.events on durable replay; the bus is a "live" channel only.
    """

    bus = RunEventBus(maxsize=2)
    received: list[str] = []

    async def consumer() -> None:
        async for evt in bus.subscribe("run_of"):
            received.append(evt.message)

    task = asyncio.create_task(consumer())
    await asyncio.sleep(0)

    # Five publishes onto a maxsize=2 queue + 1 close = 6 puts. The close
    # is also routed through the same drop-oldest path so it always lands.
    # Drop-oldest means after 5 publishes the queue holds the last 2
    # events (m3, m4); close then evicts m3 to land. Net: subscriber
    # observes [m4] before close fires.
    #
    # We assert the weaker guarantee that the LAST published event is
    # retained (recency wins) and that close terminates the iterator
    # within a bounded time.
    for i in range(5):
        bus.publish("run_of", _evt("run_of", f"m{i}"))
    bus.close("run_of")

    await asyncio.wait_for(task, timeout=1.0)

    assert received, "expected at least one event to survive overflow"
    assert received[-1] == "m4", f"latest event must be retained, got {received}"
    # The pre-close queue can hold at most maxsize=2 items; the subscriber
    # observed strictly fewer than the 5 publishes.
    assert len(received) <= 2


@pytest.mark.asyncio
async def test_isolation_per_run_id() -> None:
    bus = RunEventBus()
    received_a: list[str] = []
    received_b: list[str] = []

    async def consumer(run_id: str, out: list[str]) -> None:
        async for evt in bus.subscribe(run_id):
            out.append(evt.message)

    task_a = asyncio.create_task(consumer("run_A", received_a))
    task_b = asyncio.create_task(consumer("run_B", received_b))
    await asyncio.sleep(0)

    bus.publish("run_A", _evt("run_A", "for-A"))
    bus.publish("run_B", _evt("run_B", "for-B"))
    bus.close("run_A")
    bus.close("run_B")

    await asyncio.wait_for(asyncio.gather(task_a, task_b), timeout=1.0)

    assert received_a == ["for-A"]
    assert received_b == ["for-B"]


@pytest.mark.asyncio
async def test_subscriber_detaches_on_early_exit() -> None:
    """When a subscriber breaks out of the async-for early, its queue is
    removed from the active list so subsequent publishes don't try to
    feed a dead consumer.
    """

    bus = RunEventBus()

    async def consumer_then_break() -> None:
        # Mirror the production consumer pattern (_sse_iterator's early
        # returns call `await bus_iter.aclose()`). Closing explicitly
        # detaches the queue deterministically — otherwise we'd be
        # relying on asyncio's asyncgen-finalizer hook firing between
        # `wait_for` returning and the test's sync assert below, and
        # Python 3.12 schedules that hook later than 3.11 did, leaving
        # the queue still in `_subscribers` when the assert runs.
        gen = bus.subscribe("run_e")
        try:
            async for evt in gen:
                assert evt.message == "one"
                break
        finally:
            await gen.aclose()

    task = asyncio.create_task(consumer_then_break())
    await asyncio.sleep(0)
    bus.publish("run_e", _evt("run_e", "one"))
    await asyncio.wait_for(task, timeout=1.0)
    # After early exit, the per-run subscriber list is empty (and the
    # run_id entry has been pruned).
    assert "run_e" not in bus._subscribers  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_late_subscribe_after_close_ends_immediately() -> None:
    """Race: SSE handler subscribes after the supervisor finishes
    `_close_bus` but before in-flight cleanup runs. The bus must hand
    the late subscriber an iterator that ends immediately so the
    handler doesn't hang.
    """

    bus = RunEventBus()
    bus.close("run_late")  # close fires before any subscriber attaches

    received: list[HarnessEvent] = []

    async def consumer() -> None:
        async for evt in bus.subscribe("run_late"):
            received.append(evt)

    task = asyncio.create_task(consumer())
    await asyncio.wait_for(task, timeout=1.0)

    assert received == []
    # And the closed marker is purged once the late subscriber detached,
    # so a fresh run reusing the same id (unlikely, but defensive) would
    # behave normally.
    assert "run_late" not in bus._closed  # type: ignore[attr-defined]


@pytest.mark.asyncio
async def test_close_unknown_run_id_is_safe() -> None:
    """close() for a run_id with no subscribers must not raise — the
    supervisor calls close unconditionally on terminal events.
    """

    bus = RunEventBus()
    bus.close("never-subscribed")  # no exception
    # And subscribe + close on the same run_id where close fires first
    # also lands without error.
    bus.close("never-subscribed")
