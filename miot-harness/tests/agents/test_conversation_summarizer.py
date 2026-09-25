"""Conversation compaction: what the summarizer is shown and what it returns."""

from __future__ import annotations

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.conversation_summarizer import (
    build_conversation_summarizer,
    render_history,
)
from miot_harness.runtime.context import MAX_CONVERSATION_SUMMARY_CHARS
from miot_harness.runtime.conversation import ConversationHistory, ConversationTurn


def _history(summary: str | None = None) -> ConversationHistory:
    return ConversationHistory(
        conversation_id="c1",
        turns=[
            ConversationTurn(user_message="trips today?", assistant_answer="41"),
            ConversationTurn(user_message="and yesterday?", assistant_answer="38"),
        ],
        summary=summary,
    )


def test_render_folds_the_earlier_summary_in_first() -> None:
    rendered = render_history(_history(summary="user tracks daily trips"))
    assert rendered.startswith("Earlier summary:\nuser tracks daily trips")
    assert "User: trips today?\nAssistant: 41" in rendered
    assert rendered.index("Earlier summary") < rendered.index("User: trips today?")


def test_render_clips_a_runaway_answer() -> None:
    history = ConversationHistory(
        conversation_id="c2",
        turns=[ConversationTurn(user_message="q", assistant_answer="y" * 10_000)],
    )
    rendered = render_history(history)
    assert len(rendered) < 5_000
    assert rendered.endswith("[…]")


@pytest.mark.asyncio
async def test_summarizer_returns_the_model_text_trimmed() -> None:
    summarize = build_conversation_summarizer(
        FakeListChatModel(responses=["  the user compares daily trip counts  "])
    )
    assert await summarize(_history()) == "the user compares daily trip counts"


@pytest.mark.asyncio
async def test_an_empty_answer_is_an_error_not_a_summary() -> None:
    summarize = build_conversation_summarizer(FakeListChatModel(responses=["   "]))
    with pytest.raises(ValueError):
        await summarize(_history(summary="kept"))


@pytest.mark.asyncio
async def test_a_runaway_answer_is_cut_to_what_the_caller_can_replay() -> None:
    summarize = build_conversation_summarizer(FakeListChatModel(responses=["s" * 9_000]))
    assert len(await summarize(_history())) == MAX_CONVERSATION_SUMMARY_CHARS
