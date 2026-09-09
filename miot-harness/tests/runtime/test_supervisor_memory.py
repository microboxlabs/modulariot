"""Conversation memory past one process and past the turn cap.

Compaction after the append, the summary going out on the record and coming
back with a replay, and the router seeing the turns before the message.
"""

from __future__ import annotations

import json
from typing import Any
from unittest.mock import AsyncMock

import pytest
from langchain_core.language_models import FakeListChatModel
from langchain_core.messages import HumanMessage

from miot_harness.runtime.context import ConversationTurnInput, UserRequest
from miot_harness.runtime.conversation import ConversationTurn, InMemoryConversationStore
from miot_harness.runtime.intent_router import LLMIntentRouter
from miot_harness.runtime.router import IntentRouter
from tests.runtime.test_supervisor_phase_e import (
    _build_supervisor,
    _scripted_llm_router,
    _store_key,
)


def _graph(answer: str = "ok") -> AsyncMock:
    graph = AsyncMock()
    graph.ainvoke = AsyncMock(return_value={"answer": answer, "_events": []})
    return graph


@pytest.mark.asyncio
async def test_history_is_compacted_once_past_the_turn_cap(tmp_path: Any) -> None:
    """Past the store's cap the older turns fold into a summary, and the run
    record carries that summary so the caller can persist it."""

    store = InMemoryConversationStore(summarize_at_turns=2, keep_recent_turns=0)
    summarized: list[str] = []

    async def summarizer(history: Any) -> str:
        summarized.append(",".join(turn.user_message for turn in history.turns))
        return "so far: " + summarized[-1]

    supervisor = _build_supervisor(
        tmp_path,
        data_graph=_graph(),
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )
    supervisor.conversation_summarizer = summarizer

    records = [
        await supervisor.run(
            UserRequest(message=message, tenant_id="orion", conversation_id="conv-cap")
        )
        for message in ("q1", "q2", "q3")
    ]

    assert [r.conversation_summary for r in records] == [None, None, "so far: q1,q2,q3"]
    history = store.get(_store_key("conv-cap"))
    assert history is not None
    assert history.summary == "so far: q1,q2,q3"
    assert history.turns == []


@pytest.mark.asyncio
async def test_a_failing_summarizer_leaves_the_history_and_the_run_alone(
    tmp_path: Any,
) -> None:
    store = InMemoryConversationStore(summarize_at_turns=1)

    async def summarizer(history: Any) -> str:
        raise RuntimeError("model down")

    supervisor = _build_supervisor(
        tmp_path,
        data_graph=_graph(),
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )
    supervisor.conversation_summarizer = summarizer

    for message in ("q1", "q2"):
        record = await supervisor.run(
            UserRequest(message=message, tenant_id="orion", conversation_id="conv-fail")
        )
        assert record.status == "completed"
        assert record.conversation_summary is None

    history = store.get(_store_key("conv-fail"))
    assert history is not None
    assert [turn.user_message for turn in history.turns] == ["q1", "q2"]


@pytest.mark.asyncio
async def test_a_replayed_summary_reaches_the_graph_ahead_of_the_turns(
    tmp_path: Any,
) -> None:
    """After a restart the caller hands back the summary it stored with the
    last turns; both must be there for the next answer."""

    store = InMemoryConversationStore()
    graph = _graph()
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )

    await supervisor.run(
        UserRequest(
            message="q9",
            tenant_id="orion",
            conversation_id="conv-sum",
            conversation_summary="user is auditing last month's trips",
            conversation_history=[
                ConversationTurnInput(user_message="q8", assistant_answer="a8"),
            ],
        )
    )

    prior = graph.ainvoke.call_args[0][0]["prior_messages"]
    assert isinstance(prior[0], HumanMessage)
    assert "user is auditing last month's trips" in str(prior[0].content)
    assert [m.content for m in prior[1:]] == ["q8", "a8"]

    history = store.get(_store_key("conv-sum"))
    assert history is not None
    assert history.summary == "user is auditing last month's trips"
    assert [turn.user_message for turn in history.turns] == ["q8", "q9"]


