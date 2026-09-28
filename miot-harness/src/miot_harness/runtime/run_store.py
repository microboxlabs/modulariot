import json
import logging
import re
from pathlib import Path
from typing import Any

from pydantic import BaseModel, Field

from miot_harness.runtime.events import HarnessEvent

logger = logging.getLogger(__name__)

# Statuses of a run that has not reached a terminal point.
UNFINISHED_STATUSES = frozenset({"created", "queued", "running"})

# `status` is the second field a record is saved with, so reading the head of
# the file tells an unfinished run apart without parsing its events.
_UNFINISHED_HEAD = re.compile(r'"status":\s*"(created|queued|running)"')
_HEAD_BYTES = 512


class HarnessRunRecord(BaseModel):
    run_id: str
    status: str = "created"
    events: list[HarnessEvent] = Field(default_factory=list)
    artifacts: list[dict[str, Any]] = Field(default_factory=list)
    answer: str | None = None
    # The format `answer` was rendered in (see runtime.answer_render). Echoed so
    # callers know how to interpret the string. Default keeps legacy persisted
    # records (written before this field existed) loadable.
    # Security note: the "html" format is unsanitized Markdown-to-HTML;
    # consumers that inject it into a DOM must sanitize to prevent XSS.
    answer_format: str = "markdown"
    # Ground-or-flag (semantic-layer continual learning): assumptions the
    # model declared because it answered using a business term with no
    # authoritative knowledge-card definition. Each is a dict
    # {term, interpretation, predicate, grounded: false}. Empty when every term
    # was grounded. Default keeps legacy persisted records loadable, and feeds
    # the capture/distill loop (a labeled hypothesis awaiting confirmation).
    assumptions: list[dict[str, Any]] = Field(default_factory=list)
    # Phase E (plan 13): the conversation this run belongs to. None for
    # one-shot requests; set when the caller passes `conversation_id`.
    # Langfuse groups runs by this attribute.
    conversation_id: str | None = None
    # The conversation's compacted summary as of the end of this run, when
    # the store holds one. Callers persist it with their transcript and
    # replay it (`UserRequest.conversation_summary`) after a restart.
    conversation_summary: str | None = None
    # How full the conversation model's context window was after the run's
    # last model turn: `model`, `window`, `used`, `ratio` and an approximate
    # `breakdown` (system, tools, history, message, run). None when no agent
    # loop ran.
    context: dict[str, Any] | None = None
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

    def mark_interrupted(self) -> list[str]:
        """Fail every run saved as unfinished, with reason ``interrupted``.

        Run tasks live in the process, so after a restart nothing will finish
        them; without this a caller polling or re-attaching waits forever.
        Returns the ids it marked.
        """
        marked: list[str] = []
        for path in self.runs_dir.glob("*.json"):
            try:
                with path.open("rb") as file:
                    head = file.read(_HEAD_BYTES).decode("utf-8", "ignore")
                if not _UNFINISHED_HEAD.search(head):
                    continue
                record = self.load(path.stem)
            except (OSError, ValueError):
                logger.warning("Run store: could not read %s", path.name, exc_info=True)
                continue
            if record.status not in UNFINISHED_STATUSES:
                continue
            record.status = "failed"
            record.events.append(
                HarnessEvent(
                    run_id=record.run_id,
                    seq=len(record.events),
                    type="run.failed",
                    message="Run interrupted: the harness restarted",
                    data={"error": "interrupted", "reason": "interrupted"},
                )
            )
            self.save(record)
            marked.append(record.run_id)
        return marked
