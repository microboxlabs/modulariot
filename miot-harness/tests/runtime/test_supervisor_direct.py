"""DIRECT / OTHER routes compose an answer harness-side (#628).

Before #628 the supervisor left ``record.answer`` null on these routes
("client renders"), but no client implemented that side of the
contract — users saw "(no answer recorded)". These tests pin the new
behavior: the run always carries a non-null answer and the standard
agent/answer event envelope.
"""

from __future__ import annotations

import json
from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.direct_agent import FALLBACK_DIRECT_ANSWER
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import IntentRouter
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


def _scripted_llm_router(route: str, confidence: float = 0.95) -> LLMIntentRouter:
    model = FakeListChatModel(
        responses=[json.dumps({"route": route, "confidence": confidence})]
    )
    return LLMIntentRouter(model, confidence_threshold=0.7, keyword_fallback=IntentRouter())


def _build_supervisor(
    tmp_path: Any,
    *,
    llm_router: LLMIntentRouter,
    meta_model: Any = None,
) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        llm_router=llm_router,
        meta_model=meta_model,
        tenant_lock="mintral",
    )


@pytest.mark.asyncio
async def test_direct_route_composes_answer(tmp_path: Any) -> None:
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=FakeListChatModel(responses=["¡Hola! ¿En qué te ayudo con la flota?"]),
    )
    record = await supervisor.run(
        UserRequest(message="hola", tenant_id="any-tenant", mode="auto")
    )
    assert record.status == "completed"
    assert record.answer == "¡Hola! ¿En qué te ayudo con la flota?"


@pytest.mark.asyncio
async def test_direct_route_emits_agent_and_answer_events(tmp_path: Any) -> None:
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=FakeListChatModel(responses=["hi there"]),
    )
    record = await supervisor.run(
        UserRequest(message="hi", tenant_id="any-tenant", mode="auto")
    )
    types = [e.type for e in record.events]
    assert "agent.started" in types
    assert "agent.completed" in types
    assert "answer.completed" in types
    started = next(e for e in record.events if e.type == "agent.started")
    assert started.data["agent"] == "direct_agent"


@pytest.mark.asyncio
async def test_other_route_composes_answer(tmp_path: Any) -> None:
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("OTHER"),
        meta_model=FakeListChatModel(
            responses=["I can't help with that, but ask me about the fleet."]
        ),
    )
    record = await supervisor.run(
        UserRequest(message="write me a poem", tenant_id="any-tenant", mode="auto")
    )
    assert record.answer is not None
    assert "fleet" in record.answer


@pytest.mark.asyncio
async def test_direct_route_without_model_uses_fallback(tmp_path: Any) -> None:
    """No meta_model wired (e.g. datasource boot failed) must still
    greet — never a null answer."""
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=None,
    )
    record = await supervisor.run(
        UserRequest(message="hola", tenant_id="any-tenant", mode="auto")
    )
    assert record.answer == FALLBACK_DIRECT_ANSWER
    assert any(e.type == "answer.completed" for e in record.events)
