from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.synthesizer import synthesizer_node
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import DataEvidence


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _ev(refreshed=None, is_stale=False) -> DataEvidence:
    return DataEvidence(
        step_id="s",
        tool="coordinador_centro_control",
        source="src",
        refreshed_at=refreshed or datetime(2026, 5, 8, 10, 0, tzinfo=UTC),
        output={"n_eta_riesgo": 3, "n_pod_pendiente": 1},
        sample_size=1,
        is_stale=is_stale,
    )


@pytest.mark.asyncio
async def test_synthesizes_answer_from_evidence():
    fake = "El estado operativo a las 10:00 UTC: 3 ETA en riesgo, 1 POD pendiente."
    model = FakeListChatModel(responses=[fake])
    state: dict[str, Any] = {
        "user_message": "estado operativo?",
        "ctx": _ctx(),
        "evidence": [_ev()],
        "turn_count": 2,
    }
    events: list[HarnessEvent] = []

    update = await synthesizer_node(
        state, model=model, progress=events.append, profile=NEXO_PROFILE
    )

    assert update["answer"] == fake
    assert "answer.completed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_synthesizes_refusal_when_failure_set():
    """When state['failure'] is set with a snapshot-stale reason, the
    synthesizer renders the freshness retry advice — without making any
    LLM call (cheap path)."""
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 1,
        "failure": "Coordinador snapshot is stale (age 4320min).",
    }
    events: list[HarnessEvent] = []
    model = FakeListChatModel(responses=[])  # would fail if invoked

    update = await synthesizer_node(
        state, model=model, progress=events.append, profile=NEXO_PROFILE
    )

    assert update["answer"]
    assert "stale" in update["answer"].lower() or "snapshot" in update["answer"].lower()
    assert "answer.completed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_planning_failure_does_not_leak_snapshot_retry_advice():
    """When filter_expert returns malformed JSON (or any non-freshness
    failure), the answer must NOT tell the user to wait for a fresh
    snapshot — that's the wrong remedy. T03 fix.

    The replacement copy nudges the user to reformulate; internal
    pipeline detail ('filter_expert', 'malformed step') is hidden.
    """
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 1,
        "failure": "filter_expert returned malformed step",
    }
    events: list[HarnessEvent] = []
    model = FakeListChatModel(responses=[])

    update = await synthesizer_node(
        state, model=model, progress=events.append, profile=NEXO_PROFILE
    )

    answer = update["answer"]
    assert answer
    # NEGATIVE assertions — the misleading freshness copy must be gone.
    assert "snapshot" not in answer.lower()
    assert "fresco" not in answer.lower()
    assert "filter_expert" not in answer  # internal detail hidden
    # POSITIVE assertions — the neutral planning copy is shown.
    assert "planificar" in answer.lower()
    assert "reformúlala" in answer.lower() or "reformula" in answer.lower()
    assert "answer.completed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_synthesizes_tenant_refusal_for_non_mintral():
    """A non-Mintral tenant context with no evidence is rendered as a
    fixed Mintral-only refusal (also no LLM call)."""
    state = {
        "user_message": "for client X?",
        "ctx": HarnessContext(thread_id="t", tenant_id="demo-tenant", user_id="u"),
        "evidence": [],
        "turn_count": 0,
    }
    events: list[HarnessEvent] = []
    model = FakeListChatModel(responses=[])

    update = await synthesizer_node(
        state, model=model, progress=events.append, profile=NEXO_PROFILE
    )
    assert update["answer"]
    assert "Mintral" in update["answer"] or "mintral" in update["answer"].lower()


@pytest.mark.asyncio
async def test_includes_stale_warning_when_evidence_is_stale():
    fake = "Datos al 10:00 UTC (snapshot antiguo). 3 ETA en riesgo."
    model = FakeListChatModel(responses=[fake])
    state = {
        "user_message": "estado?",
        "ctx": _ctx(),
        "evidence": [_ev(is_stale=True)],
        "turn_count": 1,
    }
    update = await synthesizer_node(
        state, model=model, progress=lambda e: None, profile=NEXO_PROFILE
    )
    assert update["answer"] == fake
