"""Before/after evaluations: runs, judging, summary, persistence, limits."""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
from typing import Any

import pytest
from langchain_core.messages import AIMessage

from miot_harness.knowledge.changes import KnowledgeChange
from miot_harness.knowledge.evaluation import (
    EVAL_USER_ID,
    EvalCaseInput,
    EvaluationEngine,
    EvaluationNotFound,
    EvaluationRequest,
    answer_text,
    build_judge,
    parse_verdict,
)
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.run_store import HarnessRunRecord

_RULE = KnowledgeChange(
    layer="rule", id="cargado", title="Cargado", content="Loaded trips are rows in live_trip."
)


def _record(request: UserRequest, run_id: str, answer: str, skills: tuple[str, ...] = ()) -> Any:
    events = [
        HarnessEvent(
            run_id=run_id,
            type="tool.completed",
            message="",
            data={"tool": "load_skill", "skill_id": s, "loaded": True},
        )
        for s in skills
    ]
    events.append(
        HarnessEvent(
            run_id=run_id,
            type="usage.recorded",
            message="",
            data={"input_tokens": 100, "output_tokens": 20},
        )
    )
    return HarnessRunRecord(
        run_id=run_id,
        status="completed",
        answer=json.dumps(
            [{"type": "intent", "value": "ask"}, {"type": "markdown", "value": answer}]
        ),
        events=events,
        model=request.model or "default-model",
    )


class FakeRunner:
    """Answers from the overlay it sees: knows `live_trip` only with the rule."""

    def __init__(self, delay: float = 0.0, hang_on: str | None = None) -> None:
        self.requests: list[UserRequest] = []
        self.delay = delay
        self.hang_on = hang_on
        self.active = 0
        self.peak = 0

    async def __call__(
        self,
        request: UserRequest,
        *,
        run_id_override: str | None = None,
        caller_token: str | None = None,
        organization: str | None = None,
    ) -> HarnessRunRecord:
        self.requests.append(request)
        self.active += 1
        self.peak = max(self.peak, self.active)
        try:
            if self.hang_on and self.hang_on in request.message:
                await asyncio.sleep(3600)
            await asyncio.sleep(self.delay)
            overlay = request.to_context().knowledge_overlay
            answer = "12 trips in live_trip." if overlay else "I don't know."
            skills = ("trips",) if overlay else ()
            return _record(request, run_id_override or "run", answer, skills)
        finally:
            self.active -= 1


async def fake_judge(question: str, expectation: str, answer: str) -> tuple[float | None, str]:
    return (5.0, "mentions live_trip") if "live_trip" in answer else (1.0, "no data")


def _engine(tmp_path: Path, runner: Any, **kw: Any) -> EvaluationEngine:
    return EvaluationEngine(
        runner=runner,
        judge=kw.pop("judge", fake_judge),
        results_dir=lambda tenant: tmp_path / tenant / "results",
        default_model=lambda: "default-model",
        skill_id="miot-analyst",
        **kw,
    )


def _cases(n: int, **extra: Any) -> list[EvalCaseInput]:
    return [
        EvalCaseInput(id=f"c{i}", question=f"question {i}", expectation="uses live_trip", **extra)
        for i in range(n)
    ]


async def _finish(engine: EvaluationEngine, tenant: str, evaluation_id: str) -> dict[str, Any]:
    return await engine.wait(tenant, evaluation_id, timeout=10)


