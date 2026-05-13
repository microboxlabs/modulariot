from datetime import UTC, datetime
from typing import Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class EvidenceRef(BaseModel):
    id: str
    label: str
    source: str
    query: str | None = None


class StoryMetric(BaseModel):
    label: str
    value: str
    trend: Literal["up", "down", "flat"]
    evidence_id: str


class StorySection(BaseModel):
    title: str
    body: str
    evidence_ids: list[str] = Field(default_factory=list)


class WidgetDraft(BaseModel):
    title: str
    kind: Literal["metric", "bar", "line", "table"]
    description: str
    config: dict[str, object] = Field(default_factory=dict)
    evidence_ids: list[str] = Field(default_factory=list)


class ApprovalProposal(BaseModel):
    action: str
    requires_approval: bool = True
    reason: str
    payload: dict[str, object]


class StoryArtifact(BaseModel):
    id: str = Field(default_factory=lambda: f"story_{uuid4().hex}")
    title: str
    summary: str
    sections: list[StorySection]
    metrics: list[StoryMetric]
    evidence: list[EvidenceRef]
    widget_drafts: list[WidgetDraft] = Field(default_factory=list)
    approval_proposals: list[ApprovalProposal] = Field(default_factory=list)
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
