"""Compaction and the tool replay have to survive each other.

Once a conversation passes the turn cap its older turns fold into a summary
and their tool transcripts go with them. What is left still has to be a legal
message list: a summary ahead of turns whose tool results all keep the call
that produced them.
"""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.runtime.conversation import (
    ConversationTurn,
    InMemoryConversationStore,
    to_messages,
)


def _turn(index: int) -> ConversationTurn:
    return ConversationTurn(
        user_message=f"q{index}",
        assistant_answer=f"a{index}",
        messages=(
            HumanMessage(content=f"q{index}"),
            AIMessage(
                content="",
                tool_calls=[{"name": "acs_query", "args": {}, "id": f"c{index}"}],
            ),
            ToolMessage(content='{"total": 1}', tool_call_id=f"c{index}"),
            AIMessage(content=f"a{index}"),
        ),
    )


@pytest.mark.asyncio
async def test_a_compacted_conversation_still_replays_legally() -> None:
    store = InMemoryConversationStore(summarize_at_turns=4, keep_recent_turns=2)
    for index in range(6):
        store.append("conv", _turn(index))

    async def summarizer(history):
        return "we counted some rows"

    assert await store.summarize_if_needed("conv", summarizer=summarizer) is True
    history = store.get("conv")
    assert history is not None
    assert history.summary == "we counted some rows"
    assert len(history.turns) == 2

    msgs = to_messages(history, include_tool_calls=True)
    assert isinstance(msgs[0], HumanMessage)
    assert "we counted some rows" in str(msgs[0].content)
    call_ids = {
        call["id"] for m in msgs if isinstance(m, AIMessage) for call in m.tool_calls
    }
    result_ids = {m.tool_call_id for m in msgs if isinstance(m, ToolMessage)}
    assert result_ids == call_ids
    # Only the kept turns replay; the folded ones live in the summary.
    assert result_ids == {"c4", "c5"}


@pytest.mark.asyncio
async def test_eviction_during_compaction_does_not_resurrect_the_history() -> None:
    """The summarizer awaits, so another conversation can evict this one
    meanwhile. The fold must then do nothing rather than write turns back."""

    store = InMemoryConversationStore(
        summarize_at_turns=2, keep_recent_turns=1, max_conversations=1
    )
    for index in range(4):
        store.append("conv", _turn(index))

    async def summarizer(history):
        store.append("other", _turn(99))  # evicts "conv"
        return "folded"

    assert await store.summarize_if_needed("conv", summarizer=summarizer) is False
    assert store.get("conv") is None
    assert store.get("other") is not None
