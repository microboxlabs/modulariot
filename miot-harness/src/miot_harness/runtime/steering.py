"""Steering channel registry (Steering Plan C).

A process-local, run-keyed channel that backs two operator features consumed
at the agentic planner boundary: (a) injecting free-text guidance ("notes")
into a running agent loop, and (b) a cooperative "interrupt" flag. Unlike the
single-shot async-await of `RunControlRegistry`, this channel is *advisory*
and *non-blocking* — the run never waits on it. Notes are pushed by an
operator and drained opportunistically by the planner; the interrupt flag is
polled cooperatively. Both default to no-ops for unknown/finished runs.

Single instance per harness process (owned by the supervisor, like
`ApprovalRegistry`/`RunControlRegistry`). No locks — single asyncio-loop
assumption, same as the rest of the runtime registries.
"""

from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class _RunChannel:
    notes: list[str] = field(default_factory=list)
    interrupted: bool = False


class SteeringRegistry:
    """In-process, run-keyed steering channel. Single instance per harness
    process (owned by the supervisor). Advisory and non-blocking: callers push
    notes / set the interrupt flag, and the run drains / polls them when it
    reaches the agentic planner boundary."""

    # Cap the pending backlog so an operator posting faster than the planner
    # drains can't grow a channel without bound. Notes are advisory and the
    # most recent guidance is the most relevant, so on overflow the oldest
    # note is evicted (FIFO) rather than rejecting the new one.
    _MAX_BACKLOG = 100

    def __init__(self) -> None:
        self._channels: dict[str, _RunChannel] = {}

    def open(self, run_id: str) -> None:
        """Create a fresh channel for the run. Idempotent: an existing channel
        is overwritten (notes cleared, interrupt reset)."""
        self._channels[run_id] = _RunChannel()

    def close(self, run_id: str) -> None:
        self._channels.pop(run_id, None)

    def push(self, run_id: str, note: str) -> bool:
        """Append `note` to the run's channel. Returns False when the run has
        no open channel (unknown/finished), True otherwise."""
        channel = self._channels.get(run_id)
        if channel is None:
            return False
        channel.notes.append(note)
        if len(channel.notes) > self._MAX_BACKLOG:
            # Bounded FIFO: drop the oldest note(s) to keep memory in check.
            del channel.notes[: len(channel.notes) - self._MAX_BACKLOG]
        return True

    def drain(self, run_id: str) -> list[str]:
        """Return all pending notes and clear them (the channel itself stays
        open). Returns [] when there is no channel or nothing pending."""
        channel = self._channels.get(run_id)
        if channel is None or not channel.notes:
            return []
        notes = channel.notes
        channel.notes = []
        return notes

    def interrupt(self, run_id: str) -> bool:
        """Set the channel's interrupt flag. Returns False if no channel,
        else True."""
        channel = self._channels.get(run_id)
        if channel is None:
            return False
        channel.interrupted = True
        return True

    def is_interrupted(self, run_id: str) -> bool:
        channel = self._channels.get(run_id)
        return channel.interrupted if channel is not None else False
