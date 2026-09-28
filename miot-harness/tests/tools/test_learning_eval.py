"""`run_learning_eval`: which cases it asks, the progress it streams and the
result the app's eval card reads."""

from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from miot_harness.knowledge.changes import KnowledgeChange
from miot_harness.knowledge.evaluation import EvaluationEngine
from miot_harness.knowledge.store import KnowledgeStore
from miot_harness.runtime.context import HarnessContext, UserRequest
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionDecision
from miot_harness.runtime.run_store import HarnessRunRecord
from miot_harness.tools.learning_eval import (
    RunLearningEvalInput,
    run_learning_eval_tool,
)


def _store(tmp_path: Path) -> KnowledgeStore:
    return KnowledgeStore(
        tenant_id="t1",
        root=tmp_path,
        context_dir=tmp_path / "context",
        skills_dir=tmp_path / "skills",
    )


def _save_case(store: KnowledgeStore, case_id: str, question: str, conversation: str) -> None:
    store.put(
        "eval",
        case_id,
        title=question,
        content="Counts rows in live_trip.",
        provenance={"conversation_id": conversation},
        meta={"expect_skill": "trips"},
    )


async def _runner(
    request: UserRequest,
    *,
    run_id_override: str | None = None,
    caller_token: str | None = None,
    organization: str | None = None,
) -> HarnessRunRecord:
    answer = "live_trip" if request.to_context().knowledge_overlay else "unknown"
    return HarnessRunRecord(run_id=run_id_override or "r", status="completed", answer=answer)


async def _judge(question: str, expectation: str, answer: str) -> tuple[float | None, str]:
    return (5.0, "right") if answer == "live_trip" else (0.0, "wrong")


def _tool(tmp_path: Path, asked: list[str]) -> Any:
    async def runner(request: UserRequest, **kw: Any) -> HarnessRunRecord:
        asked.append(request.message)
        return await _runner(request, **kw)

    engine = EvaluationEngine(
        runner=runner, judge=_judge, results_dir=lambda t: tmp_path / "results" / t
    )
    return run_learning_eval_tool(lambda: engine, lambda tenant: _store(tmp_path), max_cases=5)


def _ctx(trainer: bool = True) -> HarnessContext:
    return HarnessContext(
        thread_id="th", tenant_id="t1", user_id="ana", conversation_id="conv-1", trainer=trainer
    )


@pytest.mark.asyncio
async def test_only_a_trainer_may_run_it(tmp_path: Path) -> None:
    tool = _tool(tmp_path, [])
    denied = await tool.check_permission(_ctx(trainer=False), RunLearningEvalInput())
    allowed = await tool.check_permission(_ctx(), RunLearningEvalInput())
    assert denied.decision == PermissionDecision.DENY
    assert allowed.decision == PermissionDecision.ALLOW
    assert tool.kind == "trainer"


@pytest.mark.asyncio
async def test_defaults_to_this_conversations_saved_cases(tmp_path: Path) -> None:
    store = _store(tmp_path)
    _save_case(store, "mine", "How many trips were loaded today?", "conv-1")
    _save_case(store, "older", "Old question", "conv-0")
    asked: list[str] = []
    events: list[HarnessEvent] = []
    change = KnowledgeChange(layer="rule", id="cargado", content="Loaded = live_trip rows.")

    out = await _tool(tmp_path, asked).call(
        _ctx(), RunLearningEvalInput(changes=[change]), events.append
    )

    assert asked == ["How many trips were loaded today?"] * 2
    assert out.status == "done"
    assert out.evaluation_id.startswith("ev-")
    assert out.summary is not None
    assert (out.summary["baseline_avg"], out.summary["candidate_avg"]) == (0.0, 5.0)
    assert out.summary["improved"] == 1
    assert out.cases[0]["candidate"]["score"] == 5.0
    assert out.cases[0]["candidate"]["trigger"]["missing"] == ["trips"]
    deltas = [e.data["delta"] for e in events if e.type == "thinking.delta"]
    assert deltas[-1] == "\nEvaluation: 2/2 answers"
    assert all(e.data["evaluation_id"] == out.evaluation_id for e in events)


@pytest.mark.asyncio
async def test_falls_back_to_all_saved_cases_then_takes_ids_and_inline(tmp_path: Path) -> None:
    store = _store(tmp_path)
    _save_case(store, "a", "Question A", "conv-0")
    _save_case(store, "b", "Question B", "conv-0")
    asked: list[str] = []
    tool = _tool(tmp_path, asked)

    await tool.call(_ctx(), RunLearningEvalInput(), lambda e: None)
    assert sorted(asked) == ["Question A", "Question B"]

    asked.clear()
    await tool.call(
        _ctx(),
        RunLearningEvalInput(
            case_ids=["b"],
            cases=[{"question": "Inline", "expectation": "x"}],  # type: ignore[list-item]
        ),
        lambda e: None,
    )
    assert asked == ["Inline", "Question B"]


@pytest.mark.asyncio
async def test_no_cases_is_an_error_the_model_can_read(tmp_path: Path) -> None:
    with pytest.raises(ValueError, match="no eval cases"):
        await _tool(tmp_path, []).call(_ctx(), RunLearningEvalInput(), lambda e: None)
    with pytest.raises(ValueError, match="no eval"):
        await _tool(tmp_path, []).call(
            _ctx(), RunLearningEvalInput(case_ids=["missing"]), lambda e: None
        )
