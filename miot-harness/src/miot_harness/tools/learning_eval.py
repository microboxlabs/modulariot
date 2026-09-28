"""`run_learning_eval`: a trainer checks knowledge changes before and after.

Offered only on a trainer's run. Starts an evaluation (`knowledge.evaluation`)
of eval cases given inline or by id, by default the ones saved in this
conversation, else the tenant's; streams its progress and returns the summary
the app's eval card shows.
"""

from __future__ import annotations

from collections.abc import Callable
from typing import Any

from pydantic import BaseModel, Field

from miot_harness.knowledge.changes import MAX_OVERLAY_CHANGES, KnowledgeChange
from miot_harness.knowledge.evaluation import (
    MAX_CASES,
    EvalCaseInput,
    EvaluationEngine,
    EvaluationRequest,
)
from miot_harness.knowledge.store import KnowledgeError, KnowledgeStore
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.permissions import PermissionResult
from miot_harness.runtime.tool import HarnessTool, Progress

RUN_LEARNING_EVAL_TOOL = "run_learning_eval"


class RunLearningEvalInput(BaseModel):
    cases: list[EvalCaseInput] | None = Field(
        default=None,
        max_length=MAX_CASES,
        description="Cases to ask: question and the expected answer.",
    )
    case_ids: list[str] | None = Field(
        default=None,
        max_length=MAX_CASES,
        description="Ids of saved eval cases to ask.",
    )
    changes: list[KnowledgeChange] | None = Field(
        default=None,
        max_length=MAX_OVERLAY_CHANGES,
        description=(
            "Knowledge changes to test, not saved: each case is answered without "
            "and with them. Omit to score the current knowledge once."
        ),
    )


class RunLearningEvalOutput(BaseModel):
    evaluation_id: str
    status: str
    model: str | None
    progress: dict[str, int]
    summary: dict[str, Any] | None
    cases: list[dict[str, Any]]
    message: str


def _case_of(item: dict[str, Any]) -> EvalCaseInput:
    meta = item.get("meta") or {}
    return EvalCaseInput(
        id=item["id"],
        question=item["title"],
        expectation=item.get("content") or "",
        expect_skill=meta.get("expect_skill"),
        expect_no_skill=meta.get("expect_no_skill"),
    )


def _from_conversation(item: dict[str, Any], ctx: HarnessContext) -> bool:
    source = (item.get("meta") or {}).get("source")
    if not isinstance(source, dict):
        return False
    return source.get("conversation_id") in {ctx.conversation_id, ctx.thread_id} - {None}


def resolve_cases(
    store: KnowledgeStore, value: RunLearningEvalInput, ctx: HarnessContext, cap: int
) -> list[EvalCaseInput]:
    """Inline cases and the named saved ones; with neither, the saved cases of
    this conversation, else all of the tenant's, up to `cap`."""
    cases = list(value.cases or [])
    for case_id in value.case_ids or []:
        cases.append(_case_of(store.read("eval", case_id)))
    if cases:
        return cases[:MAX_CASES]
    saved = [c for c in store.eval_cases() if c.get("title")]
    mine = [c for c in saved if _from_conversation(c, ctx)]
    return [_case_of(c) for c in (mine or saved)[:cap]]


def _case_line(result: dict[str, Any]) -> dict[str, Any]:
    line: dict[str, Any] = {"question": result["case"].get("question")}
    for side in ("baseline", "candidate"):
        run = result.get(side)
        if run:
            line[side] = {
                k: run[k]
                for k in ("score", "reason", "skills_used", "trigger", "error")
                if run.get(k) not in (None, "", [])
            }
    if result.get("error"):
        line["error"] = result["error"]
    return line


def _message(doc: dict[str, Any]) -> str:
    if doc["status"] == "running":
        return (
            "The evaluation is still running; the card shows it when it ends. "
            "Do not start it again."
        )
    if doc["status"] == "failed":
        return f"The evaluation failed: {doc.get('error') or 'unknown error'}"
    return "The evaluation ended. Sum up what improved or regressed, and why."


def run_learning_eval_tool(
    engine: Callable[[], EvaluationEngine],
    store_for: Callable[[str], KnowledgeStore],
    *,
    max_cases: int = 20,
    wait_seconds: float = 600.0,
) -> HarnessTool[RunLearningEvalInput, RunLearningEvalOutput]:
    async def check(  # NOSONAR
        ctx: HarnessContext, value: RunLearningEvalInput
    ) -> PermissionResult:
        if not ctx.trainer:
            return PermissionResult.deny("only a trainer can run learning evaluations")
        return PermissionResult.allow("trainer evaluation")

    async def call(
        ctx: HarnessContext, value: RunLearningEvalInput, progress: Progress
    ) -> RunLearningEvalOutput:
        try:
            cases = resolve_cases(store_for(ctx.tenant_id), value, ctx, max_cases)
        except KnowledgeError as exc:
            raise ValueError(exc.detail) from exc
        if not cases:
            raise ValueError("no eval cases: pass `cases` or save some with the eval layer first")
        runner = engine()
        evaluation_id = runner.start(
            ctx.tenant_id,
            EvaluationRequest(model=ctx.model, cases=cases, changes=value.changes or []),
            started_by=ctx.user_id,
            caller_token=ctx.caller_token,
            organization=ctx.organization,
        )
        seen = {"done": -1, "index": 0}

        def on_progress(doc: dict[str, Any]) -> None:
            done, total = doc["progress"]["done"], doc["progress"]["total"]
            if done == seen["done"]:
                return
            seen["done"] = done
            progress(
                HarnessEvent(
                    run_id=ctx.run_id,
                    type="thinking.delta",
                    message="",
                    data={
                        "agent": RUN_LEARNING_EVAL_TOOL,
                        "delta": f"\nEvaluation: {done}/{total} answers",
                        "index": seen["index"],
                        "evaluation_id": evaluation_id,
                        "done": done,
                        "total": total,
                    },
                )
            )
            seen["index"] += 1

        doc = await runner.wait(ctx.tenant_id, evaluation_id, wait_seconds, on_progress)
        return RunLearningEvalOutput(
            evaluation_id=evaluation_id,
            status=doc["status"],
            model=doc.get("model"),
            progress=doc["progress"],
            summary=doc.get("summary"),
            cases=[_case_line(r) for r in doc["results"]],
            message=_message(doc),
        )

    return HarnessTool(
        name=RUN_LEARNING_EVAL_TOOL,
        description=(
            "Test knowledge changes: ask eval cases on the current model without and "
            "with `changes` (each in a fresh run), score each answer 0-5 against its "
            "expectation, and return the before/after summary. With no cases or ids, "
            "uses the eval cases saved in this conversation, else the saved ones."
        ),
        input_model=RunLearningEvalInput,
        output_model=RunLearningEvalOutput,
        read_only=False,
        kind="trainer",
        check_permission=check,
        call=call,
    )
