"""Per-run pub/sub fan-out used by the SSE streaming endpoint.

The supervisor (A4) calls `publish` for every event that lands on a run
record; the `GET /runs/{id}/stream` handler (A5) calls `subscribe` to
receive events as they happen. Durable replay of missed events comes
from `record.events` (the run store), so dropped events under overflow
are recoverable — the bus is a "live" channel only.

Single-loop usage assumed (FastAPI's event loop). asyncio.Queue is not
thread-safe, but the harness only uses one loop.
"""

from __future__ import annotations

import asyncio
from collections.abc import AsyncIterator

from miot_harness.runtime.events import HarnessEvent

# Sentinel pushed through subscriber queues to terminate their iterators.
# HarnessEvent is never None, so identity-comparison is unambiguous.
_CLOSE: object = object()


class RunEventBus:
    """Per-run pub/sub fan-out over bounded asyncio.Queues.

    - `subscribe(run_id)` returns an async iterator yielding events
      until `close(run_id)` is called.
    - `publish(run_id, event)` fans the event out to every active
      subscriber for that run; no-op when nobody is subscribed.
    - `close(run_id)` signals every subscriber to that run that the run
      is done; iterators terminate cleanly.
    - Overflow policy: when a subscriber's queue is full, drop its
      oldest item to make room (recency wins; durable replay covers
      drops via `record.events`).
    """

    DEFAULT_MAXSIZE = 256

    def __init__(self, maxsize: int = DEFAULT_MAXSIZE) -> None:
        self._subscribers: dict[str, list[asyncio.Queue[object]]] = {}
        # Run-ids whose `close` has fired. Used to short-circuit a late
        # `subscribe` (race: SSE handler attaches after the supervisor
        # finishes _close_bus but before in-flight cleanup runs). Purged
        # in `_consume`'s finally when the last subscriber detaches.
        self._closed: set[str] = set()
        self._maxsize = maxsize

    def publish(self, run_id: str, event: HarnessEvent) -> None:
        for queue in self._subscribers.get(run_id, ()):
            self._put_drop_oldest(queue, event)

    def close(self, run_id: str) -> None:
        self._closed.add(run_id)
        # Snapshot before iterating: subscribers' finally-blocks mutate
        # the list when their iterator ends.
        for queue in list(self._subscribers.get(run_id, ())):
            self._put_drop_oldest(queue, _CLOSE)

    def subscribe(self, run_id: str) -> AsyncIterator[HarnessEvent]:
        # Sync queue registration so the caller's first `publish` after
        # `bus.subscribe(...)` always lands on this queue, regardless of
        # when the consumer reaches its first `__anext__`.
        queue: asyncio.Queue[object] = asyncio.Queue(maxsize=self._maxsize)
        self._subscribers.setdefault(run_id, []).append(queue)
        # If close already fired, queue the sentinel immediately so the
        # consumer's first __anext__ terminates instead of hanging.
        if run_id in self._closed:
            self._put_drop_oldest(queue, _CLOSE)
        return self._consume(run_id, queue)

    async def _consume(
        self, run_id: str, queue: asyncio.Queue[object]
    ) -> AsyncIterator[HarnessEvent]:
        try:
            while True:
                item = await queue.get()
                if item is _CLOSE:
                    return
                # The queue is typed as object[] because it also carries
                # the close sentinel. Everything else we put on it is a
                # HarnessEvent.
                assert isinstance(item, HarnessEvent)
                yield item
        finally:
            queues = self._subscribers.get(run_id)
            if queues is not None and queue in queues:
                queues.remove(queue)
                if not queues:
                    self._subscribers.pop(run_id, None)
                    # Drop the terminal marker when nobody is listening
                    # anymore — keeps `_closed` bounded.
                    self._closed.discard(run_id)

    def _put_drop_oldest(self, queue: asyncio.Queue[object], item: object) -> None:
        try:
            queue.put_nowait(item)
        except asyncio.QueueFull:
            # Discard oldest, then retry. The retry can't itself fail
            # because we just freed a slot on a single-loop runtime.
            try:
                queue.get_nowait()
            except asyncio.QueueEmpty:
                pass
            queue.put_nowait(item)
