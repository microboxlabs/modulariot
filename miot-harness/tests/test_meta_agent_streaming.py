"""Verifies meta_agent_node streams thinking via astream_events when
opted in (plan: SSE rich events for all dispatch modes).
"""

from __future__ import annotations

from collections.abc import AsyncIterator
from typing import Any

import pytest

from miot_harness.agents.meta_agent import MetaAgentCatalogEntry, meta_agent_node
from miot_harness.runtime.events import HarnessEvent


class _FakeChunk:
    def __init__(self, content: list[dict[str, Any]] | str) -> None:
        self.content = content


class _FakeStreamingModel:
    def __init__(self, events: list[dict[str, Any]]) -> None:
        self._events = events

    async def astream_events(
        self, _messages, *, version: str = "v2"
    ) -> AsyncIterator[dict[str, Any]]:  # noqa: D401
        assert version == "v2"
        for evt in self._events:
            yield evt

    async def ainvoke(self, messages):  # pragma: no cover - not used in streaming path
        raise AssertionError("astream_events should be used here")


def _stream_events() -> list[dict[str, Any]]:
    return [
        {
            "event": "on_chat_model_stream",
            "data": {
                "chunk": _FakeChunk([{"type": "thinking", "thinking": "Looking up fn_dx_…"}]),
            },
        },
        {
            "event": "on_chat_model_stream",
            "data": {"chunk": _FakeChunk([{"type": "text", "text": "El fn_dx_X devuelve …"}])},
        },
        {"event": "on_chat_model_end", "data": {}},
    ]


@pytest.mark.asyncio
async def test_meta_agent_emits_thinking_when_streaming_enabled() -> None:
    events: list[HarnessEvent] = []
    catalog = [
        MetaAgentCatalogEntry(name="fn_dx_x", layer="L1", title="t", body="b"),
    ]
    delta = await meta_agent_node(
        {"user_message": "que hace fn_dx_x?"},
        model=_FakeStreamingModel(_stream_events()),  # type: ignore[arg-type]
        primer="primer",
        catalog=catalog,
        progress=events.append,
        stream=True,
        run_id="run_meta_1",
    )
    types = [e.type for e in events]
    assert "thinking.delta" in types
    assert "thinking.completed" in types
    # Final answer captured from text blocks
    assert delta == {"answer": "El fn_dx_X devuelve …"}
    # Agent tag is meta_agent across thinking events
    for e in events:
        assert e.data.get("agent") == "meta_agent"


@pytest.mark.asyncio
async def test_meta_agent_skips_streaming_when_disabled() -> None:
    """When stream=False (or progress is None), the legacy ainvoke path runs."""

    class _AinvokeOnly:
        async def ainvoke(self, _messages):
            class _R:
                content = "static answer"
            return _R()

    delta = await meta_agent_node(
        {"user_message": "hi"},
        model=_AinvokeOnly(),  # type: ignore[arg-type]
        primer="p",
        catalog=[],
        progress=None,
        stream=False,
    )
    assert delta == {"answer": "static answer"}