@pytest.mark.asyncio
async def test_baseline_and_candidate_differ_only_by_the_overlay(tmp_path: Path) -> None:
    runner = FakeRunner()
    engine = _engine(tmp_path, runner)
    evaluation_id = engine.start(
        "t1",
        EvaluationRequest(model="m1", cases=_cases(1), changes=[_RULE]),
        caller_token="tok",
        organization="org",
    )
    doc = await _finish(engine, "t1", evaluation_id)

    baseline, candidate = sorted(runner.requests, key=lambda r: "candidate" in r.thread_id)
    assert baseline.to_context().knowledge_overlay == ()
    assert candidate.to_context().knowledge_overlay == (_RULE,)
    assert baseline.thread_id != candidate.thread_id
    ignored = {"knowledge_overlay", "thread_id"}
    assert baseline.model_dump(exclude=ignored) == candidate.model_dump(exclude=ignored)
    assert baseline.user_id == EVAL_USER_ID
    assert (baseline.model, baseline.skill_id, baseline.conversation_id) == (
        "m1",
        "miot-analyst",
        None,
    )

    assert doc["status"] == "done"
    assert doc["model"] == "m1"
    assert doc["progress"] == {"done": 2, "total": 2}
    result = doc["results"][0]
    assert result["status"] == "done"
    assert result["baseline"]["answer"] == "I don't know."
    assert result["baseline"]["score"] == 1.0
    assert result["candidate"]["answer"] == "12 trips in live_trip."
    assert result["candidate"]["score"] == 5.0
    assert result["candidate"]["reason"] == "mentions live_trip"
    assert result["candidate"]["tokens"] == 120
    assert result["candidate"]["skills_used"] == ["trips"]
    assert result["candidate"]["run_id"].startswith("run_")
    assert doc["summary"]["baseline_avg"] == 1.0
    assert doc["summary"]["candidate_avg"] == 5.0
    assert (doc["summary"]["improved"], doc["summary"]["regressed"]) == (1, 0)


@pytest.mark.asyncio
async def test_without_changes_each_case_runs_once(tmp_path: Path) -> None:
    runner = FakeRunner()
    engine = _engine(tmp_path, runner)
    doc = await _finish(engine, "t1", engine.start("t1", EvaluationRequest(cases=_cases(2))))
    assert len(runner.requests) == 2
    assert all(r["baseline"] is None for r in doc["results"])
    assert doc["model"] == "default-model"
    assert doc["summary"]["baseline_avg"] is None
    assert doc["summary"]["candidate_avg"] == 1.0


@pytest.mark.asyncio
async def test_skill_triggering_is_scored_apart_from_the_answer(tmp_path: Path) -> None:
    engine = _engine(tmp_path, FakeRunner())
    cases = [
        EvalCaseInput(question="q1", expectation="e", expect_skill="trips"),
        EvalCaseInput(question="q2", expectation="e", expect_no_skill=["trips"]),
    ]
    doc = await _finish(
        engine, "t1", engine.start("t1", EvaluationRequest(cases=cases, changes=[_RULE]))
    )
    first, second = doc["results"]
    assert first["baseline"]["trigger"] == {"ok": False, "missing": ["trips"], "unexpected": []}
    assert first["candidate"]["trigger"]["ok"] is True
    assert second["candidate"]["trigger"] == {"ok": False, "missing": [], "unexpected": ["trips"]}
    assert doc["summary"]["baseline_trigger"] == 0.5
    assert doc["summary"]["candidate_trigger"] == 0.5


@pytest.mark.asyncio
async def test_results_are_kept_on_disk(tmp_path: Path) -> None:
    engine = _engine(tmp_path, FakeRunner())
    evaluation_id = engine.start("t1", EvaluationRequest(cases=_cases(1), changes=[_RULE]))
    await _finish(engine, "t1", evaluation_id)

    path = tmp_path / "t1" / "results" / f"{evaluation_id}.json"
    saved = json.loads(path.read_text(encoding="utf-8"))
    assert saved["status"] == "done"
    assert saved["changes"][0]["id"] == "cargado"

    fresh = _engine(tmp_path, FakeRunner())
    assert fresh.get("t1", evaluation_id) == saved
    listed = fresh.recent("t1")
    assert [e["id"] for e in listed] == [evaluation_id]
    assert listed[0]["cases"] == 1
    with pytest.raises(EvaluationNotFound):
        fresh.get("t2", evaluation_id)
    with pytest.raises(EvaluationNotFound):
        fresh.get("t1", "../t2/results/x")


@pytest.mark.asyncio
async def test_runs_in_flight_stay_under_the_cap(tmp_path: Path) -> None:
    runner = FakeRunner(delay=0.02)
    engine = _engine(tmp_path, runner, concurrency=2)
    doc = await _finish(
        engine, "t1", engine.start("t1", EvaluationRequest(cases=_cases(5), changes=[_RULE]))
    )
    assert len(runner.requests) == 10
    assert runner.peak == 2
    assert doc["progress"]["done"] == 10


