from __future__ import annotations

from decimal import Decimal
from typing import Any

import httpx
import pytest

from miot_harness.agents.model_providers import (
    Provider,
    ProviderRegistry,
    fetch_modulith_registry,
    registry_from_modulith,
)
from miot_harness.config import HarnessSettings
from miot_harness.runtime.agent_loop import AgentLoopRunners
from tests.fixtures.fake_provider import FAKE_PROFILE
from tests.runtime.test_agent_loop import ScriptedModel
from tests.test_native_tools import _registry

PAYLOAD: dict[str, Any] = {
    "providers": [
        {
            "provider": "deepseek",
            "baseUrl": None,
            "apiKey": "sk-ds",
            "models": [
                {
                    "id": "deepseek-chat",
                    "inputPerMtok": "0.27",
                    "outputPerMtok": "1.10",
                    "default": True,
                }
            ],
        },
        {"provider": "anthropic", "apiKey": "sk-ant", "models": [{"id": "claude-opus-4-8"}]},
        {"provider": "acme-ai", "apiKey": "k", "models": [{"id": "x"}]},
    ]
}


def test_the_modulith_answer_becomes_providers_with_prices_and_a_default() -> None:
    registry = registry_from_modulith(PAYLOAD)

    assert registry.offered() == ["deepseek:deepseek-chat", "claude-opus-4-8"]
    assert registry.default_model() == "deepseek:deepseek-chat"
    spec = registry.spec("deepseek:deepseek-chat")
    assert spec is not None and spec.input_per_mtok == Decimal("0.27")
    provider, model = registry.resolve("deepseek:deepseek-chat")
    assert (provider.base_url, model) == ("https://api.deepseek.com/v1", "deepseek-chat")
    assert registry.get("acme-ai") is None, "providers the harness cannot call are skipped"


def test_the_modulith_wins_over_the_environment_and_a_new_key_changes_the_version() -> None:
    env = ProviderRegistry([Provider("anthropic", "anthropic", "sk-env")])
    merged = env.merged(registry_from_modulith(PAYLOAD))

    assert merged.resolve("claude-opus-4-8")[0].api_key == "sk-ant"
    rotated = registry_from_modulith(
        {"providers": [{**PAYLOAD["providers"][0], "apiKey": "sk-ds-new"}]}
    )
    assert (
        rotated.version != registry_from_modulith({"providers": [PAYLOAD["providers"][0]]}).version
    )


@pytest.mark.asyncio
async def test_the_harness_asks_the_modulith_with_its_key() -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        seen["key"] = request.headers.get("x-miot-harness-key", "")
        return httpx.Response(200, json=PAYLOAD)

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        registry = await fetch_modulith_registry("http://modulith:8180/", "the-key", client=client)

    assert seen == {"url": "http://modulith:8180/internal/model-providers", "key": "the-key"}
    assert "deepseek:deepseek-chat" in registry.offered()


@pytest.mark.asyncio
async def test_a_refused_request_raises_so_the_providers_in_use_stay() -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "Unauthorized"})

    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        with pytest.raises(httpx.HTTPStatusError):
            await fetch_modulith_registry("http://modulith:8180", "wrong", client=client)


def test_offered_models_and_the_default_follow_the_registry_and_runners_rebuild() -> None:
    current = {"registry": registry_from_modulith(PAYLOAD)}
    built: list[str] = []

    def build(name: str) -> Any:
        built.append(name)
        return ScriptedModel([])

    runners = AgentLoopRunners(
        default_model="claude-sonnet-4-6",
        models=["claude-sonnet-4-6"],
        build_model=build,
        registry=_registry(),
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
        providers=lambda: current["registry"],
    )

    assert runners.default_model == "deepseek:deepseek-chat", "the owner's default wins"
    assert runners.models == ("deepseek:deepseek-chat", "claude-sonnet-4-6", "claude-opus-4-8")
    first = runners.runner_for(None)
    assert runners.runner_for(None) is first, "built once while nothing changes"
    assert first.anthropic_format is False

    current["registry"] = registry_from_modulith(
        {"providers": [{**PAYLOAD["providers"][0], "apiKey": "sk-ds-rotated"}]}
    )
    assert runners.runner_for(None) is not first, "a rotated key rebuilds the runner"
    assert built == ["deepseek:deepseek-chat", "deepseek:deepseek-chat"]
