from __future__ import annotations

import json
from datetime import UTC, datetime
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.domain_analyst import domain_analyst_node
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.plan import NexoEvidence


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


def _ev(output: dict[str, Any] | None = None, is_stale: bool = False) -> NexoEvidence:
    return NexoEvidence(
        step_id="s",
        tool="coordinador_centro_control",
        source="src",
        refreshed_at=datetime(2026, 5, 8, 10, 0, tzinfo=UTC),
        output=output or {"n_eta_riesgo": 3},
        sample_size=1,
        is_stale=is_stale,
    )


@pytest.mark.asyncio
async def test_analyst_signals_ready_to_synthesize():
    model = FakeListChatModel(
        responses=[
            json.dumps(
                {
                    "verdict": "ready",
                    "reasoning": "evidence covers the user's question",
                }
            )
        ]
    )
    state: dict[str, Any] = {
        "user_message": "what's operational status?",
        "ctx": _ctx(),
        "evidence": [_ev()],
        "turn_count": 1,
    }

    update = await domain_analyst_node(state, model=model)
    assert update["next_action"] == "ready_to_synthesize"
    assert update.get("turn_count") == 2


@pytest.mark.asyncio
async def test_analyst_requests_more_tools():
    model = FakeListChatModel(
        responses=[
            json.dumps(
                {
                    "verdict": "need_more",
                    "reasoning": "need POD compliance to answer the followup",
                }
            )
        ]
    )
    state = {
        "user_message": "and what about POD coverage?",
        "ctx": _ctx(),
        "evidence": [_ev()],
        "turn_count": 1,
    }

    update = await domain_analyst_node(state, model=model)
    assert update["next_action"] == "need_more_tools"


@pytest.mark.asyncio
async def test_analyst_handles_malformed_response():
    model = FakeListChatModel(responses=["not json at all"])
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [_ev()],
        "turn_count": 1,
    }

    update = await domain_analyst_node(state, model=model)
    # Default to ready_to_synthesize so the synthesizer can render with what we have
    assert update["next_action"] == "ready_to_synthesize"


@pytest.mark.asyncio
async def test_analyst_no_evidence_routes_to_filter_expert():
    """No evidence to analyze → analyst must request a tool call rather
    than flagging ready."""
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "evidence": [],
        "turn_count": 0,
    }
    model = FakeListChatModel(responses=[])  # should not be called

    update = await domain_analyst_node(state, model=model)
    assert update["next_action"] == "need_more_tools"
