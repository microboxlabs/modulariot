from __future__ import annotations

import json
from collections.abc import Iterator

import pytest
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage, ToolMessage

from miot_harness.agents.chat_models import get_chat_model, set_provider_registry
from miot_harness.agents.model_providers import (
    Provider,
    ProviderRegistry,
    is_anthropic,
    qualified,
    registry_from_settings,
    split_model,
)
from miot_harness.config import get_settings
from miot_harness.runtime.agent_loop import AgentLoopRunner, _plain_messages


@pytest.fixture(autouse=True)
def _clean() -> Iterator[None]:
    get_settings.cache_clear()
    set_provider_registry(None)
    yield
    set_provider_registry(None)
    get_settings.cache_clear()


def test_a_model_name_says_its_provider() -> None:
    assert split_model("deepseek:deepseek-chat") == ("deepseek", "deepseek-chat")
    assert split_model("openrouter:anthropic/claude-sonnet-4") == (
        "openrouter",
        "anthropic/claude-sonnet-4",
    )
    assert split_model("claude-sonnet-4-6") == ("anthropic", "claude-sonnet-4-6")
    assert split_model("gpt-4o") == ("openai", "gpt-4o")
    with pytest.raises(ValueError, match="provider:model"):
        split_model("mystery-model")


def test_anthropic_and_openai_models_keep_their_bare_names() -> None:
    assert qualified("anthropic", "claude-opus-4-8") == "claude-opus-4-8"
    assert qualified("openai", "gpt-4o") == "gpt-4o"
    assert qualified("kimi", "kimi-k2") == "kimi:kimi-k2"
    assert is_anthropic("claude-haiku-4-5")
    assert not is_anthropic("openrouter:anthropic/claude-sonnet-4")


def test_providers_come_from_the_environment_with_keys_by_reference() -> None:
    registry = registry_from_settings(
        anthropic_api_key="sk-ant",
        openai_api_key=None,
        providers_json=json.dumps(
            [
                {"provider": "deepseek", "api_key_env": "DS_KEY", "models": ["deepseek-chat"]},
                {"provider": "qwen", "api_key_env": "QWEN_KEY", "models": ["qwen-max"]},
            ]
        ),
        environ={"DS_KEY": "sk-ds", "QWEN_KEY": "sk-qwen"},
    )

    deepseek, model = registry.resolve("deepseek:deepseek-chat")
    assert (deepseek.kind, deepseek.base_url, deepseek.api_key, model) == (
        "openai_compatible",
        "https://api.deepseek.com/v1",
        "sk-ds",
        "deepseek-chat",
    )
    assert registry.offered() == ["deepseek:deepseek-chat", "qwen:qwen-max"]
    assert "sk-ds" not in repr(deepseek), "the key never shows in a repr or log line"


def test_a_provider_without_its_key_or_unknown_is_refused() -> None:
    with pytest.raises(ValueError, match="KIMI_KEY is not set"):
        registry_from_settings(
            anthropic_api_key=None,
            openai_api_key=None,
            providers_json='[{"provider": "kimi", "api_key_env": "KIMI_KEY"}]',
            environ={},
        )
    with pytest.raises(ValueError, match="unknown model provider"):
        registry_from_settings(
            anthropic_api_key=None,
            openai_api_key=None,
            providers_json='[{"provider": "acme-ai", "api_key_env": "K"}]',
            environ={"K": "x"},
        )
    with pytest.raises(RuntimeError, match="needs the glm provider"):
        ProviderRegistry().resolve("glm:glm-4.6")


def test_an_openai_compatible_model_uses_the_openai_client_on_its_base_url() -> None:
    from langchain_deepseek import ChatDeepSeek

    set_provider_registry(
        ProviderRegistry(
            [Provider("deepseek", "openai_compatible", "sk-ds", "https://api.deepseek.com/v1")]
        )
    )

    model = get_chat_model("deepseek:deepseek-chat", thinking_budget_tokens=4096)

    # ChatDeepSeek is ChatOpenAI plus the streamed `reasoning_content`.
    assert isinstance(model, ChatDeepSeek)
    assert model.model_name == "deepseek-chat"
    assert model.api_base == "https://api.deepseek.com/v1"
    assert str(model.async_client._client.base_url) == "https://api.deepseek.com/v1/"
    # The loop's tool schemas (Anthropic format) bind to the OpenAI client.
    model.bind_tools(
        [{"name": "acs_select", "description": "rows", "input_schema": {"type": "object"}}]
    )


def test_the_anthropic_key_message_is_the_one_operators_know(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError, match="ANTHROPIC_API_KEY is not set"):
        get_chat_model("claude-sonnet-4-6")


def test_other_providers_get_plain_text_without_cache_markers() -> None:
    messages = [
        SystemMessage(
            content=[{"type": "text", "text": "sys", "cache_control": {"type": "ephemeral"}}]
        ),
        HumanMessage(content=[{"type": "text", "text": "q"}]),
        AIMessage(
            content=[
                {"type": "thinking", "thinking": "hmm", "signature": "sig"},
                {"type": "text", "text": "looking"},
                {"type": "tool_use", "id": "c1", "name": "acs_select", "input": {}},
            ],
            tool_calls=[{"name": "acs_select", "args": {}, "id": "c1", "type": "tool_call"}],
        ),
        ToolMessage(content="rows", tool_call_id="c1"),
    ]

    plain = _plain_messages(messages)

    assert [m.content for m in plain] == ["sys", "q", "looking", "rows"]
    assert plain[2].tool_calls[0]["id"] == "c1", "tool calls stay on the message"


def test_a_runner_for_another_provider_has_a_plain_system_prompt() -> None:
    from miot_harness.config import HarnessSettings
    from tests.fixtures.fake_provider import FAKE_PROFILE
    from tests.runtime.test_agent_loop import ScriptedModel
    from tests.test_native_tools import _registry

    runner = AgentLoopRunner(
        model=ScriptedModel([]),  # type: ignore[arg-type]
        registry=_registry(),
        settings=HarnessSettings(),
        profile=FAKE_PROFILE,
        anthropic_format=False,
    )

    assert isinstance(runner.system_message.content, str)
