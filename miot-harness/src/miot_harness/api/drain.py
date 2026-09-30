"""Graceful shutdown for in-flight runs.

On SIGTERM the harness stops taking new runs, waits for the ones in flight,
then cancels whatever is left with reason "interrupted" (the supervisor saves
each one). Only then is the signal passed on to the server, which closes its
socket and runs the lifespan shutdown.
"""

from __future__ import annotations

import asyncio
import logging
import signal
import threading
from collections.abc import Callable, Mapping
from types import FrameType
from typing import Any

logger = logging.getLogger(__name__)

INTERRUPTED = "interrupted"


class RunDrain:
    def __init__(self, in_flight: Mapping[str, asyncio.Task[Any]], timeout_seconds: float) -> None:
        self._in_flight = in_flight
        self._timeout = timeout_seconds
        self.draining = False

    async def drain(self) -> None:
        self.draining = True
        tasks = list(self._in_flight.values())
        if tasks:
            logger.info(
                "Draining %d run(s), up to %.0fs before interrupting them",
                len(tasks),
                self._timeout,
            )
            await asyncio.wait(tasks, timeout=self._timeout)
        await self.interrupt_all()

    async def interrupt_all(self) -> None:
        pending = [t for t in self._in_flight.values() if not t.done()]
        if not pending:
            return
        logger.warning("Interrupting %d run(s) still in flight", len(pending))
        for task in pending:
            task.cancel(INTERRUPTED)
        await asyncio.gather(*pending, return_exceptions=True)


def install_sigterm_drain(
    drain: RunDrain, loop: asyncio.AbstractEventLoop
) -> Callable[[], None] | None:
    """Put `drain` in front of the current SIGTERM handler. Returns a function
    that restores the previous handler, or None when signals can't be set
    here (not the main thread, as under a test client)."""
    if threading.current_thread() is not threading.main_thread():
        return None
    previous = signal.getsignal(signal.SIGTERM)

    def restore() -> None:
        signal.signal(signal.SIGTERM, previous)

    def pass_on(_task: asyncio.Task[None]) -> None:
        restore()
        signal.raise_signal(signal.SIGTERM)

    def start_drain() -> None:
        loop.create_task(drain.drain()).add_done_callback(pass_on)

    def on_sigterm(_signum: int, _frame: FrameType | None) -> None:
        if drain.draining:
            return
        drain.draining = True
        loop.call_soon_threadsafe(start_drain)

    signal.signal(signal.SIGTERM, on_sigterm)
    return restore
