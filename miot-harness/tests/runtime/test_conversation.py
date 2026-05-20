"""E5 — `ConversationStore` interface + in-memory v1 implementation."""

from __future__ import annotations

import pytest

from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
)


def test_get_returns_none_for_unknown_conversation() -> None:
    store = InMemoryConversationStore()
    assert store.get("never-seen") is None


def test_append_round_trips_a_single_turn() -> None:
    store = InMemoryConversationStore()
    turn = ConversationTurn(user_message="hi", assistant_answer="hello")
    store.append("conv-1", turn)
    history = store.get("conv-1")
    assert history is not None
    assert history.conversation_id == "conv-1"
    assert history.turns == [turn]


def test_append_preserves_order_across_turns() -> None:
    store = InMemoryConversationStore()
    for i in range(3):
        store.append(
            "conv-2",
            ConversationTurn(user_message=f"q{i}", assistant_answer=f"a{i}"),
        )
    history = store.get("conv-2")
    assert history is not None
    assert [t.user_message for t in history.turns] == ["q0", "q1", "q2"]


def test_two_conversations_are_isolated() -> None:
    store = InMemoryConversationStore()
    store.append("a", ConversationTurn(user_message="qa", assistant_answer="ra"))
    store.append("b", ConversationTurn(user_message="qb", assistant_answer="rb"))
    a = store.get("a")
    b = store.get("b")
    assert a is not None and b is not None
    assert a.turns[0].user_message == "qa"
    assert b.turns[0].user_message == "qb"


@pytest.mark.asyncio
async def test_summarize_if_needed_no_op_below_threshold() -> None:
    """Below the configured turn cap, summarize_if_needed leaves history alone."""

    store = InMemoryConversationStore(summarize_at_turns=10)
    cid = "convX"
    for i in range(5):
        store.append(cid, ConversationTurn(user_message=f"q{i}", assistant_answer=f"a{i}"))

    async def summarizer(history: ConversationHistory) -> str:
        raise AssertionError("summarizer must not fire below threshold")

    fired = await store.summarize_if_needed(cid, summarizer=summarizer)
    assert fired is False
    assert len(store.get(cid).turns) == 5  # type: ignore[union-attr]


@pytest.mark.asyncio
async def test_summarize_if_needed_fires_above_threshold() -> None:
    store = InMemoryConversationStore(summarize_at_turns=10)
    cid = "convY"
    for i in range(11):
        store.append(cid, ConversationTurn(user_message=f"q{i}", assistant_answer=f"a{i}"))

    calls: list[ConversationHistory] = []

    async def summarizer(history: ConversationHistory) -> str:
        calls.append(history)
        return "summary of the first 11 turns"

    fired = await store.summarize_if_needed(cid, summarizer=summarizer)
    assert fired is True
    assert len(calls) == 1

    # After summarization the history retains the summary + recent turns.
    summarized = store.get(cid)
    assert summarized is not None
    assert summarized.summary == "summary of the first 11 turns"


def test_conversation_id_round_trips_across_two_runs() -> None:
    """The store is the seam between two `/runs` calls — it MUST persist the id."""

    store = InMemoryConversationStore()
    store.append("conv-Z", ConversationTurn(user_message="q1", assistant_answer="a1"))
    # Second /runs call hydrates the same conversation_id...
    history = store.get("conv-Z")
    assert history is not None
    # ...appends its own turn...
    store.append("conv-Z", ConversationTurn(user_message="q2", assistant_answer="a2"))
    # ...and reads back both turns in order.
    history = store.get("conv-Z")
    assert history is not None
    assert [t.user_message for t in history.turns] == ["q1", "q2"]
