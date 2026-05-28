"""Async approval registry.

When `HarnessTool.invoke()` hits an `ask`-permission tool, it mints an
`approval_id`, emits `approval.requested`, and `await`s the registry for
a human decision before proceeding. The frontend resolves the wait by
POST /runs/{run_id}/approvals/{approval_id} which calls `resolve()`.

Without a registry on `HarnessContext`, the `ask` path turns into an
immediate `deny` — there's no human in the loop, so the safer move is
to refuse rather than silently rubber-stamp the call. CLI / eval paths
that never set permission="ask" are unaffected.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Literal

ApprovalDecision = Literal["approve", "deny"]


@dataclass
class _PendingApproval:
    event: asyncio.Event = field(default_factory=asyncio.Event)
    decision: ApprovalDecision | None = None


class ApprovalRegistry:
    """In-process, async-safe registry of pending approvals keyed by
    approval_id. Single-instance per harness process — the FastAPI
    lifespan owns it via `app.state.approval_registry`.
    """

    def __init__(self) -> None:
        self._pending: dict[str, _PendingApproval] = {}

    def register(self, approval_id: str) -> asyncio.Event:
        """Create the wait-event for `approval_id` and return it. The
        caller awaits the event; `resolve()` sets it.
        """
        entry = _PendingApproval()
        self._pending[approval_id] = entry
        return entry.event

    def resolve(self, approval_id: str, decision: ApprovalDecision) -> bool:
        """Set the decision and unblock the waiter. Returns False when
        no approval with that id is pending (already resolved, never
        requested, or already discarded).
        """
        entry = self._pending.get(approval_id)
        if entry is None:
            return False
        entry.decision = decision
        entry.event.set()
        return True

    def decision(self, approval_id: str) -> ApprovalDecision | None:
        """Read the resolved decision. Returns None when the approval
        is still pending or unknown.
        """
        entry = self._pending.get(approval_id)
        return entry.decision if entry is not None else None

    def discard(self, approval_id: str) -> None:
        """Remove the approval entry. Called by the waiter once it has
        consumed the decision, so the registry doesn't grow unbounded.
        """
        self._pending.pop(approval_id, None)
