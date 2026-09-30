"""`web_search`: routes to a provider that searches, reports its usage."""

from __future__ import annotations

import asyncio
import json
from typing import Any

import httpx
import pytest

from miot_harness.agents.model_providers import KNOWN_PROVIDERS, Provider, ProviderRegistry
from miot_harness.agents.native_tools import build_native_tools
from miot_harness.config import HarnessSettings
from miot_harness.runtime.context import HarnessContext
from miot_harness.runtime.events import HarnessEvent
from miot_harness.tools.registry import ToolRegistry
from miot_harness.tools.web_search import (
    WebSearcher,
    WebSearchError,
    pick_route,
    web_search_tool,
)
from tests.fixtures.fake_provider import FAKE_PROFILE


def _provider(name: str) -> Provider:
    kind, url = KNOWN_PROVIDERS[name]
    return Provider(name, kind, f"sk-{name}", url)


def _registry(*names: str) -> ProviderRegistry:
    return ProviderRegistry([_provider(n) for n in names])


def _ctx(run_id: str = "run_1") -> HarnessContext:
    return HarnessContext(thread_id="t", tenant_id="acme", user_id="u1", run_id=run_id)


_SEARCH_MODELS = {
    "llmgateway": "llmgateway:gpt-5.6-luna",
    "anthropic": "anthropic:claude-haiku-4-5",
    "openai": "openai:gpt-5-mini",
}


def _searcher(names: tuple[str, ...], handler, **settings: Any) -> WebSearcher:
    settings.setdefault("web_search_model", _SEARCH_MODELS.get(names[-1]))
    return WebSearcher(
        providers=lambda: _registry(*names),
        settings=HarnessSettings(**settings),
        transport=httpx.MockTransport(handler),
    )


def test_the_route_is_the_configured_model_and_nothing_else() -> None:
    chosen = HarnessSettings(web_search_model="openai:gpt-5-nano")
    assert pick_route(_registry("llmgateway", "openai"), chosen).name == "openai:gpt-5-nano"
    with pytest.raises(WebSearchError, match="openai provider is not configured"):
        pick_route(_registry("llmgateway", "anthropic"), chosen)
    with pytest.raises(WebSearchError, match="needs an llmgateway, anthropic or openai model"):
        pick_route(
            _registry("deepseek"), HarnessSettings(web_search_model="deepseek:deepseek-chat")
        )
    for unset in (HarnessSettings(), HarnessSettings(web_search_model="")):
        with pytest.raises(WebSearchError, match="set MIOT_HARNESS_WEB_SEARCH_MODEL"):
            pick_route(_registry("llmgateway", "anthropic", "openai"), unset)


@pytest.mark.asyncio
async def test_llm_gateway_search_returns_the_summary_sources_and_usage() -> None:
    sent: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        sent.append({"url": str(request.url), "body": json.loads(request.content)})
        assert request.headers["authorization"] == "Bearer sk-llmgateway"
        return httpx.Response(
            200,
            json={
                "choices": [
                    {
                        "message": {
                            "content": "Chile's CPI rose 0.3% in August.",
                            "annotations": [
                                {
                                    "type": "url_citation",
                                    "url_citation": {
                                        "url": "https://ine.gob.cl/ipc",
                                        "title": "INE",
                                    },
                                },
                                {"type": "url_citation", "url": "https://ine.gob.cl/ipc"},
                            ],
                        }
                    }
                ],
                "usage": {"prompt_tokens": 120, "completion_tokens": 40, "web_search_cost": 0.025},
            },
        )

    events: list[HarnessEvent] = []
    out = await _searcher(("llmgateway",), handler).search(
        _ctx(), "chile cpi august", events.append
    )

    assert sent[0]["url"] == "https://api.llmgateway.io/v1/chat/completions"
    assert sent[0]["body"]["web_search"] is True
    assert sent[0]["body"]["model"] == "gpt-5.6-luna"
    assert out.answer == "Chile's CPI rose 0.3% in August."
    assert [(s.url, s.title) for s in out.sources] == [("https://ine.gob.cl/ipc", "INE")]
    assert out.searched_with == "llmgateway:gpt-5.6-luna"
    usage = [e.data for e in events if e.type == "usage.recorded"]
    assert usage == [
        {
            "agent": "web_search",
            "provider": "llmgateway",
            "model": "gpt-5.6-luna",
            "input_tokens": 120,
            "output_tokens": 40,
            "cache_read_input_tokens": 0,
            "cache_creation_input_tokens": 0,
            "web_search_requests": 1,
            "web_search_cost": 0.025,
        }
    ]


