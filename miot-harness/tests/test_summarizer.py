from __future__ import annotations

from typing import Any

import pytest
from langchain_core.language_models import FakeListChatModel

from miot_harness.agents.summarizer import summarizer_node
from miot_harness.runtime.context import HarnessContext


def _ctx() -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="mintral", user_id="u")


@pytest.mark.asyncio
async def test_summarizer_compresses_long_transcript():
    """Triggered when state['messages'] exceeds the threshold; replaces
    the list with [system summary, last_message]."""
    messages = [{"role": "user", "content": f"msg {i}"} for i in range(15)]
    model = FakeListChatModel(responses=["The user is asking about Mintral fleet status."])

    state: dict[str, Any] = {
        "user_message": "?",
        "ctx": _ctx(),
        "messages": messages,
        "evidence": [],
        "turn_count": 5,
    }

    update = await summarizer_node(state, model=model)
    new_msgs = update["messages"]

    assert len(new_msgs) <= 3
    assert any("Mintral" in str(m.get("content", "")) for m in new_msgs)
    # The last user message must remain so context isn't lost
    assert any(m.get("content") == "msg 14" for m in new_msgs)


@pytest.mark.asyncio
async def test_summarizer_short_transcript_is_noop():
    """If messages are within budget, do nothing."""
    state = {
        "user_message": "?",
        "ctx": _ctx(),
        "messages": [{"role": "user", "content": "x"}],
        "evidence": [],
        "turn_count": 1,
    }
    model = FakeListChatModel(responses=[])

    update = await summarizer_node(state, model=model)
    assert update == {} or "messages" not in update
