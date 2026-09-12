"""Putting back what eviction dropped while the model was answering.

A conversation can be evicted mid-run, and another run can recreate the key
with a turn of its own. Appending onto either an empty history or that
partial one loses every earlier turn and the tool transcript with it.
"""

from __future__ import annotations

from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
)
from miot_harness.runtime.router import HarnessRoute, IntentRouter, RouteResult
from miot_harness.runtime.run_store import JsonRunStore
from miot_harness.runtime.supervisor import HarnessSupervisor
from miot_harness.storytelling.module import StorytellingModule
from miot_harness.tools.registry import ToolRegistry


class _Router(IntentRouter):
    def route(self, message: str) -> RouteResult:
        return RouteResult(route=HarnessRoute.DATA_AGENTIC, reason="test")


def _supervisor(tmp_path, store):
    return HarnessSupervisor(
        router=_Router(),
        tools=ToolRegistry(),
        stories=StorytellingModule(),
        run_store=JsonRunStore(tmp_path),
        conversation_store=store,
    )


def _turn(text: str) -> ConversationTurn:
    return ConversationTurn(user_message=text, assistant_answer=text)


def _snapshot(*texts: str, summary: str | None = None) -> ConversationHistory:
    return ConversationHistory(
        conversation_id="k", turns=[_turn(t) for t in texts], summary=summary
    )


def test_an_evicted_conversation_is_put_back(tmp_path) -> None:
    store = InMemoryConversationStore()
    sup = _supervisor(tmp_path, store)

    sup._restore_evicted("k", _snapshot("one", "two"))

    held = store.get("k")
    assert held is not None
    assert [t.user_message for t in held.turns] == ["one", "two"]


def test_a_summary_only_history_is_put_back_too(tmp_path) -> None:
    """A compacted history can hold a summary and no turns at all."""

    store = InMemoryConversationStore()
    sup = _supervisor(tmp_path, store)

    sup._restore_evicted("k", _snapshot(summary="the gist"))

    held = store.get("k")
    assert held is not None
    assert held.summary == "the gist"


def test_a_key_recreated_by_another_run_keeps_both(tmp_path) -> None:
    """The other run's turn is real. It goes after the ones it never saw,
    not instead of them."""

    store = InMemoryConversationStore()
    sup = _supervisor(tmp_path, store)
    store.append("k", _turn("from another run"))

    sup._restore_evicted("k", _snapshot("one", "two"))

    held = store.get("k")
    assert held is not None
    assert [t.user_message for t in held.turns] == [
        "one",
        "two",
        "from another run",
    ]


def test_the_ordinary_case_changes_nothing(tmp_path) -> None:
    """A history that still starts with the snapshot is the one this run
    read, grown by concurrent appends. Re-seeding would duplicate turns."""

    store = InMemoryConversationStore()
    sup = _supervisor(tmp_path, store)
    store.append("k", _turn("one"))
    store.append("k", _turn("two"))
    store.append("k", _turn("landed while answering"))

    sup._restore_evicted("k", _snapshot("one", "two"))

    held = store.get("k")
    assert held is not None
    assert [t.user_message for t in held.turns] == [
        "one",
        "two",
        "landed while answering",
    ]