@pytest.mark.asyncio
async def test_a_timed_out_run_fails_its_case_only(tmp_path: Path) -> None:
    runner = FakeRunner(hang_on="question 1")
    engine = _engine(tmp_path, runner, run_timeout=0.05)
    seen: list[int] = []
    evaluation_id = engine.start("t1", EvaluationRequest(cases=_cases(3), changes=[_RULE]))
    doc = await engine.wait(
        "t1", evaluation_id, timeout=10, on_progress=lambda d: seen.append(d["progress"]["done"])
    )

    assert doc["status"] == "done"
    statuses = [r["status"] for r in doc["results"]]
    assert statuses == ["done", "failed", "done"]
    failed = doc["results"][1]
    assert failed["error"] == "timed out after 0.05 s"
    assert failed["candidate"]["score"] is None
    assert failed["candidate"]["reason"] == "timed out after 0.05 s"
    assert doc["summary"]["failed"] == 1
    assert doc["summary"]["candidate_avg"] == 5.0
    assert seen and seen[-1] == 6


@pytest.mark.asyncio
async def test_wait_returns_a_running_evaluation_after_its_timeout(tmp_path: Path) -> None:
    engine = _engine(tmp_path, FakeRunner(delay=0.5))
    evaluation_id = engine.start("t1", EvaluationRequest(cases=_cases(1)))
    doc = await engine.wait("t1", evaluation_id, timeout=0.01)
    assert doc["status"] == "running"
    assert (await _finish(engine, "t1", evaluation_id))["status"] == "done"


@pytest.mark.asyncio
async def test_a_judge_error_leaves_the_answer_unscored(tmp_path: Path) -> None:
    async def broken(question: str, expectation: str, answer: str) -> tuple[float | None, str]:
        raise RuntimeError("model down")

    engine = _engine(tmp_path, FakeRunner(), judge=broken)
    doc = await _finish(engine, "t1", engine.start("t1", EvaluationRequest(cases=_cases(1))))
    run = doc["results"][0]["candidate"]
    assert (run["score"], run["reason"]) == (None, "judge failed: model down")
    assert doc["status"] == "done"


@pytest.mark.parametrize(
    ("reply", "expected"),
    [
        ('{"score": 4, "reason": "close"}', (4.0, "close")),
        ('```json\n{"score": "3", "reason": "partly {right}"}\n```', (3.0, "partly {right}")),
        ('Sure! {"note": 1} then {"score": 9, "reason": "x"}', (5.0, "x")),
        ('{"score": -2, "reason": "bad"}', (0.0, "bad")),
        ("Score: 2.5 - misses the status filter", (2.5, "misses the status filter")),
        ("4/5 good enough", (4.0, "good enough")),
    ],
)
def test_parse_verdict_reads_messy_replies(reply: str, expected: tuple[float, str]) -> None:
    assert parse_verdict(reply) == expected


@pytest.mark.parametrize("reply", ["", "I cannot grade this.", '{"score": "high"}', "{broken"])
def test_parse_verdict_without_a_score(reply: str) -> None:
    score, reason = parse_verdict(reply)
    assert score is None
    assert reason.startswith("unreadable judge reply")


@pytest.mark.asyncio
async def test_build_judge_scores_through_the_model() -> None:
    prompts: list[str] = []

    class Model:
        async def ainvoke(self, messages: list[Any]) -> AIMessage:
            prompts.append(messages[1].content)
            return AIMessage(content='{"score": 5, "reason": "exact"}')

    judge = build_judge(lambda: Model())  # type: ignore[arg-type, return-value]
    assert await judge("How many?", "12", "There are 12.") == (5.0, "exact")
    assert "Expectation:\n12" in prompts[0]


def test_answer_text_reads_blocks_and_plain_text() -> None:
    blocks = [
        {"type": "intent", "value": "ask"},
        {"type": "markdown", "value": "Hello"},
        {"type": "url", "value": {"url": "https://example.com", "name": "doc"}},
    ]
    assert answer_text(json.dumps(blocks)) == "Hello\n\n[doc](https://example.com)"
    assert answer_text("plain") == "plain"
    assert answer_text(None) == ""
