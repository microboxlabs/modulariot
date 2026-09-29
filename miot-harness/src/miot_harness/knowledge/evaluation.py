"""Before/after evaluations of knowledge changes.

Each case is asked twice in a fresh one-shot run on the same model: the
baseline with the stored knowledge plus `baseline_changes` (the undo of changes
already saved, when those are what is tested), the candidate with the stored
knowledge plus `changes`, each as a run overlay. With neither, the case is
asked once, as the candidate. A judge model scores every answer 0–5 against
the case's expectation: the configured judge model, else the evaluation's
model, and the run's own model once if that call fails. Expected skills are
checked separately against the skills the run loaded. The evaluation is kept
as JSON under the tenant's `evals/tenants/<T>/results/`.
"""

from __future__ import annotations

import asyncio
import json
import logging
import math
import re
import time
from collections.abc import Awaitable, Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Protocol
from uuid import uuid4

from langchain_core.language_models import BaseChatModel
from langchain_core.messages import HumanMessage, SystemMessage
from pydantic import BaseModel, Field

from miot_harness.agents.chat_models import response_text
from miot_harness.datasource.workspace_store import _write_atomic
from miot_harness.knowledge.changes import MAX_OVERLAY_CHANGES, KnowledgeChange
from miot_harness.runtime.answer_blocks import parse_blocks
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.run_store import HarnessRunRecord

logger = logging.getLogger(__name__)

# Runs are made under this user, so they stay out of the trainer's own run list.
EVAL_USER_ID = "learning-evals@example.com"
MAX_CASES = 50
MAX_REPEAT = 5
_MAX_JUDGED_CHARS = 12_000
_LIST_LIMIT = 50


class EvalCaseInput(BaseModel):
    id: str | None = Field(default=None, max_length=128)
    question: str = Field(min_length=1, max_length=4_000)
    expectation: str = Field(default="", max_length=4_000)
    expect_skill: str | list[str] | None = None
    expect_no_skill: str | list[str] | None = None


class EvaluationRequest(BaseModel):
    tenant_id: str | None = None
    model: str | None = Field(default=None, max_length=80)
    cases: list[EvalCaseInput] = Field(min_length=1, max_length=MAX_CASES)
    changes: list[KnowledgeChange] = Field(default_factory=list, max_length=MAX_OVERLAY_CHANGES)
    baseline_changes: list[KnowledgeChange] = Field(
        default_factory=list, max_length=MAX_OVERLAY_CHANGES
    )
    repeat: int = Field(default=1, ge=1, le=MAX_REPEAT)


class Runner(Protocol):
    def __call__(
        self,
        request: UserRequest,
        *,
        run_id_override: str | None = None,
        caller_token: str | None = None,
        organization: str | None = None,
    ) -> Awaitable[HarnessRunRecord]: ...


# (question, expectation, answer, model or None) -> (score 0–5 or None, one-line reason)
Judge = Callable[[str, str, str, str | None], Awaitable[tuple[float | None, str]]]
ProgressFn = Callable[[dict[str, Any]], None]


class EvaluationNotFound(LookupError):
    pass


_JUDGE_SYSTEM = (
    "You grade an assistant's answer to a question against the expectation "
    "(what a correct answer says or does). Score 0 to 5: 5 fully meets the "
    "expectation, 3 partly, 0 wrong, missing or a refusal. Judge the facts, not "
    "the style. Reply with JSON only: "
    '{"score": <0-5>, "reason": "<one short line, in the language of the question>"}'
)
_DECODER = json.JSONDecoder()
_SCORE_RE = re.compile(r"score\W{0,5}(\d+(?:[.,]\d+)?)", re.IGNORECASE)
_LEADING_SCORE_RE = re.compile(r"^\s*(\d+(?:[.,]\d+)?)\s*(?:/\s*5)?\b")


def _score(value: Any) -> float | None:
    try:
        score = float(str(value).replace(",", "."))
    except (TypeError, ValueError):
        return None
    if not math.isfinite(score):
        return None
    return max(0.0, min(5.0, score))


def _one_line(text: str, limit: int = 300) -> str:
    line = " ".join(text.split())
    return line[:limit]


