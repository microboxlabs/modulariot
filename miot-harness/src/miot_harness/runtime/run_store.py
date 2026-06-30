import json
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from miot_harness.runtime.events import HarnessEvent


class HarnessRunRecord(BaseModel):
    run_id: str
    status: str = "created"
    events: list[HarnessEvent] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    answer: str | None = None
    # The format `answer` was rendered in (see runtime.answer_render). Echoed so
    # callers know how to interpret the string. Default keeps legacy persisted
    # records (written before this field existed) loadable.
    answer_format: str = "markdown"
    # Phase E (plan 13): the conversation this run belongs to. None for
    # one-shot requests; set when the caller passes `conversation_id`.
    # Langfuse groups runs by this attribute.
    conversation_id: str | None = None
    # Issue #522 R2 + Plan 07 gap 8: the identity this run executed
    # under. `tenant_id` is recorded so the SSE replay endpoint can
    # refuse a cross-tenant subscriber even for terminal runs that have
    # left the in-flight tracker; `user_id` is surfaced so callers can
    # verify the signed-header override actually took effect
    # (body-supplied identity is ignored when X-MIOT-Identity is
    # present). Both Optional so pre-existing persisted records still
    # load (None = legacy, allowed through the tenant guard);
    # HarnessSupervisor.run populates them from ctx on every real run.
    tenant_id: str | None = None
    user_id: str | None = None


class JsonRunStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.runs_dir = root / "runs"
        self.runs_dir.mkdir(parents=True, exist_ok=True)

    def save(self, record: HarnessRunRecord) -> None:
        path = self.runs_dir / f"{record.run_id}.json"
        path.write_text(record.model_dump_json(indent=2), encoding="utf-8")

    def load(self, run_id: str) -> HarnessRunRecord:
        path = self.runs_dir / f"{run_id}.json"
        return HarnessRunRecord.model_validate(json.loads(path.read_text(encoding="utf-8")))
