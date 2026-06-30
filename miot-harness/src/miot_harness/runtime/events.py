from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

HarnessEventType = Literal[
    "run.started",
    "route.selected",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "approval.requested",
    "approval.auto",
    "steering.mode_denied",
    "artifact.created",
    "plan.created",
    # Deprecated: superseded by agent.started / agent.completed. Kept in
    # the union for back-compat with persisted run records and older
    # SSE consumers; no new code emits this.
    "agent.turn",
    "agent.started",
    "agent.completed",
    "thinking.delta",
    "thinking.completed",
    "usage.recorded",
    "freshness.warning",
    "verification.completed",
    "answer.delta",
    "answer.completed",
    "run.completed",
    "run.failed",
]


class HarnessEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt_{uuid4().hex}")
    run_id: str
    seq: int = 0
    type: HarnessEventType
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
