"""Verifies the synthesizer's `astream_events` path emits thinking.delta
and exactly one thinking.completed when extended thinking is enabled.
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest

from miot_harness.agents.synthesizer import synthesizer_node
from miot_harness.config import HarnessSettings
from miot_harness.integrations.nexo.provider import NEXO_PROFILE
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent


class _FakeChunk:
    def __init__(self, content: list[dict[str, Any]] | str) -> None:
        self.content = content


class _FakeEnd:
    """Mimics LangChain's on_chat_model_end output object enough that
    `_thinking_token_estimate` finds usage_metadata.
    """

    def __init__(self, usage: dict[str, Any]) -> None:
        self.usage_metadata = usage


class _FakeStreamingModel:
    """Minimal stand-in for a ChatAnthropic instance under
    `astream_events(version="v2")`. Yields a hard-coded event sequence
    so we can assert wiring without hitting the network.
    """

    def __init__(self, events: list[dict[str, Any]]) -> None:
        self._events = events

    async def astream_events(
        self, _messages, *, version: str = "v2"
    ) -> AsyncIterator[dict[str, Any]]:  # noqa: D401
        assert version == "v2"
        for evt in self._events:
            yield evt

    async def ainvoke(self, messages):  # pragma: no cover - not used in streaming path
        raise AssertionError("astream_events path should be used here")


def _streaming_events() -> list[dict[str, Any]]:
    return [
        {
            "event": "on_chat_model_stream",
            "data": {
                "chunk": _FakeChunk(
                    [{"type": "thinking", "thinking": "Step 1. "}]
                )
            },
        },
        {
            "event": "on_chat_model_stream",
            "data": {
                "chunk": _FakeChunk(
                    [{"type": "thinking", "thinking": "Step 2."}]
                )
            },
        },
        {
            "event": "on_chat_model_stream",
            "data": {
                "chunk": _FakeChunk(
                    [{"type": "text", "text": "Final answer."}]
                )
            },
        },
        {
            "event": "on_chat_model_end",
            "data": {
                "output": _FakeEnd(
                    {"output_token_details": {"thinking": 42}, "output_tokens": 50}
                ),
            },
        },
    ]


@pytest.mark.asyncio
async def test_streaming_synthesizer_emits_thinking_then_text() -> None:
    events: list[HarnessEvent] = []
    model = _FakeStreamingModel(_streaming_events())
    settings = HarnessSettings(nexo_synthesizer_stream=True)
    state = {
        "ctx": HarnessContext(thread_id="t", tenant_id="mintral", user_id="u"),
        "user_message": "hola",
        "evidence": [],
        "failure": None,
    }
    delta = await synthesizer_node(
        state,
        model=model,
        progress=events.append,
        settings=settings,  # type: ignore[arg-type]
        profile=NEXO_PROFILE,
    )

    types = [e.type for e in events]
    assert types.count("thinking.delta") == 2
    assert types.count("thinking.completed") == 1
    assert types.count("answer.completed") == 1
    # Ordering: deltas before completed, completed before answer
    delta_idx = [i for i, t in enumerate(types) if t == "thinking.delta"]
    completed_idx = types.index("thinking.completed")
    answer_idx = types.index("answer.completed")
    assert max(delta_idx) < completed_idx < answer_idx
    # Final answer carries the streamed text
    assert delta == {"answer": "Final answer."}
    # thinking.completed payload
    completed = events[completed_idx]
    assert completed.data["agent"] == "synthesizer"
    assert completed.data["tokens"] == 42
    assert completed.data["length"] == len("Step 1. Step 2.")


@pytest.mark.asyncio
async def test_streaming_synthesizer_disabled_falls_back_to_ainvoke() -> None:
    """When the kill switch is off, the legacy non-streaming path runs
    and no thinking events are emitted.
    """

    class _AinvokeOnlyModel:
        async def ainvoke(self, _messages):
            class _Resp:
                content = "ainvoke path."
            return _Resp()

        async def astream_events(self, *_args, **_kwargs):  # pragma: no cover
            raise AssertionError("astream_events should NOT be called here")
            yield  # pragma: no cover

    events: list[HarnessEvent] = []
    settings = HarnessSettings(nexo_synthesizer_stream=False)
    state = {
        "ctx": HarnessContext(thread_id="t", tenant_id="mintral", user_id="u"),
        "user_message": "hola",
        "evidence": [],
        "failure": None,
    }
    delta = await synthesizer_node(
        state,
        model=_AinvokeOnlyModel(),
        progress=events.append,
        settings=settings,  # type: ignore[arg-type]
        profile=NEXO_PROFILE,
    )
    assert delta == {"answer": "ainvoke path."}
    assert "thinking.delta" not in {e.type for e in events}
    assert "thinking.completed" not in {e.type for e in events}
