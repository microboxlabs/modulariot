"""Compaction also fires when the replay grows past its token limit."""

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.agents.conversation_summarizer import render_history
from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
    history_tokens,
)


def _tool_turn(question: str, rows: int) -> ConversationTurn:
    return ConversationTurn(
        user_message=question,
        assistant_answer="41 trips",
        messages=(
            HumanMessage(content=question),
            AIMessage(
                content="",
                tool_calls=[
                    {"name": "acs_query", "args": {"sql": "select count(*) from trips"}, "id": "t1"}
                ],
            ),
            ToolMessage(content="x" * rows, tool_call_id="t1"),
            AIMessage(content="41 trips"),
        ),
    )


async def _summarize(_history: ConversationHistory) -> str:
    return "the user counts trips"


@pytest.mark.asyncio
async def test_a_large_replay_compacts_before_the_turn_cap() -> None:
    store = InMemoryConversationStore(
        summarize_at_turns=10, keep_recent_turns=1, compact_at_tokens=2_000
    )
    for n in range(3):
        store.append("c", _tool_turn(f"q{n}", rows=4_000))
    history = store.get("c")
    assert history is not None
    assert history_tokens(history) > 2_000

    assert await store.summarize_if_needed("c", summarizer=_summarize)
    assert history.summary == "the user counts trips"
    assert [t.user_message for t in history.turns] == ["q2"]


@pytest.mark.asyncio
async def test_a_small_replay_waits_for_the_turn_cap() -> None:
    store = InMemoryConversationStore(summarize_at_turns=10, compact_at_tokens=50_000)
    for n in range(3):
        store.append("c", _tool_turn(f"q{n}", rows=100))
    assert not await store.summarize_if_needed("c", summarizer=_summarize)


def test_the_summarizer_sees_the_queries_and_result_heads() -> None:
    history = ConversationHistory(conversation_id="c", turns=[_tool_turn("trips?", rows=1_000)])
    rendered = render_history(history)
    assert 'Tool call: acs_query({"sql": "select count(*) from trips"})' in rendered
    assert "Tool result: " + "x" * 300 + " […]" in rendered
    assert rendered.endswith("Assistant: 41 trips")
