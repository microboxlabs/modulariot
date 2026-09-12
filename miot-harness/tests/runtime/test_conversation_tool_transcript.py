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


def test_a_turn_too_large_to_replay_falls_back_to_its_text() -> None:
    """One turn that ran thirty queries can be larger than the whole budget.
    Trimming it away leaves nothing, which is the amnesia this replay exists
    to prevent, so the text pair stands in."""

    big = ConversationTurn(
        user_message="how many?",
        assistant_answer="291",
        messages=(
            HumanMessage(content="how many?"),
            AIMessage(
                content="",
                tool_calls=[{"name": "acs_query", "args": {}, "id": "c1"}],
            ),
            ToolMessage(content="x" * 80_000, tool_call_id="c1"),
            AIMessage(content="291"),
        ),
    )
    history = ConversationHistory(conversation_id="convT", turns=[big])
    msgs = to_messages(history, max_tokens=100, include_tool_calls=True)
    assert [m.content for m in msgs] == ["how many?", "291"]


def test_older_turns_degrade_to_text_instead_of_disappearing() -> None:
    """Tool envelopes cost far more than the answer they produced, so a
    budget holding ten text pairs holds about six turns of tool history.
    The older turns keep their text rather than dropping out of the replay."""

    turns = [
        ConversationTurn(
            user_message=f"q{i}",
            assistant_answer=f"a{i}",
            messages=(
                HumanMessage(content=f"q{i}"),
                AIMessage(
                    content="",
                    tool_calls=[{"name": "acs_query", "args": {}, "id": f"c{i}"}],
                ),
                ToolMessage(content="x" * 12_000, tool_call_id=f"c{i}"),
                AIMessage(content=f"a{i}"),
            ),
        )
        for i in range(6)
    ]
    history = ConversationHistory(conversation_id="convT", turns=turns)
    msgs = to_messages(history, max_tokens=6_000, include_tool_calls=True)

    replayed = [m.content for m in msgs if isinstance(m, HumanMessage)]
    assert replayed == [f"q{i}" for i in range(6)]
    # The newest turns keep their tool history; the oldest are text only.
    assert [m.tool_call_id for m in msgs if isinstance(m, ToolMessage)]
    assert len([m for m in msgs if isinstance(m, ToolMessage)]) < len(turns)
