"""Run-control registry (Steering Plan B).

Generalizes the approve/deny ApprovalRegistry into a registry of pending
*decisions* keyed by decision_id and scoped to a run. A decision has a
`kind` (`tool_approval` | `choice`) and resolves with a rich `Resolution`
(approve / deny / edit / choose). The async-wait, run-scoping, single-shot,
and discard semantics are carried over verbatim from ApprovalRegistry.

`resolve()` also accepts a plain "approve"/"deny" string for back-compat
with callers (and the /approvals endpoint) written against the old API.
"""

from __future__ import annotations

import asyncio
from dataclasses import dataclass, field
from typing import Any, Literal

from pydantic import BaseModel, ValidationError

DecisionKind = Literal["tool_approval", "choice"]
ResolutionAction = Literal["approve", "deny", "edit", "choose"]


class Resolution(BaseModel):
    action: ResolutionAction
    updated_input: dict[str, Any] | None = None
    option_id: str | None = None


@dataclass
class _PendingDecision:
    run_id: str
    kind: DecisionKind
    event: asyncio.Event = field(default_factory=asyncio.Event)
    resolution: Resolution | None = None


class RunControlRegistry:
    """In-process, async-safe registry of pending decisions, keyed by
    decision_id and scoped to the requesting run. Single instance per
    harness process (owned by the FastAPI lifespan)."""

    def __init__(self) -> None:
        self._pending: dict[str, _PendingDecision] = {}

    def register(
        self, decision_id: str, run_id: str, *, kind: DecisionKind = "tool_approval"
    ) -> asyncio.Event:
        # decision_id is a fresh uuid4 hex at every call site, so a collision
        # is not a reachable path. Guard anyway: silently overwriting an
        # existing entry would orphan the first waiter on an event that
        # resolve() — now pointing at the new entry — can never set. Fail
        # loudly instead of hanging.
        if decision_id in self._pending:
            raise ValueError(f"decision_id already registered: {decision_id}")
        entry = _PendingDecision(run_id=run_id, kind=kind)
        self._pending[decision_id] = entry
        return entry.event

    def resolve(
        self, decision_id: str, resolution: Resolution | str, run_id: str
    ) -> bool:
        """Set the resolution and unblock the waiter. Accepts a Resolution
        or a plain "approve"/"deny" string (coerced) for back-compat.
        Returns False when the decision is unknown, already resolved
        (single-shot, first writer wins), or belongs to a different run."""
        if isinstance(resolution, str):
            try:
                resolution = Resolution(action=resolution)  # type: ignore[arg-type]
            except ValidationError:
                return False
        entry = self._pending.get(decision_id)
        if entry is None or entry.run_id != run_id or entry.event.is_set():
            return False
        entry.resolution = resolution
        entry.event.set()
        return True

    def decision(self, decision_id: str) -> Resolution | None:
        entry = self._pending.get(decision_id)
        return entry.resolution if entry is not None else None

    def kind(self, decision_id: str) -> DecisionKind | None:
        entry = self._pending.get(decision_id)
        return entry.kind if entry is not None else None

    def kind_for_run(self, decision_id: str, run_id: str) -> DecisionKind | None:
        """Run-scoped variant of `kind`: returns the kind only when the
        decision exists AND belongs to `run_id`. The API layer uses this so a
        decision_id from another run collapses to 404 (no kind/ownership leak)
        instead of surfacing a 422 kind-mismatch."""
        entry = self._pending.get(decision_id)
        if entry is None or entry.run_id != run_id:
            return None
        return entry.kind

    def discard(self, decision_id: str) -> None:
        self._pending.pop(decision_id, None)
