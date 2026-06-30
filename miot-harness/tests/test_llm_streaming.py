"""Verifies stream_llm_with_thinking emits answer.delta for each text
chunk (in order) and still returns the joined, stripped answer.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest

from miot_harness.agents.llm_streaming import stream_llm_with_thinking
from miot_harness.runtime.events import HarnessEvent


class _FakeChunk:
    def __init__(self, content: list[dict[str, Any]] | str) -> None:
        self.content = content


class _FakeStreamingModel:
    def __init__(self, events: list[dict[str, Any]]) -> None:
        self._events = events

    async def astream_events(
        self, _messages, *, version: str = "v2"
    ) -> AsyncIterator[dict[str, Any]]:
        assert version == "v2"
        for evt in self._events:
            yield evt


def _events() -> list[dict[str, Any]]:
    return [
        {"event": "on_chat_model_stream",
         "data": {"chunk": _FakeChunk([{"type": "thinking", "thinking": "hmm "}])}},
        {"event": "on_chat_model_stream",
         "data": {"chunk": _FakeChunk([{"type": "text", "text": "Hello "}])}},
        {"event": "on_chat_model_stream",
         "data": {"chunk": _FakeChunk([{"type": "text", "text": "world."}])}},
    ]


@pytest.mark.asyncio
async def test_emits_answer_delta_per_text_chunk() -> None:
    emitted: list[HarnessEvent] = []
    model = _FakeStreamingModel(_events())

    answer = await stream_llm_with_thinking(
        model=model,  # type: ignore[arg-type]
        messages=[],
        progress=emitted.append,
        run_id="r1",
        agent_name="synthesizer",
    )

    deltas = [e for e in emitted if e.type == "answer.delta"]
    assert [d.data["delta"] for d in deltas] == ["Hello ", "world."]
    assert [d.data["index"] for d in deltas] == [0, 1]
    assert all(d.data["agent"] == "synthesizer" for d in deltas)
    assert answer == "Hello world."


@pytest.mark.asyncio
async def test_string_content_also_emits_answer_delta() -> None:
    emitted: list[HarnessEvent] = []
    model = _FakeStreamingModel(
        [{"event": "on_chat_model_stream",
          "data": {"chunk": _FakeChunk("plain text")}}]
    )
    answer = await stream_llm_with_thinking(
        model=model,  # type: ignore[arg-type]
        messages=[],
        progress=emitted.append,
        run_id="r1",
        agent_name="meta",
    )
    deltas = [e for e in emitted if e.type == "answer.delta"]
    assert [d.data["delta"] for d in deltas] == ["plain text"]
    assert answer == "plain text"