@pytest.mark.asyncio
async def test_a_summary_alone_seeds_an_unknown_conversation(tmp_path: Any) -> None:
    """Every earlier turn can have been compacted, leaving nothing to replay
    but the summary. That still has to seed."""

    store = InMemoryConversationStore()
    graph = _graph()
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=graph,
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )

    await supervisor.run(
        UserRequest(
            message="q1",
            tenant_id="orion",
            conversation_id="conv-only-sum",
            conversation_summary="the gist",
        )
    )

    prior = graph.ainvoke.call_args[0][0]["prior_messages"]
    assert prior and "the gist" in str(prior[0].content)
    history = store.get(_store_key("conv-only-sum"))
    assert history is not None
    assert history.summary == "the gist"
    assert [turn.user_message for turn in history.turns] == ["q1"]


@pytest.mark.asyncio
async def test_a_replayed_summary_never_overwrites_a_compacted_history(
    tmp_path: Any,
) -> None:
    store = InMemoryConversationStore()
    key = _store_key("conv-keep")
    store.append(key, ConversationTurn(user_message="q1", assistant_answer="a1"))
    held = store.get(key)
    assert held is not None
    held.summary = "what this process compacted"
    supervisor = _build_supervisor(
        tmp_path,
        data_graph=_graph(),
        llm_router=_scripted_llm_router("DATA_QUERY"),
        conversation_store=store,
    )

    await supervisor.run(
        UserRequest(
            message="q2",
            tenant_id="orion",
            conversation_id="conv-keep",
            conversation_summary="a stale summary from the caller",
            conversation_history=[
                ConversationTurnInput(user_message="q1", assistant_answer="a1"),
                ConversationTurnInput(user_message="qx", assistant_answer="ax"),
            ],
        )
    )

    history = store.get(key)
    assert history is not None
    assert history.summary == "what this process compacted"


@pytest.mark.asyncio
async def test_router_is_shown_the_turns_before_the_message(tmp_path: Any) -> None:
    """A follow-up carries no route of its own; the turn before it does."""

    seen: list[list[ConversationTurn]] = []

    class RecordingRouter(LLMIntentRouter):
        async def route(self, message: str, *, prior_turns: Any = ()) -> Any:
            seen.append(list(prior_turns))
            return await super().route(message, prior_turns=prior_turns)

    router = RecordingRouter(
        FakeListChatModel(responses=[json.dumps({"route": "DATA_AGENTIC", "confidence": 0.9})]),
        keyword_fallback=IntentRouter(),
    )
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=_graph(),
        llm_router=router,
        conversation_store=InMemoryConversationStore(),
    )
    supervisor.router_context_turns = 2

    await supervisor.run(
        UserRequest(
            message="and last week?",
            tenant_id="orion",
            conversation_id="conv-router",
            conversation_history=[
                ConversationTurnInput(user_message="q1", assistant_answer="a1"),
                ConversationTurnInput(user_message="q2", assistant_answer="a2"),
                ConversationTurnInput(user_message="q3", assistant_answer="a3"),
            ],
        )
    )

    assert [turn.user_message for turn in seen[0]] == ["q2", "q3"]


@pytest.mark.asyncio
async def test_router_still_sees_the_last_turns_right_after_a_compaction(
    tmp_path: Any,
) -> None:
    seen: list[list[ConversationTurn]] = []

    class RecordingRouter(LLMIntentRouter):
        async def route(self, message: str, *, prior_turns: Any = ()) -> Any:
            seen.append(list(prior_turns))
            return await super().route(message, prior_turns=prior_turns)

    router = RecordingRouter(
        FakeListChatModel(responses=[json.dumps({"route": "DATA_AGENTIC", "confidence": 0.9})] * 4),
        keyword_fallback=IntentRouter(),
    )
    store = InMemoryConversationStore(summarize_at_turns=2, keep_recent_turns=2)
    supervisor = _build_supervisor(
        tmp_path,
        agentic_graph=_graph(),
        llm_router=router,
        conversation_store=store,
    )
    supervisor.router_context_turns = 2

    async def summarizer(history: Any) -> str:
        return "folded: " + ",".join(turn.user_message for turn in history.turns)

    supervisor.conversation_summarizer = summarizer

    for message in ("q1", "q2", "q3", "q4"):
        await supervisor.run(
            UserRequest(message=message, tenant_id="orion", conversation_id="conv-tail")
        )

    # Compaction fired after q3 (folding q1) and again after q4 (folding q2);
    # q4 itself was routed between the two, against the kept q2, q3.
    history = store.get(_store_key("conv-tail"))
    assert history is not None
    assert history.summary == "folded: q2"
    assert [turn.user_message for turn in history.turns] == ["q3", "q4"]
    assert [turn.user_message for turn in seen[3]] == ["q2", "q3"]