@pytest.mark.asyncio
async def test_anthropic_search_reads_text_citations_and_results() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        body = json.loads(request.content)
        assert str(request.url) == "https://api.anthropic.com/v1/messages"
        assert request.headers["x-api-key"] == "sk-anthropic"
        assert body["tools"][0]["type"] == "web_search_20250305"
        return httpx.Response(
            200,
            json={
                "content": [
                    {"type": "text", "text": "Let me search for that."},
                    {"type": "server_tool_use", "name": "web_search"},
                    {
                        "type": "web_search_tool_result",
                        "content": [
                            {"url": "https://a.example", "title": "A", "page_age": "2026-09-01"}
                        ],
                    },
                    {
                        "type": "text",
                        "text": "Answer.",
                        "citations": [{"url": "https://b.example", "title": "B"}],
                    },
                ],
                "usage": {
                    "input_tokens": 900,
                    "output_tokens": 60,
                    "server_tool_use": {"web_search_requests": 2},
                },
            },
        )

    events: list[HarnessEvent] = []
    out = await _searcher(("anthropic",), handler).search(_ctx(), "q", events.append)
    assert out.answer == "Answer."
    assert [s.url for s in out.sources] == ["https://a.example", "https://b.example"]
    assert out.sources[0].date == "2026-09-01"
    usage = next(e.data for e in events if e.type == "usage.recorded")
    assert (usage["model"], usage["input_tokens"], usage["web_search_requests"]) == (
        "claude-haiku-4-5",
        900,
        2,
    )


@pytest.mark.asyncio
async def test_openai_search_reads_the_responses_output() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        assert str(request.url) == "https://api.openai.com/v1/responses"
        assert json.loads(request.content)["tools"] == [{"type": "web_search"}]
        return httpx.Response(
            200,
            json={
                "output": [
                    {"type": "web_search_call", "status": "completed"},
                    {
                        "type": "message",
                        "content": [
                            {
                                "type": "output_text",
                                "text": "Result.",
                                "annotations": [
                                    {
                                        "type": "url_citation",
                                        "url": "https://c.example",
                                        "title": "C",
                                    }
                                ],
                            }
                        ],
                    },
                ],
                "usage": {"input_tokens": 300, "output_tokens": 30},
            },
        )

    out = await _searcher(("openai",), handler).search(_ctx(), "q", lambda _e: None)
    assert out.answer == "Result."
    assert [s.url for s in out.sources] == ["https://c.example"]


@pytest.mark.asyncio
async def test_a_provider_error_and_the_run_limit_are_errors() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        return httpx.Response(400, json={"error": "Model x does not support native web search"})

    with pytest.raises(WebSearchError, match="400"):
        await _searcher(("llmgateway",), refuse).search(_ctx(), "q", lambda _e: None)

    def ok(request: httpx.Request) -> httpx.Response:
        message = {"content": "x", "annotations": [{"url": "https://a.example"}]}
        return httpx.Response(200, json={"choices": [{"message": message}], "usage": {}})

    searcher = _searcher(("llmgateway",), ok, web_search_max_per_run=2)
    await searcher.search(_ctx("run_a"), "q", lambda _e: None)
    await searcher.search(_ctx("run_a"), "q", lambda _e: None)
    with pytest.raises(WebSearchError, match="limit"):
        await searcher.search(_ctx("run_a"), "q", lambda _e: None)
    await searcher.search(_ctx("run_b"), "q", lambda _e: None)


