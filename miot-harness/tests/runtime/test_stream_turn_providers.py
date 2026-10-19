"""`_stream_turn` against the real provider clients, over a mocked HTTP wire."""

import json
from typing import Any

import anthropic
import httpx
import pytest
from langchain_core.messages import HumanMessage

from miot_harness.agents.chat_models import get_chat_model, set_provider_registry
from miot_harness.agents.model_providers import Provider, ProviderRegistry
from miot_harness.runtime.agent_loop import _plain_messages, _storable, _stream_turn


@pytest.fixture(autouse=True)
def _registry():
    set_provider_registry(
        ProviderRegistry(
            [
                Provider("anthropic", "anthropic", "sk-test"),
                Provider("llmgateway", "openai_compatible", "sk-test", "https://gw.test/v1"),
            ]
        )
    )
    yield
    set_provider_registry(None)


def _sse(events: list[tuple[str | None, Any]]) -> bytes:
    lines = []
    for name, data in events:
        if name:
            lines.append(f"event: {name}")
        lines.append(f"data: {data if isinstance(data, str) else json.dumps(data)}")
        lines.append("")
    return ("\n".join(lines) + "\n").encode()


def _anthropic_stream() -> bytes:
    usage = {"input_tokens": 10, "output_tokens": 1}
    message = {
        "id": "msg_1",
        "type": "message",
        "role": "assistant",
        "model": "claude-opus-5-5",
        "content": [],
        "stop_reason": None,
        "stop_sequence": None,
        "usage": usage,
    }
    return _sse(
        [
            ("message_start", {"type": "message_start", "message": message}),
            (
                "content_block_start",
                {
                    "type": "content_block_start",
                    "index": 0,
                    "content_block": {"type": "thinking", "thinking": "", "signature": ""},
                },
            ),
            (
                "content_block_delta",
                {
                    "type": "content_block_delta",
                    "index": 0,
                    "delta": {"type": "thinking_delta", "thinking": "Check the totals."},
                },
            ),
            (
                "content_block_delta",
                {
                    "type": "content_block_delta",
                    "index": 0,
                    "delta": {"type": "signature_delta", "signature": "sig"},
                },
            ),
            ("content_block_stop", {"type": "content_block_stop", "index": 0}),
            (
                "content_block_start",
                {
                    "type": "content_block_start",
                    "index": 1,
                    "content_block": {"type": "text", "text": ""},
                },
            ),
            (
                "content_block_delta",
                {
                    "type": "content_block_delta",
                    "index": 1,
                    "delta": {"type": "text_delta", "text": "Hello."},
                },
            ),
            ("content_block_stop", {"type": "content_block_stop", "index": 1}),
            (
                "message_delta",
                {
                    "type": "message_delta",
                    "delta": {"stop_reason": "end_turn", "stop_sequence": None},
                    "usage": {"output_tokens": 5},
                },
            ),
            ("message_stop", {"type": "message_stop"}),
        ]
    )


def _openai_stream() -> bytes:
    def chunk(delta: dict[str, Any], finish: str | None = None) -> dict[str, Any]:
        return {
            "id": "c1",
            "object": "chat.completion.chunk",
            "created": 0,
            "model": "deepseek-v4-flash",
            "choices": [{"index": 0, "delta": delta, "finish_reason": finish}],
        }

    return _sse(
        [
            (None, chunk({"role": "assistant", "content": None, "reasoning_content": "Plan "})),
            (None, chunk({"content": None, "reasoning_content": "the reply."})),
            (None, chunk({"content": "Hello."})),
            (None, chunk({}, finish="stop")),
            (None, "[DONE]"),
        ]
    )


def _transport(body: bytes, requests: list[dict[str, Any]]) -> httpx.MockTransport:
    def handler(request: httpx.Request) -> httpx.Response:
        requests.append(json.loads(request.content))
        return httpx.Response(200, content=body, headers={"content-type": "text/event-stream"})

    return httpx.MockTransport(handler)


def _deltas(events: list[Any], kind: str) -> list[str]:
    return [e.data["delta"] for e in events if e.type == kind]


@pytest.mark.asyncio
async def test_adaptive_thinking_asks_for_summaries_and_streams_them():
    requests: list[dict[str, Any]] = []
    model = get_chat_model("claude-opus-5-5", effort="high")
    model.__dict__["_async_client"] = anthropic.AsyncAnthropic(
        api_key="sk-test",
        http_client=httpx.AsyncClient(transport=_transport(_anthropic_stream(), requests)),
    )
    events: list[Any] = []

    message, first_chunk_at = await _stream_turn(
        model, [HumanMessage(content="hi")], progress=events.append, run_id="r1"
    )

    assert requests[0]["thinking"] == {"type": "adaptive", "display": "summarized"}
    assert _deltas(events, "thinking.delta") == ["Check the totals."]
    assert _deltas(events, "answer.delta") == ["Hello."]
    assert first_chunk_at is not None
    assert [b["type"] for b in message.content] == ["thinking", "text"]


@pytest.mark.asyncio
async def test_reasoning_content_streams_as_thinking_and_is_never_sent_back():
    requests: list[dict[str, Any]] = []
    model = get_chat_model("llmgateway:deepseek-v4-flash")
    model.http_async_client = httpx.AsyncClient(transport=_transport(_openai_stream(), requests))
    model.async_client = None
    model.root_async_client = None
    model.validate_environment()
    events: list[Any] = []

    message, _ = await _stream_turn(
        model, [HumanMessage(content="hi")], progress=events.append, run_id="r1"
    )

    assert requests[0]["model"] == "deepseek-v4-flash"
    assert _deltas(events, "thinking.delta") == ["Plan ", "the reply."]
    assert _deltas(events, "answer.delta") == ["Hello."]
    assert message.content == "Hello."
    assert message.additional_kwargs["reasoning_content"] == "Plan the reply."
    stored = _storable(message, set())
    assert stored is not None
    assert "reasoning_content" not in stored.additional_kwargs

    history = _plain_messages([HumanMessage(content="hi"), message, HumanMessage(content="more")])
    assert "reasoning_content" not in json.dumps(model._get_request_payload(history))
    claude = get_chat_model("claude-opus-5-5", effort="high")
    assert "Plan the reply" not in json.dumps(claude._get_request_payload(history), default=str)
