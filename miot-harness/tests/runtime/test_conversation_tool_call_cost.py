"""A tool call's arguments count against both limits.

The query a turn ran lives in `AIMessage.tool_calls`, not in `content`.
`count_tokens_approximately` does charge it — measured: a 100 000-character
query costs 25 027 tokens on a message whose content is empty — so the replay
budget was never the gap. The store's own character count was: it read
`msg.content` and walked straight past the query.
"""

from __future__ import annotations

from langchain_core.messages import AIMessage, HumanMessage, ToolMessage

from miot_harness.runtime.conversation import (
    ConversationHistory,
    ConversationTurn,
    InMemoryConversationStore,
    to_messages,
)

_BIG_SQL = "SELECT " + ("col, " * 20_000) + "1"


def _turn_with_big_call(index: int) -> ConversationTurn:
    return ConversationTurn(
        user_message=f"q{index}",
        assistant_answer=f"a{index}",
        messages=(
            HumanMessage(content=f"q{index}"),
            AIMessage(
                content="",
                tool_calls=[
                    {"name": "acs_query", "args": {"sql": _BIG_SQL}, "id": f"c{index}"}
                ],
            ),
            ToolMessage(content="{}", tool_call_id=f"c{index}"),
            AIMessage(content=f"a{index}"),
        ),
    )


def test_a_turn_too_big_to_replay_because_of_its_query_falls_back_to_text() -> None:
    """The newest turn is admitted whatever it costs, so the trim is what
    holds the limit for it. Every message here has tiny content, so this
    only works because the counter charges the call."""

    history = ConversationHistory(
        conversation_id="convC", turns=[_turn_with_big_call(0)]
    )
    msgs = to_messages(history, max_tokens=2_000, include_tool_calls=True)

    assert not [call for m in msgs if isinstance(m, AIMessage) for call in m.tool_calls]
    assert [m.content for m in msgs] == ["q0", "a0"]


def test_the_replay_budget_charges_the_query_a_turn_ran() -> None:
    history = ConversationHistory(
        conversation_id="convC", turns=[_turn_with_big_call(i) for i in range(3)]
    )
    msgs = to_messages(history, max_tokens=2_000, include_tool_calls=True)

    replayed_calls = [
        call for m in msgs if isinstance(m, AIMessage) for call in m.tool_calls
    ]
    # A 2k budget cannot hold three 100k-character queries.
    assert len(replayed_calls) < 3


def test_the_memory_bound_charges_the_query_a_turn_ran() -> None:
    store = InMemoryConversationStore(max_conversations=100, max_chars=200_000)
    for i in range(6):
        store.append(f"conv{i}", _turn_with_big_call(i))

    held = [i for i in range(6) if store.get(f"conv{i}") is not None]
    assert len(held) < 6
    assert 5 in held  # the newest survives
