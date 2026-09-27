from __future__ import annotations

import json
from typing import Any

import httpx
import pytest
from langchain_core.language_models.fake_chat_models import GenericFakeChatModel
from langchain_core.messages import AIMessage

from miot_harness.agents.chat_models import get_chat_model, set_provider_registry
from miot_harness.agents.model_providers import registry_from_modulith
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.runtime.instrumentation import instrument_model
from miot_harness.runtime.run_store import HarnessRunRecord
from miot_harness.runtime.usage_report import UsageReporter, usage_lines


def _usage(provider: str, model: str, inp: int, out: int, cache_read: int = 0) -> HarnessEvent:
    return HarnessEvent(
        run_id="run_1",
        type="usage.recorded",
        message="usage",
        data={
            "agent": "agent_loop",
            "provider": provider,
            "model": model,
            "input_tokens": inp,
            "output_tokens": out,
            "cache_read_input_tokens": cache_read,
            "cache_creation_input_tokens": 0,
        },
    )


EVENTS = [
    _usage("deepseek", "deepseek-chat", 100, 10, cache_read=50),
    HarnessEvent(run_id="run_1", type="tool.started", message="t", data={}),
    _usage("deepseek", "deepseek-chat", 200, 20),
    _usage("anthropic", "claude-opus-4-8", 7, 3),
    _usage("", "claude-haiku-4-5", 1, 1),
]


def test_usage_is_summed_per_provider_and_model() -> None:
    assert usage_lines(EVENTS) == [
        {
            "provider": "deepseek",
            "model": "deepseek-chat",
            "calls": 2,
            "inputTokens": 300,
            "outputTokens": 30,
            "cacheReadTokens": 50,
            "cacheWriteTokens": 0,
        },
        {
            "provider": "anthropic",
            "model": "claude-opus-4-8",
            "calls": 1,
            "inputTokens": 7,
            "outputTokens": 3,
            "cacheReadTokens": 0,
            "cacheWriteTokens": 0,
        },
    ]


def _reporter(handler: Any) -> tuple[UsageReporter, httpx.AsyncClient]:
    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    return (
        UsageReporter("http://modulith:8180/", "the-key", backoff_seconds=0, client=client),
        client,
    )


@pytest.mark.asyncio
async def test_a_finished_run_is_reported_with_its_organization() -> None:
    seen: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        seen.append(request)
        return httpx.Response(200, json={"stored": 2})

    reporter, client = _reporter(handler)
    record = HarnessRunRecord(run_id="run_1", status="completed", events=EVENTS)
    ctx = HarnessContext(thread_id="t", tenant_id="tenant-1", user_id="alice", organization="acme")
    async with client:
        reporter.report(record, ctx)
        await reporter.drain()

    (request,) = seen
    assert str(request.url) == "http://modulith:8180/internal/model-usage"
    assert request.headers["x-miot-harness-key"] == "the-key"
    body = json.loads(request.content)
    assert (body["runId"], body["organization"], body["tenantId"]) == ("run_1", "acme", "tenant-1")
    assert len(body["usage"]) == 2


@pytest.mark.asyncio
async def test_a_run_with_no_usage_is_not_reported() -> None:
    reporter, client = _reporter(lambda request: pytest.fail("no post expected"))
    async with client:
        reporter.report(
            HarnessRunRecord(run_id="run_1", status="failed"),
            HarnessContext(thread_id="t", tenant_id="tenant-1", user_id="alice"),
        )
        await reporter.drain()


@pytest.mark.asyncio
async def test_server_errors_are_retried_and_refusals_are_not() -> None:
    answers = iter([503, 200])
    calls = {"n": 0}

    def flaky(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(next(answers))

    reporter, client = _reporter(flaky)
    async with client:
        assert await reporter.send({"runId": "run_1", "usage": []}) is True
    assert calls["n"] == 2

    calls["n"] = 0

    def refused(request: httpx.Request) -> httpx.Response:
        calls["n"] += 1
        return httpx.Response(401)

    reporter, client = _reporter(refused)
    async with client:
        assert await reporter.send({"runId": "run_1", "usage": []}) is False
    assert calls["n"] == 1


@pytest.mark.asyncio
async def test_models_carry_the_provider_they_are_charged_to_into_usage_events() -> None:
    set_provider_registry(
        registry_from_modulith(
            {
                "providers": [
                    {"provider": "deepseek", "apiKey": "k", "models": [{"id": "deepseek-chat"}]}
                ]
            }
        )
    )
    try:
        model = get_chat_model("deepseek:deepseek-chat")
    finally:
        set_provider_registry(None)
    assert model.metadata is not None
    assert model.metadata["miot_provider"] == "deepseek"

    # The same metadata on a model that answers offline reaches the callback.
    fake = GenericFakeChatModel(
        messages=iter(
            [
                AIMessage(
                    content="ok",
                    usage_metadata={
                        "input_tokens": 5,
                        "output_tokens": 2,
                        "total_tokens": 7,
                    },
                )
            ]
        ),
        metadata=model.metadata,
    )
    events: list[HarnessEvent] = []
    ctx = HarnessContext(thread_id="t", tenant_id="tenant-1", user_id="alice")
    await instrument_model(fake, "agent_loop", ctx, progress=events.append).ainvoke("hi")

    (usage,) = [e.data for e in events if e.type == "usage.recorded"]
    assert (usage["provider"], usage["model"]) == ("deepseek", "deepseek-chat")
