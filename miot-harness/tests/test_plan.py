from __future__ import annotations

from datetime import UTC, datetime
from typing import get_type_hints

import pytest
from pydantic import ValidationError

from miot_harness.runtime.plan import (
    NexoEvidence,
    NexoPlan,
    NexoState,
    NexoStep,
)


def test_nexo_step_auto_id():
    step = NexoStep(
        intent="fetch today's KPIs",
        tool="coordinador_centro_control",
        args={},
        rationale="broad question",
    )
    assert step.id.startswith("step_")
    assert len(step.id) == len("step_") + 8


def test_nexo_plan_steps_max_length_four():
    steps = [NexoStep(intent=f"i{i}", tool="t", args={}, rationale="r") for i in range(4)]
    plan = NexoPlan(steps=steps)
    assert len(plan.steps) == 4
    assert plan.final_format == "answer"

    with pytest.raises(ValidationError):
        NexoPlan(
            steps=[NexoStep(intent=f"i{i}", tool="t", args={}, rationale="r") for i in range(5)]
        )


def test_nexo_plan_final_format_literal():
    plan = NexoPlan(steps=[], final_format="story")
    assert plan.final_format == "story"
    with pytest.raises(ValidationError):
        NexoPlan(steps=[], final_format="bogus")


def test_nexo_evidence_fields():
    ev = NexoEvidence(
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


def test_nexo_evidence_refreshed_at_optional():
    ev = NexoEvidence(
        step_id="step_abc",
        tool="t",
        source="Coordinador · nexo (Citus DB)",
        refreshed_at=None,
        output={},
        sample_size=0,
        is_stale=False,
    )
    assert ev.refreshed_at is None


def test_nexo_state_evidence_uses_add_reducer():
    """C3: LangGraph requires Annotated[..., operator.add] for accumulating lists."""
    import operator

    hints = get_type_hints(NexoState, include_extras=True)
    evidence_hint = hints["evidence"]
    # Annotated[list[NexoEvidence], operator.add]
    assert getattr(evidence_hint, "__metadata__", None) is not None, (
        "evidence field must be Annotated to provide a LangGraph reducer"
    )
    metadata = evidence_hint.__metadata__
    assert operator.add in metadata, "evidence reducer must be operator.add (or list_append alias)"


def test_nexo_state_required_fields_present():
    hints = get_type_hints(NexoState)
    for field in (
        "user_message",
        "ctx",
        "plan",
        "evidence",
        "pending_step_index",
        "answer",
        "failure",
    ):
        assert field in hints, f"NexoState missing field: {field}"
