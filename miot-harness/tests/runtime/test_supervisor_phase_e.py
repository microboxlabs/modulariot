"""Phase E supervisor wire-up — `HarnessSupervisor` consumes the new modules.

Verifies the runtime contract documented in `.ralph/blockers.md` (the
supervisor-wire-up OPEN entry). Covers:
- LLM router replaces the keyword router for "auto" mode.
- Explicit modes (canned / meta / agentic) bypass the LLM router.
- agentic-mode refusal for non-Mintral tenants surfaces as a record answer.
- meta route calls `meta_agent_node` directly (no graph).
- agentic route calls the agentic graph.
- conversation_id round-trips via `ConversationStore`.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.meta_agent import MetaAgentCatalogEntry
from miot_harness.runtime.context import UserRequest
from miot_harness.runtime.conversation import (
    ConversationTurn,
    InMemoryConversationStore,
)
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


def _meta_catalog() -> list[MetaAgentCatalogEntry]:
    return [
        MetaAgentCatalogEntry(
            name="fn_dx_centro_control",
            layer="L1",
            title="KPI summary",
            body="Counters for ETA-at-risk, critical queue.",
        ),
    ]


def _build_supervisor(
    tmp_path: Any,
    *,
    nexo_graph: Any = None,
    llm_router: LLMIntentRouter | None = None,
    agentic_graph: Any = None,
    meta_model: Any = None,
    conversation_store: InMemoryConversationStore | None = None,
) -> HarnessSupervisor:
    return HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        nexo_graph=nexo_graph,
        llm_router=llm_router,
        agentic_graph=agentic_graph,
        meta_model=meta_model,
        meta_primer="primer text",
        meta_catalog=_meta_catalog(),
        conversation_store=conversation_store,
        tenant_lock="mintral",
    )


@pytest.mark.asyncio
async def test_explicit_canned_mode_dispatches_to_nexo_graph(tmp_path: Any) -> None:
    nexo_graph = AsyncMock()
    nexo_graph.ainvoke = AsyncMock(return_value={"answer": "canned answer", "_events": []})
    supervisor = _build_supervisor(
        tmp_path,
        nexo_graph=nexo_graph,
        llm_router=_scripted_llm_router("DIRECT"),  # should NOT be consulted
    )

    record = await supervisor.run(
        UserRequest(message="anything", tenant_id="mintral", mode="canned")
    )
    nexo_graph.ainvoke.assert_awaited_once()
    assert record.answer == "canned answer"


@pytest.mark.asyncio
async def test_explicit_meta_mode_calls_meta_agent(tmp_path: Any) -> None:
    meta_model = FakeListChatModel(responses=["This is what we have: fn_dx_centro_control."])
    supervisor = _build_supervisor(
        tmp_path,
        llm_router=_scripted_llm_router("DIRECT"),
        meta_model=meta_model,
    )
    record = await supervisor.run(
        UserRequest(message="what data?", tenant_id="any-tenant", mode="meta")
    )
    assert "fn_dx_centro_control" in (record.answer or "")


@pytest.mark.asyncio
async def test_explicit_agentic_mode_dispatches_to_agentic_graph(tmp_path: Any) -> None:
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(
        return_value={"answer": "agentic exploration result", "_events": []}
    )
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DIRECT"),
    )
    record = await supervisor.run(
        UserRequest(message="explore", tenant_id="mintral", mode="agentic")
    )
    agentic_graph.ainvoke.assert_awaited_once()
    assert record.answer == "agentic exploration result"


@pytest.mark.asyncio
async def test_explicit_agentic_mode_for_non_mintral_returns_refusal(tmp_path: Any) -> None:
    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(return_value={"answer": "should not run"})
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        llm_router=_scripted_llm_router("DIRECT"),
    )
    record = await supervisor.run(
        UserRequest(message="explore", tenant_id="other-tenant", mode="agentic")
    )
    agentic_graph.ainvoke.assert_not_awaited()
    assert "mintral" in (record.answer or "").lower()


@pytest.mark.asyncio
async def test_auto_mode_uses_llm_router_to_pick_route(tmp_path: Any) -> None:
    """The whole point of `llm_router`: replace the keyword router for "auto"."""

    agentic_graph = AsyncMock()
    agentic_graph.ainvoke = AsyncMock(
        return_value={"answer": "routed agentic", "_events": []}
    )
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=agentic_graph,
        # LLM router classifies any message as NEXO_AGENTIC.
        llm_router=_scripted_llm_router("NEXO_AGENTIC"),
    )
    record = await supervisor.run(
        UserRequest(message="show me stuff", tenant_id="mintral")  # mode default "auto"
    )
    agentic_graph.ainvoke.assert_awaited_once()
    assert record.answer == "routed agentic"


@pytest.mark.asyncio
async def test_conversation_id_round_trips_via_store(tmp_path: Any) -> None:
    """When a request carries `conversation_id`, the supervisor must:
    1. Set `record.conversation_id` for downstream telemetry.
    2. Append the turn to the conversation store so the next call sees it.
    """

    store = InMemoryConversationStore()
    nexo_graph = AsyncMock()
    nexo_graph.ainvoke = AsyncMock(return_value={"answer": "first answer", "_events": []})
    supervisor = _build_supervisor(
        tmp_path,
        nexo_graph=nexo_graph,
        llm_router=_scripted_llm_router("NEXO_QUERY"),
        conversation_store=store,
    )
    record = await supervisor.run(
        UserRequest(
            message="q1",
            tenant_id="mintral",
            conversation_id="conv-supervisor-1",
        )
    )
    assert record.conversation_id == "conv-supervisor-1"

    history = store.get("conv-supervisor-1")
    assert history is not None
    assert history.turns[-1] == ConversationTurn(user_message="q1", assistant_answer="first answer")


@pytest.mark.asyncio
async def test_backward_compatibility_when_llm_router_not_provided(tmp_path: Any) -> None:
    """Existing call sites that pass only the keyword router must still work."""

    nexo_graph = AsyncMock()
    nexo_graph.ainvoke = AsyncMock(return_value={"answer": "via keyword", "_events": []})
    # No llm_router, no agentic_graph, no meta_model — the original Plan 12 surface.
    supervisor = HarnessSupervisor(
        router=IntentRouter(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        nexo_graph=nexo_graph,
    )
    # "Mintral" keyword triggers NEXO_QUERY in the keyword router.
    record = await supervisor.run(
        UserRequest(message="Mintral fleet status", tenant_id="mintral")
    )
    nexo_graph.ainvoke.assert_awaited_once()
    assert record.answer == "via keyword"
