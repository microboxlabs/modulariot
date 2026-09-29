"""One tool call and what it returned."""

from __future__ import annotations

from datetime import datetime
from typing import Any, Literal
from uuid import uuid4

from pydantic import BaseModel, Field


class DataStep(BaseModel):
    id: str = Field(default_factory=lambda: f"step_{uuid4().hex[:8]}")
    intent: str
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    rationale: str


# `empty` is "0 rows matched the filter"; `empty_no_timestamp` is "the
# snapshot was never refreshed". The answer has to say which one happened.
FreshnessStatus = Literal["fresh", "stale", "no_timestamp", "empty", "empty_no_timestamp"]


class DataEvidence(BaseModel):
    step_id: str
    tool: str
    source: str
    refreshed_at: datetime | None
    output: dict[str, Any] = Field(default_factory=dict)
    sample_size: int = 0
    is_stale: bool = False
    freshness_status: FreshnessStatus = "fresh"
    # The SQL that ran, when the tool ran one, so the answer can cite it.
    executed_sql: str | None = None
    # A grep/ILIKE sample: never a total or a complete list.
    is_sample: bool = False
