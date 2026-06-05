from __future__ import annotations

import operator
from datetime import datetime
from typing import Annotated, Any, Literal, TypedDict
from uuid import uuid4

from langchain_core.messages import BaseMessage
from pydantic import BaseModel, Field

from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent


class DataStep(BaseModel):
    id: str = Field(default_factory=lambda: f"step_{uuid4().hex[:8]}")
    intent: str
    tool: str
    args: dict[str, Any] = Field(default_factory=dict)
    rationale: str


class DataPlan(BaseModel):
    steps: list[DataStep] = Field(default_factory=list, max_length=4)
    final_format: Literal["answer", "story"] = "answer"


class DataEvidence(BaseModel):
    step_id: str
    tool: str
    source: str
    refreshed_at: datetime | None
    output: dict[str, Any] = Field(default_factory=dict)
    sample_size: int = 0
    is_stale: bool = False


class DataState(TypedDict, total=False):
    user_message: str
    ctx: HarnessContext
    plan: DataPlan | None
    evidence: Annotated[list[DataEvidence], operator.add]
    pending_step_index: int
    answer: str | None
    failure: str | None
    # Prior turns hydrated from `ConversationStore` by the supervisor before
    # graph dispatch. LLM-bearing agents (filter_expert / synthesizer /
    # agentic_graph.planner / meta_agent via kwarg) prepend these to their
    # `[SystemMessage, current HumanMessage]` so multi-turn chats actually
    # carry context across `/runs` calls. Empty list when conversation_id is
    # absent or the store has no prior turns for it.
    prior_messages: list[BaseMessage]
    # Event channel: nodes return {"_events": [evt, ...]} deltas;
    # LangGraph appends via operator.add so the run record can drain
    # them in document order. Phase D wires a Phase 1 SSE consumer.
    _events: Annotated[list[HarnessEvent], operator.add]
