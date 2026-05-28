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
    # Phase E (plan 13): the conversation this run belongs to. None for
    # one-shot requests; set when the caller passes `conversation_id`.
    # Langfuse groups runs by this attribute.
    conversation_id: str | None = None
    # Plan 07 gap 8: the resolved identity this run executed under. The
    # API layer surfaces these so callers can verify the signed-header
    # override actually took effect (body-supplied identity is ignored
    # when X-MIOT-Identity is present). Default empty for backwards
    # compatibility with on-disk records and bare-constructor tests;
    # HarnessSupervisor.run populates them from ctx on every real run.
    tenant_id: str = ""
    user_id: str = ""


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
