from __future__ import annotations

from datetime import UTC, datetime
from typing import get_type_hints

import pytest
from pydantic import ValidationError

from miot_harness.runtime.plan import (
    DataEvidence,
    DataPlan,
    DataState,
    DataStep,
)


def test_data_step_auto_id():
    step = DataStep(
        intent="fetch today's KPIs",
        tool="coordinador_centro_control",
        args={},
        rationale="broad question",
    )
    assert step.id.startswith("step_")
    assert len(step.id) == len("step_") + 8


def test_data_plan_steps_max_length_four():
    steps = [DataStep(intent=f"i{i}", tool="t", args={}, rationale="r") for i in range(4)]
    plan = DataPlan(steps=steps)
    assert len(plan.steps) == 4
    assert plan.final_format == "answer"

    with pytest.raises(ValidationError):
        DataPlan(
            steps=[DataStep(intent=f"i{i}", tool="t", args={}, rationale="r") for i in range(5)]
        )


def test_data_plan_final_format_literal():
    plan = DataPlan(steps=[], final_format="story")
    assert plan.final_format == "story"
    with pytest.raises(ValidationError):
        DataPlan(steps=[], final_format="bogus")


def test_data_evidence_fields():
    ev = DataEvidence(
        step_id="step_abc",
        tool="coordinador_centro_control",
        source="Coordinador · nexo (Citus DB)",
        refreshed_at=datetime.now(UTC),
        output={"k": 1},
        sample_size=1,
        is_stale=False,
    )
    assert ev.step_id == "step_abc"
    assert ev.is_stale is False


def test_data_evidence_refreshed_at_optional():
    ev = DataEvidence(
        step_id="step_abc",
        tool="t",
        source="Coordinador · nexo (Citus DB)",
        refreshed_at=None,
        output={},
        sample_size=0,
        is_stale=False,
    )
    assert ev.refreshed_at is None


def test_data_state_evidence_uses_add_reducer():
    """C3: LangGraph requires Annotated[..., operator.add] for accumulating lists."""
    import operator

    hints = get_type_hints(DataState, include_extras=True)
    evidence_hint = hints["evidence"]
    # Annotated[list[DataEvidence], operator.add]
    assert getattr(evidence_hint, "__metadata__", None) is not None, (
        "evidence field must be Annotated to provide a LangGraph reducer"
    )
    metadata = evidence_hint.__metadata__
    assert operator.add in metadata, "evidence reducer must be operator.add (or list_append alias)"


def test_data_state_required_fields_present():
    hints = get_type_hints(DataState)
    for field in (
        "user_message",
        "ctx",
        "plan",
        "evidence",
        "pending_step_index",
        "answer",
        "failure",
    ):
        assert field in hints, f"DataState missing field: {field}"