def parse_verdict(text: str) -> tuple[float | None, str]:
    """The judge's score and reason. Tolerates prose around the JSON, fenced
    JSON, and a bare "score: 4"; None when no score can be read."""
    text = text or ""
    start = text.find("{")
    while start != -1:
        try:
            doc, _ = _DECODER.raw_decode(text, start)
        except ValueError:
            doc = None
        start = text.find("{", start + 1)
        if isinstance(doc, dict) and "score" in doc:
            score = _score(doc.get("score"))
            if score is not None:
                return score, _one_line(str(doc.get("reason") or ""))
    found = _SCORE_RE.search(text) or _LEADING_SCORE_RE.search(text)
    if found:
        score = _score(found.group(1))
        if score is not None:
            rest = (text[: found.start()] + text[found.end() :]).strip(" \n:-.")
            return score, _one_line(rest)
    return None, "unreadable judge reply: " + _one_line(text, 120)


def build_judge(model: Callable[[str | None], BaseChatModel]) -> Judge:
    """A judge on the chat model `model(name)` returns, built on first use."""

    async def judge(
        question: str, expectation: str, answer: str, name: str | None
    ) -> tuple[float | None, str]:
        prompt = (
            f"Question:\n{question}\n\nExpectation:\n{expectation or '(none given)'}\n\n"
            f"Answer:\n{answer[:_MAX_JUDGED_CHARS]}"
        )
        response = await model(name).ainvoke(
            [SystemMessage(content=_JUDGE_SYSTEM), HumanMessage(content=prompt)]
        )
        return parse_verdict(response_text(response))

    return judge


def answer_text(answer: str | None) -> str:
    """The readable text of a run's answer; a block array keeps its markdown
    and links."""
    if not answer:
        return ""
    try:
        blocks = parse_blocks(answer)
    except ValueError:
        return answer
    parts: list[str] = []
    for block in blocks:
        if block.type == "markdown":
            parts.append(block.value)
        elif block.type == "url":
            parts.append(f"[{block.value['name']}]({block.value['url']})")
        elif block.type != "intent":
            parts.append(json.dumps({"type": block.type, "value": block.value}, ensure_ascii=False))
    return "\n\n".join(p for p in parts if p)


def skills_used(record: HarnessRunRecord) -> list[str]:
    """Skills the run loaded by name, in order."""
    loaded = [
        str(e.data.get("skill_id"))
        for e in record.events
        if e.type == "tool.completed"
        and e.data.get("tool") == "load_skill"
        and e.data.get("loaded") is True
    ]
    return list(dict.fromkeys(loaded))


def tokens_used(record: HarnessRunRecord) -> int:
    return sum(
        int(e.data.get("input_tokens") or 0) + int(e.data.get("output_tokens") or 0)
        for e in record.events
        if e.type == "usage.recorded"
    )


def _names(value: str | list[str] | None) -> list[str]:
    if value is None:
        return []
    items = [value] if isinstance(value, str) else value
    return [s.strip() for s in items if isinstance(s, str) and s.strip()]


def trigger_check(case: EvalCaseInput, used: Sequence[str]) -> dict[str, Any] | None:
    """Whether the run loaded the skills the case expects and none it rules
    out; None when the case names no skills."""
    expected, forbidden = _names(case.expect_skill), _names(case.expect_no_skill)
    if not expected and not forbidden:
        return None
    missing = [s for s in expected if s not in used]
    unexpected = [s for s in forbidden if s in used]
    return {"ok": not missing and not unexpected, "missing": missing, "unexpected": unexpected}


def _now() -> str:
    return datetime.now(UTC).replace(microsecond=0).isoformat()


def _mean(values: Sequence[float]) -> float | None:
    return round(sum(values) / len(values), 2) if values else None


