import json
import logging
import re
from datetime import datetime
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
    # The conversation model and skill the run was asked for. None on records
    # written before these fields existed.
    model: str | None = None
    skill_id: str | None = None


_TERMINAL = ("completed", "failed")


class RunStep(BaseModel):
    label: str
    tool: str | None = None


class RunDelegate(BaseModel):
    brief: str
    status: str


class RunPendingApproval(BaseModel):
    approval_id: str
    tool: str | None = None


class RunUsage(BaseModel):
    """`input_tokens` excludes the prompt read from or written to the cache,
    which the cache fields count."""

    calls: int = 0
    input_tokens: int = 0
    output_tokens: int = 0
    cache_read_input_tokens: int = 0
    cache_creation_input_tokens: int = 0


class RunSummary(BaseModel):
    """What GET /runs lists for one run: no events, answer or artifacts."""

    run_id: str
    conversation_id: str | None = None
    tenant_id: str | None = None
    user_id: str | None = None
    status: str
    started_at: datetime | None = None
    finished_at: datetime | None = None
    model: str | None = None
    skill_id: str | None = None
    last_step: RunStep | None = None
    usage: RunUsage = Field(default_factory=RunUsage)
    delegates: list[RunDelegate] = Field(default_factory=list)
    # A call the run is waiting for the user to approve.
    pending_approval: RunPendingApproval | None = None


def _last_step(events: list[HarnessEvent]) -> RunStep | None:
    event = next((e for e in reversed(events) if e.type == "tool.started"), None)
    if event is None:
        return None
    tool = event.data.get("tool")
    return RunStep(label=event.message, tool=tool if isinstance(tool, str) else None)


def _usage(events: list[HarnessEvent]) -> RunUsage:
    usage = RunUsage()
    for event in events:
        if event.type != "usage.recorded":
            continue
        usage.calls += 1
        usage.input_tokens += int(event.data.get("input_tokens") or 0)
        usage.output_tokens += int(event.data.get("output_tokens") or 0)
        usage.cache_read_input_tokens += int(event.data.get("cache_read_input_tokens") or 0)
        usage.cache_creation_input_tokens += int(event.data.get("cache_creation_input_tokens") or 0)
    return usage


def _delegates(events: list[HarnessEvent]) -> list[RunDelegate]:
    delegates: list[RunDelegate] = []
    for event in events:
        brief = event.data.get("brief")
        if not isinstance(brief, str):
            continue
        if event.type == "agent.started" and event.data.get("agent") == "workhorse":
            delegates.append(RunDelegate(brief=brief, status="running"))
        elif event.type == "delegate.completed":
            # Delegates run concurrently, so match the finished one by brief.
            match = next((d for d in delegates if d.status == "running" and d.brief == brief), None)
            if match is not None:
                match.status = "completed"
    return delegates


def _pending_approval(events: list[HarnessEvent]) -> RunPendingApproval | None:
    resolved = {e.data.get("approval_id") for e in events if e.type == "approval.resolved"}
    for event in reversed(events):
        approval_id = event.data.get("approval_id")
        if event.type != "approval.requested" or not isinstance(approval_id, str):
            continue
        if approval_id in resolved:
            return None
        tool = event.data.get("tool")
        return RunPendingApproval(
            approval_id=approval_id, tool=tool if isinstance(tool, str) else None
        )
    return None


def summarize(record: HarnessRunRecord) -> RunSummary:
    events = record.events
    finished = record.status in _TERMINAL and bool(events)
    return RunSummary(
        run_id=record.run_id,
        conversation_id=record.conversation_id,
        tenant_id=record.tenant_id,
        user_id=record.user_id,
        status=record.status,
        started_at=events[0].created_at if events else None,
        finished_at=events[-1].created_at if finished else None,
        model=record.model or (record.context or {}).get("model"),
        skill_id=record.skill_id,
        last_step=_last_step(events),
        usage=_usage(events),
        delegates=_delegates(events),
        pending_approval=_pending_approval(events) if record.status == "running" else None,
    )


class JsonRunStore:
    def __init__(self, root: Path) -> None:
        self.root = root
        self.runs_dir = root / "runs"
        self.runs_dir.mkdir(parents=True, exist_ok=True)
        # One small summary per run beside the full record, so listing runs
        # never parses whole event logs.
        self.index_dir = root / "run_index"
        self.index_dir.mkdir(parents=True, exist_ok=True)

    def save(self, record: HarnessRunRecord) -> None:
        path = self.runs_dir / f"{record.run_id}.json"
        path.write_text(record.model_dump_json(indent=2), encoding="utf-8")
        summary_path = self.index_dir / f"{record.run_id}.json"
        summary_path.write_text(summarize(record).model_dump_json(), encoding="utf-8")

    def recent_summaries(self, scan_cap: int = 500) -> list[RunSummary]:
        """Summaries of the most recently saved runs, newest first. Only the
        `scan_cap` newest index files are read; runs saved before the index
        existed are not listed."""
        entries: list[tuple[float, Path]] = []
        for path in self.index_dir.glob("*.json"):
            try:
                entries.append((path.stat().st_mtime, path))
            except FileNotFoundError:
                continue
        entries.sort(key=lambda entry: entry[0], reverse=True)
        summaries: list[RunSummary] = []
        for _, path in entries[:scan_cap]:
            try:
                summaries.append(RunSummary.model_validate_json(path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                continue
        return summaries

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
