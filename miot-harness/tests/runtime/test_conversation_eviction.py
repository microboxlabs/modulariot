"""The store holds a bounded number of conversations.

A turn now carries its tool envelopes, so a conversation costs orders of
magnitude more than the two strings it used to be, and the store gains one
entry per chat that ever runs through a long-lived pod.
"""

from __future__ import annotations

from miot_harness.runtime.conversation import (
    ConversationTurn,
    InMemoryConversationStore,
)


def _turn(text: str) -> ConversationTurn:
    return ConversationTurn(user_message=text, assistant_answer=text)


def test_the_least_recently_used_conversation_is_evicted() -> None:
    store = InMemoryConversationStore(max_conversations=2)
    store.append("a", _turn("1"))
    store.append("b", _turn("1"))
    store.append("c", _turn("1"))

    assert store.get("a") is None
    assert store.get("b") is not None
    assert store.get("c") is not None


def test_reading_a_conversation_keeps_it() -> None:
    store = InMemoryConversationStore(max_conversations=2)
    store.append("a", _turn("1"))
    store.append("b", _turn("1"))
    store.get("a")
    store.append("c", _turn("1"))

    assert store.get("a") is not None
    assert store.get("b") is None


def test_appending_to_a_conversation_keeps_it() -> None:
    store = InMemoryConversationStore(max_conversations=2)
    store.append("a", _turn("1"))
    store.append("b", _turn("1"))
    store.append("a", _turn("2"))
    store.append("c", _turn("1"))

    held = store.get("a")
    assert held is not None
    assert len(held.turns) == 2
    assert store.get("b") is None