def summarize(results: Sequence[dict[str, Any]]) -> dict[str, Any]:
    def scores(side: str) -> list[float]:
        return [
            r[side]["score"]
            for r in results
            if r.get(side) and isinstance(r[side].get("score"), (int, float))
        ]

    def trigger_rate(side: str) -> float | None:
        checks = [r[side]["trigger"]["ok"] for r in results if (r.get(side) or {}).get("trigger")]
        return round(sum(checks) / len(checks), 2) if checks else None

    improved = regressed = unchanged = 0
    for r in results:
        before = (r.get("baseline") or {}).get("score")
        after = (r.get("candidate") or {}).get("score")
        if not isinstance(before, (int, float)) or not isinstance(after, (int, float)):
            continue
        if after > before:
            improved += 1
        elif after < before:
            regressed += 1
        else:
            unchanged += 1
    return {
        "baseline_avg": _mean(scores("baseline")),
        "candidate_avg": _mean(scores("candidate")),
        "improved": improved,
        "regressed": regressed,
        "unchanged": unchanged,
        "failed": sum(1 for r in results if r.get("status") == "failed"),
        "baseline_trigger": trigger_rate("baseline"),
        "candidate_trigger": trigger_rate("candidate"),
    }


@dataclass(frozen=True)
class _Job:
    tenant: str
    doc: dict[str, Any]
    request: EvaluationRequest
    caller_token: str | None
    organization: str | None

    @property
    def key(self) -> tuple[str, str]:
        return (self.tenant, self.doc["id"])


