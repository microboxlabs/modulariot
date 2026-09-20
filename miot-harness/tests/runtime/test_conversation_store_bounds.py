"""What the store keeps, and what it refuses to keep growing.

A turn now carries its tool envelopes, so one chat that ran a dozen queries
a turn is worth hundreds of the greetings beside it. Counting conversations
alone does not bound that.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
    to_messages,
)


def _heavy_turn(index: int, payload: int = 20_000) -> ConversationTurn:
    return ConversationTurn(
        user_message=f"q{index}",
        assistant_answer=f"a{index}",
        messages=(
            HumanMessage(content=f"q{index}"),
            AIMessage(
                content="",
                tool_calls=[{"name": "acs_query", "args": {}, "id": f"c{index}"}],
            ),
            ToolMessage(content="x" * payload, tool_call_id=f"c{index}"),
            AIMessage(content=f"a{index}"),
        ),
    )


def test_the_character_cap_evicts_before_the_conversation_cap_would() -> None:
    store = InMemoryConversationStore(max_conversations=100, max_chars=50_000)
    for i in range(5):
        store.append(f"conv{i}", _heavy_turn(i))

    held = [f"conv{i}" for i in range(5) if store.get(f"conv{i}") is not None]
    assert len(held) < 5
    assert "conv4" in held  # the newest survives


def test_a_single_oversized_conversation_is_still_kept() -> None:
    """Evicting the only conversation would leave the chat that is happening
    right now with no memory at all."""

    store = InMemoryConversationStore(max_conversations=100, max_chars=1_000)
    store.append("conv", _heavy_turn(0))
    assert store.get("conv") is not None


def test_compaction_releases_the_space_it_folded() -> None:
    import asyncio

    store = InMemoryConversationStore(
        summarize_at_turns=2, keep_recent_turns=1, max_chars=10_000_000
    )
    for i in range(6):
        store.append("conv", _heavy_turn(i))

    async def run() -> bool:
        async def summarizer(history):
            return "folded"

        return await store.summarize_if_needed("conv", summarizer=summarizer)

    assert asyncio.run(run()) is True
    # Room for four more heavy conversations only if the folded turns are gone.
    store_after = store.get("conv")
    assert store_after is not None
    assert len(store_after.turns) == 1


def test_a_turn_whose_transcript_lost_its_reply_still_replays_the_answer() -> None:
    """The loop drops an assistant message carrying neither text nor a
    surviving call, which is what an empty reply at the turn cap leaves.
    Replaying the question and its tool results alone would lose the answer
    the user was actually shown."""

    turn = ConversationTurn(
        user_message="how many?",
        assistant_answer="I could not finish that.",
        messages=(
            HumanMessage(content="how many?"),
            AIMessage(
                content="",
                tool_calls=[{"name": "acs_query", "args": {}, "id": "c1"}],
            ),
            ToolMessage(content='{"total": 3}', tool_call_id="c1"),
        ),
    )
    history = ConversationHistory(conversation_id="convA", turns=[turn])
    msgs = to_messages(history, include_tool_calls=True)

    assert isinstance(msgs[-1], AIMessage)
    assert msgs[-1].content == "I could not finish that."
