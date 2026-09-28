from datetime import UTC, datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field

HarnessEventType = Literal[
    "run.started",
    "tool.started",
    "tool.completed",
    "tool.failed",
    "approval.requested",
    "approval.auto",
    "steering.mode_denied",
    "agent.started",
    "agent.completed",
    "thinking.delta",
    "thinking.completed",
    "usage.recorded",
    # How full the conversation model's context window is after a turn.
    "context.usage",
    "freshness.warning",
    # The answer used a business term with no knowledge card; `data` carries
    # the assumption the model declared.
    "grounding.gap",
    # The advisor answered a consult; a workhorse finished a delegated brief.
    "advisor.consulted",
    "delegate.completed",
    # A tool produced a chart, table or KPI for the user; `data.widget` holds
    # the spec and the rows, which the model never sees in full.
    "widget.created",
    # A tool made a document for the user (a process diagram); `data` holds
    # {id, kind: svg|mermaid, title, content}.
    "artifact.created",
    # A dashboard the user can create from widgets of the thread; `data` holds
    # {id, title, description, widgets: [widget ids]}. The app saves it.
    "dashboard.draft",
    "answer.delta",
    "answer.completed",
    "run.completed",
    "run.failed",
    # No longer emitted. Kept so run records saved by older versions load.
    "route.selected",
    "plan.created",
    "agent.turn",
    "verification.completed",
]


class HarnessEvent(BaseModel):
    id: str = Field(default_factory=lambda: f"evt_{uuid4().hex}")
    run_id: str
    seq: int = 0
    type: HarnessEventType
    message: str
    data: dict[str, Any] = Field(default_factory=dict)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
