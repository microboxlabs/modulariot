from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

HarnessEventType = Literal[
    "run.started",
    "route.selected",
    "tool.started",
    "tool.completed",
    "approval.requested",
    "artifact.created",
    "run.completed",
    "run.failed",
]


class HarnessEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt_{uuid4().hex}")
    run_id: str
    type: HarnessEventType
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))

