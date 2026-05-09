from __future__ import annotations

from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.synthesizer import synthesizer_node
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.plan import NexoEvidence


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _ev(refreshed=None, is_stale=False) -> NexoEvidence:
    return NexoEvidence(
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

    update = await synthesizer_node(state, model=model, progress=events.append)

    assert update["answer"] == fake
    assert "answer.completed" in {e.type for e in events}


@pytest.mark.asyncio
async def test_synthesizes_refusal_when_failure_set():
    """When state['failure'] is set, the synthesizer must produce a
    graceful refusal — without making any LLM call (cheap path)."""
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 1,
        "failure": "Coordinador snapshot is stale (age 4320min).",
    }
    events: list[HarnessEvent] = []
    model = FakeListChatModel(responses=[])  # would fail if invoked

    update = await synthesizer_node(state, model=model, progress=events.append)

    assert update["answer"]
    assert "stale" in update["answer"].lower() or "snapshot" in update["answer"].lower()
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

    update = await synthesizer_node(state, model=model, progress=events.append)
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
    update = await synthesizer_node(state, model=model, progress=lambda e: None)
    assert update["answer"] == fake