class EvaluationEngine:
    """Starts evaluations in the background and keeps their results.

    `concurrency` bounds the runs in flight across every evaluation of this
    process; each run gets `run_timeout` seconds.
    """

    def __init__(
        self,
        *,
        runner: Runner,
        judge: Judge,
        results_dir: Callable[[str], Path],
        default_model: Callable[[], str | None] = lambda: None,
        concurrency: int = 3,
        run_timeout: float = 300.0,
        skill_id: str | None = None,
        judge_model: str | None = None,
    ) -> None:
        self._runner = runner
        self._judge = judge
        self._results_dir = results_dir
        self._default_model = default_model
        self._slots = asyncio.Semaphore(concurrency)
        self._run_timeout = run_timeout
        self._skill_id = skill_id
        self._judge_model = judge_model
        self._live: dict[tuple[str, str], dict[str, Any]] = {}
        self._tasks: dict[tuple[str, str], asyncio.Task[None]] = {}
        self._listeners: dict[tuple[str, str], list[ProgressFn]] = {}

    # ---- reading -----------------------------------------------------------

    def _path(self, tenant: str, evaluation_id: str) -> Path:
        return self._results_dir(tenant) / f"{evaluation_id}.json"

    def get(self, tenant: str, evaluation_id: str) -> dict[str, Any]:
        live = self._live.get((tenant, evaluation_id))
        if live is not None:
            snapshot: dict[str, Any] = json.loads(json.dumps(live))
            return snapshot
        if not re.fullmatch(r"ev-[0-9a-f]{16}", evaluation_id):
            raise EvaluationNotFound(evaluation_id)
        try:
            doc: dict[str, Any] = json.loads(
                self._path(tenant, evaluation_id).read_text(encoding="utf-8")
            )
        except (FileNotFoundError, ValueError) as exc:
            raise EvaluationNotFound(evaluation_id) from exc
        return _settled(doc)

    def recent(self, tenant: str, limit: int = _LIST_LIMIT) -> list[dict[str, Any]]:
        """The newest evaluations, by file time; only `limit` files are read."""
        folder = self._results_dir(tenant)
        paths = sorted(
            folder.glob("ev-*.json") if folder.is_dir() else (),
            key=_mtime,
            reverse=True,
        )
        keys = ("id", "status", "model", "created_at", "finished_at", "progress", "summary")
        listed: list[dict[str, Any]] = []
        for path in paths[:limit]:
            live = self._live.get((tenant, path.stem))
            try:
                doc = live or _settled(json.loads(path.read_text(encoding="utf-8")))
            except (OSError, ValueError):
                continue
            listed.append({k: doc.get(k) for k in keys} | {"cases": len(doc.get("results") or [])})
        return listed

    # ---- running -----------------------------------------------------------

    def start(
        self,
        tenant: str,
        request: EvaluationRequest,
        *,
        started_by: str = "",
        caller_token: str | None = None,
        organization: str | None = None,
    ) -> str:
        evaluation_id = f"ev-{uuid4().hex[:16]}"
        compared = bool(request.changes or request.baseline_changes)
        sides = ("baseline", "candidate") if compared else ("candidate",)
        model = request.model or self._default_model()
        doc: dict[str, Any] = {
            "id": evaluation_id,
            "status": "running",
            "model": model,
            "judge_model": self._judge_model or model,
            "created_at": _now(),
            "finished_at": None,
            "started_by": started_by,
            "repeat": request.repeat,
            "changes": [c.model_dump() for c in request.changes],
            "baseline_changes": [c.model_dump() for c in request.baseline_changes],
            "progress": {"done": 0, "total": len(request.cases) * len(sides) * request.repeat},
            "summary": None,
            "results": [
                {"case": c.model_dump(exclude_none=True), "baseline": None, "candidate": None}
                for c in request.cases
            ],
            "error": None,
        }
        job = _Job(tenant, doc, request, caller_token, organization)
        self._write(tenant, doc)
        self._live[job.key] = doc
        self._tasks[job.key] = asyncio.create_task(self._run(job, sides))
        return evaluation_id

    async def wait(
        self,
        tenant: str,
        evaluation_id: str,
        max_seconds: float,
        on_progress: ProgressFn | None = None,
    ) -> dict[str, Any]:
        """The evaluation once it ends, or as it stands after `max_seconds`."""
        key = (tenant, evaluation_id)
        task = self._tasks.get(key)
        if task is not None and on_progress is not None:
            self._listeners.setdefault(key, []).append(on_progress)
        try:
            if task is not None:
                await asyncio.wait({task}, timeout=max_seconds)
        finally:
            if on_progress is not None and on_progress in self._listeners.get(key, []):
                self._listeners[key].remove(on_progress)
        return self.get(tenant, evaluation_id)

    async def _run(self, job: _Job, sides: tuple[str, ...]) -> None:
        doc = job.doc
        try:
            await asyncio.gather(
                *(
                    self._case(job, index, case, sides)
                    for index, case in enumerate(job.request.cases)
                )
            )
            doc["status"] = "done"
        except Exception as exc:  # noqa: BLE001 — recorded on the evaluation
            logger.exception("Evaluation %s failed", doc["id"])
            doc["status"] = "failed"
            doc["error"] = _one_line(str(exc) or type(exc).__name__)
        finally:
            doc["summary"] = summarize(doc["results"])
            doc["finished_at"] = _now()
            saved = self._save(job.tenant, doc)
            self._notify(job.key, doc)
            if saved:
                self._live.pop(job.key, None)
            self._tasks.pop(job.key, None)
            self._listeners.pop(job.key, None)

    async def _case(
        self, job: _Job, index: int, case: EvalCaseInput, sides: tuple[str, ...]
    ) -> None:
        result = job.doc["results"][index]

        async def side(name: str) -> None:
            attempts = await asyncio.gather(
                *(self._attempt(job, index, case, name, n) for n in range(job.request.repeat))
            )
            result[name] = _merge(attempts)

        await asyncio.gather(*(side(name) for name in sides))
        errors = [result[s]["error"] for s in sides if result[s] and result[s].get("error")]
        result["status"] = "failed" if errors else "done"
        if errors:
            result["error"] = errors[0]
        job.doc["summary"] = summarize(job.doc["results"])
        self._save(job.tenant, job.doc)

    async def _attempt(
        self, job: _Job, index: int, case: EvalCaseInput, side: str, attempt: int
    ) -> dict[str, Any]:
        overlay = job.request.changes if side == "candidate" else job.request.baseline_changes
        user_request = UserRequest(
            message=case.question,
            thread_id=f"learning-{job.doc['id']}-{index}-{side}-{attempt}",
            tenant_id=job.tenant,
            user_id=EVAL_USER_ID,
            model=job.request.model,
            skill_id=self._skill_id,
            answer_format="json",
            knowledge_overlay=list(overlay),
        )
        if overlay:
            user_request.allow_overlay()
        run: dict[str, Any] = {
            "answer": "",
            "score": None,
            "reason": "",
            "run_id": f"run_{uuid4().hex}",
            "seconds": None,
            "tokens": None,
            "skills_used": [],
            "model": job.doc["model"],
        }
        async with self._slots:
            started = time.monotonic()
            record = await self._execute(job, user_request, run)
            run["seconds"] = round(time.monotonic() - started, 1)
            if record is not None:
                run.update(
                    answer=answer_text(record.answer),
                    tokens=tokens_used(record),
                    skills_used=skills_used(record),
                    model=record.model or job.doc["model"],
                )
                if record.status != "completed":
                    run["error"] = f"run {record.status}"
            run["trigger"] = trigger_check(case, run["skills_used"])
            await self._score(case, run, job.doc["judge_model"])
        job.doc["progress"]["done"] += 1
        self._notify(job.key, job.doc)
        return run

    async def _execute(
        self, job: _Job, request: UserRequest, run: dict[str, Any]
    ) -> HarnessRunRecord | None:
        """The run's record, or None with `run["error"]` set."""
        try:
            return await asyncio.wait_for(
                self._runner(
                    request,
                    run_id_override=run["run_id"],
                    caller_token=job.caller_token,
                    organization=job.organization,
                ),
                timeout=self._run_timeout,
            )
        except TimeoutError:
            run["error"] = f"timed out after {self._run_timeout:g} s"
        except Exception as exc:  # noqa: BLE001 — one run failing is a case result
            run["error"] = _one_line(str(exc) or type(exc).__name__)
        return None

    async def _score(self, case: EvalCaseInput, run: dict[str, Any], judge: str | None) -> None:
        """Score with `judge`; if that call fails, once more with the model the
        run answered on."""
        if run.get("error"):
            run["reason"] = run["error"]
            return
        if not run["answer"].strip():
            run.update(score=0.0, reason="empty answer")
            return
        for model in dict.fromkeys([judge, run.get("model") or judge]):
            try:
                run["score"], run["reason"] = await self._judge(
                    case.question, case.expectation, run["answer"], model
                )
            except Exception as exc:  # noqa: BLE001
                run["reason"] = "judge failed: " + _one_line(str(exc) or type(exc).__name__)
                logger.warning("Judge model %s failed: %s", model, run["reason"])
                continue
            run["judge_model"] = model
            return

    def _notify(self, key: tuple[str, str], doc: dict[str, Any]) -> None:
        for listener in self._listeners.get(key, ()):
            try:
                listener(doc)
            except Exception:  # noqa: BLE001 — a listener must not stop the evaluation
                logger.warning("Evaluation progress listener failed", exc_info=True)

    def _write(self, tenant: str, doc: dict[str, Any]) -> None:
        _write_atomic(
            self._path(tenant, doc["id"]),
            json.dumps(doc, ensure_ascii=False, indent=2, default=str),
        )

    def _save(self, tenant: str, doc: dict[str, Any]) -> bool:
        """Whether `doc` was saved. A failed save is recorded on it, and the
        engine keeps it in memory so it can still be read."""
        try:
            self._write(tenant, doc)
        except OSError:
            logger.warning("Could not save evaluation %s", doc["id"], exc_info=True)
            doc["error"] = "the results could not be saved"
            return False
        return True


def _mtime(path: Path) -> float:
    try:
        return path.stat().st_mtime
    except OSError:
        return 0.0


def _settled(doc: dict[str, Any]) -> dict[str, Any]:
    """A saved evaluation no process is running any more (the harness
    restarted mid-way) reads as failed, not running forever."""
    if doc.get("status") == "running":
        doc["status"] = "failed"
        doc["error"] = doc.get("error") or "interrupted by a restart"
    return doc


def _merge(attempts: Sequence[dict[str, Any]]) -> dict[str, Any]:
    """One run's view of repeated attempts: the first scored attempt's answer
    and reason, the mean score of the scored ones. Failed only when all are."""
    if len(attempts) == 1:
        return dict(attempts[0])
    scored = [a for a in attempts if isinstance(a.get("score"), (int, float))]
    shown = dict(scored[0] if scored else attempts[0])
    shown["score"] = _mean([a["score"] for a in scored])
    shown["attempts"] = list(attempts)
    if scored:
        shown.pop("error", None)
    return shown
