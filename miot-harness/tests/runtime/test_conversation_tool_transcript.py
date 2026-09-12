"""C6 — a stored turn carries the tool calls and results it ran.

Text pairs were all the store kept, so a later turn could not see what an
earlier one had run and denied having run it.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    to_messages,
)


def _tool_turn(question: str, answer: str, call_id: str) -> ConversationTurn:
    return ConversationTurn(
        user_message=question,
        assistant_answer=answer,
        messages=(
            HumanMessage(content=question),
            AIMessage(
                content="",
                tool_calls=[{"name": "acs_query", "args": {}, "id": call_id}],
            ),
            ToolMessage(content='{"total": 291}', tool_call_id=call_id),
            AIMessage(content=answer),
        ),
    )


def test_to_messages_replays_tool_calls_when_asked() -> None:
    history = ConversationHistory(
        conversation_id="convT", turns=[_tool_turn("how many?", "291", "c1")]
    )
    msgs = to_messages(history, include_tool_calls=True)
    assert [type(m).__name__ for m in msgs] == [
        "HumanMessage",
        "AIMessage",
        "ToolMessage",
        "AIMessage",
    ]
    assert msgs[1].tool_calls[0]["name"] == "acs_query"


def test_to_messages_keeps_text_pairs_by_default() -> None:
    """The tool-less seats must not receive a tool_use block: their model
    has no such tool bound, and the API rejects the request."""

    history = ConversationHistory(
        conversation_id="convT", turns=[_tool_turn("how many?", "291", "c1")]
    )
    msgs = to_messages(history)
    assert [type(m).__name__ for m in msgs] == ["HumanMessage", "AIMessage"]
    assert msgs[1].content == "291"


def test_a_turn_without_stored_messages_falls_back_to_its_text() -> None:
    """A transcript the caller replayed carries text only."""

    history = ConversationHistory(
        conversation_id="convT",
        turns=[ConversationTurn(user_message="q", assistant_answer="a")],
    )
    assert [m.content for m in to_messages(history, include_tool_calls=True)] == [
        "q",
        "a",
    ]


def test_trimming_never_orphans_a_tool_result() -> None:
    """A tool_result whose tool_use was trimmed away is a 400. The trim
    starts on a human message, so the pair is cut together or not at all."""

    history = ConversationHistory(
        conversation_id="convT",
        turns=[
            _tool_turn("q" * 4_000, "a" * 4_000, "c1"),
            _tool_turn("second", "answer", "c2"),
        ],
    )
    msgs = to_messages(history, max_tokens=200, include_tool_calls=True)
    assert isinstance(msgs[0], HumanMessage)
    call_ids = {
        call["id"] for m in msgs if isinstance(m, AIMessage) for call in m.tool_calls
    }
    result_ids = {m.tool_call_id for m in msgs if isinstance(m, ToolMessage)}
    assert result_ids <= call_ids