@pytest.mark.asyncio
async def test_without_a_search_model_the_tool_answers_with_an_error() -> None:
    def never(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no call expected")

    searcher = _searcher(("anthropic", "openai"), never, web_search_model=None)
    registry = ToolRegistry()
    registry.register(web_search_tool(searcher))
    tools = {t["name"] for t in build_native_tools(registry, profile=FAKE_PROFILE)}
    assert "web_search" in tools
    with pytest.raises(WebSearchError, match="set MIOT_HARNESS_WEB_SEARCH_MODEL"):
        await searcher.search(_ctx(), "q", lambda _e: None)


@pytest.mark.asyncio
async def test_every_search_an_anthropic_call_runs_counts_toward_the_limit() -> None:
    max_uses: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        max_uses.append(json.loads(request.content)["tools"][0]["max_uses"])
        return httpx.Response(
            200,
            json={
                "content": [
                    {"type": "text", "text": "x", "citations": [{"url": "https://a.example"}]}
                ],
                "usage": {"server_tool_use": {"web_search_requests": 3}},
            },
        )

    searcher = _searcher(("anthropic",), handler, web_search_max_per_run=4)
    await searcher.search(_ctx(), "q", lambda _e: None)
    # 3 of 4 used, so the next call may run only one more.
    await searcher.search(_ctx(), "q", lambda _e: None)
    assert max_uses == [3, 1]
    with pytest.raises(WebSearchError, match="limit"):
        await searcher.search(_ctx(), "q", lambda _e: None)


@pytest.mark.asyncio
async def test_searches_running_at_the_same_time_stay_within_the_limit() -> None:
    max_uses: list[int] = []

    def handler(request: httpx.Request) -> httpx.Response:
        uses = json.loads(request.content)["tools"][0]["max_uses"]
        max_uses.append(uses)
        return httpx.Response(
            200,
            json={
                "content": [
                    {"type": "text", "text": "x", "citations": [{"url": "https://a.example"}]}
                ],
                "usage": {"server_tool_use": {"web_search_requests": uses}},
            },
        )

    searcher = _searcher(("anthropic",), handler, web_search_max_per_run=4)
    ctx = _ctx()
    await asyncio.gather(
        searcher.search(ctx, "q", lambda _e: None),
        searcher.search(ctx, "q", lambda _e: None),
    )
    assert sorted(max_uses) == [1, 3]
    third = searcher.search(ctx, "q", lambda _e: None)
    with pytest.raises(WebSearchError, match="limit"):
        await third


@pytest.mark.asyncio
async def test_a_failed_search_counts_once() -> None:
    def refuse(request: httpx.Request) -> httpx.Response:
        return httpx.Response(500, json={"error": "down"})

    searcher = _searcher(("anthropic",), refuse, web_search_max_per_run=2)
    ctx = _ctx()
    outcomes = []
    for _ in range(3):
        search = searcher.search(ctx, "q", lambda _e: None)
        with pytest.raises(WebSearchError) as caught:
            await search
        outcomes.append("limit" if "limit" in str(caught.value) else "failed")
    assert outcomes == ["failed", "failed", "limit"]


def test_the_description_mentions_web_fetch_only_when_it_is_offered() -> None:
    def never(request: httpx.Request) -> httpx.Response:
        raise AssertionError("no call expected")

    searcher = _searcher(("anthropic",), never)
    assert "web_fetch" not in web_search_tool(searcher).description
    assert "web_fetch" in web_search_tool(searcher, with_fetch=True).description


@pytest.mark.asyncio
async def test_an_answer_without_sources_is_an_error_and_still_billed() -> None:
    def memory_only(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "choices": [{"message": {"content": "August 2026 has not happened yet."}}],
                "usage": {"prompt_tokens": 74, "completion_tokens": 900},
            },
        )

    events: list[HarnessEvent] = []
    with pytest.raises(WebSearchError, match="no web sources"):
        await _searcher(("llmgateway",), memory_only).search(_ctx(), "q", events.append)
    usage = next(e.data for e in events if e.type == "usage.recorded")
    assert (usage["output_tokens"], usage["web_search_requests"]) == (900, 0)


@pytest.mark.asyncio
async def test_a_search_that_found_nothing_says_so_without_blaming_the_model() -> None:
    def empty(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "content": [{"type": "text", "text": "Nothing found."}],
                "usage": {"server_tool_use": {"web_search_requests": 1}},
            },
        )

    with pytest.raises(WebSearchError) as raised:
        await _searcher(("anthropic",), empty).search(_ctx(), "q", lambda _e: None)
    assert "no usable web sources" in str(raised.value)
    assert "administrator" not in str(raised.value)


@pytest.mark.asyncio
async def test_llm_gateway_search_cost_is_read_from_cost_details() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        message = {"content": "x", "annotations": [{"url": "https://a.example"}]}
        usage = {
            "prompt_tokens": 10,
            "completion_tokens": 5,
            "cost_details": {"web_search_cost": 0.01},
        }
        return httpx.Response(200, json={"choices": [{"message": message}], "usage": usage})

    events: list[HarnessEvent] = []
    await _searcher(("llmgateway",), handler).search(_ctx(), "q", events.append)
    usage = next(e.data for e in events if e.type == "usage.recorded")
    assert usage["web_search_cost"] == 0.01
