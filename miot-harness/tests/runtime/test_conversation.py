"""E5 — `ConversationStore` interface + in-memory v1 implementation."""

from __future__ import annotations

import pytest
from langchain_core.messages import AIMessage, HumanMessage
from langchain_core.messages.utils import count_tokens_approximately

from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
    to_messages,
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


# --- to_messages hydration helper ---


def test_to_messages_empty_history_returns_empty_list() -> None:
    history = ConversationHistory(conversation_id="empty")
    assert to_messages(history) == []


def test_to_messages_alternates_human_then_ai() -> None:
    """Each turn becomes a HumanMessage followed by an AIMessage, in order."""

    history = ConversationHistory(
        conversation_id="conv",
        turns=[
            ConversationTurn(user_message="q1", assistant_answer="a1"),
            ConversationTurn(user_message="q2", assistant_answer="a2"),
        ],
    )
    msgs = to_messages(history)
    assert [type(m) for m in msgs] == [HumanMessage, AIMessage, HumanMessage, AIMessage]
    assert [m.content for m in msgs] == ["q1", "a1", "q2", "a2"]


def test_to_messages_zero_budget_returns_empty() -> None:
    """A 0 budget means 'no history'; the helper returns an empty list."""

    history = ConversationHistory(
        conversation_id="any",
        turns=[ConversationTurn(user_message="q", assistant_answer="a")],
    )
    assert to_messages(history, max_tokens=0) == []


def test_to_messages_caps_at_token_budget_keeping_most_recent_turns() -> None:
    """Long turns are dropped from the OLDEST end until the result fits the
    token budget. The remaining list's approximate token count is ≤ budget,
    and the most recent turns are preserved."""

    # Five turns of long answers — `count_tokens_approximately` uses ~4
    # chars per token, so 4_000 chars ≈ 1000 tokens each. With turn
    # overhead the per-turn cost is ~1.0–1.3K tokens. Budget of 3_000
    # should keep the most recent 2 turns (≈2–3K tokens) and drop the
    # oldest 3.
    long_answer = "A" * 4_000
    history = ConversationHistory(
        conversation_id="long",
        turns=[
            ConversationTurn(user_message=f"q{i}", assistant_answer=long_answer)
            for i in range(5)
        ],
    )
    msgs = to_messages(history, max_tokens=3_000)

    # The trimmed messages must actually fit the budget.
    assert count_tokens_approximately(msgs) <= 3_000
    # And they must be the MOST RECENT — `strategy="last"` — so any
    # surviving HumanMessage's content is one of the later `qN` markers.
    human_qs = [m.content for m in msgs if isinstance(m, HumanMessage)]
    assert human_qs, "trim_messages dropped everything; budget too small for fixture"
    # The last surviving turn must be the highest-numbered one.
    assert human_qs[-1] == "q4"


def test_to_messages_returns_all_when_budget_exceeds_history_cost() -> None:
    """When the budget is far larger than the conversation, no trimming
    happens — the helper returns every turn unchanged."""

    history = ConversationHistory(
        conversation_id="short",
        turns=[
            ConversationTurn(user_message=f"q{i}", assistant_answer=f"a{i}")
            for i in range(3)
        ],
    )
    msgs = to_messages(history, max_tokens=100_000)
    assert len(msgs) == 6  # 3 turns × 2 messages
    assert [m.content for m in msgs] == ["q0", "a0", "q1", "a1", "q2", "a2"]
