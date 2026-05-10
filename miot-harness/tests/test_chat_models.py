from __future__ import annotations

import pytest

from miot_harness.agents.chat_models import get_chat_model
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_get_chat_model_returns_anthropic_for_claude(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    from langchain_anthropic import ChatAnthropic

    model = get_chat_model("claude-haiku-4-5")
    assert isinstance(model, ChatAnthropic)


def test_get_chat_model_returns_openai_for_gpt(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-test")
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")

    from langchain_openai import ChatOpenAI

    model = get_chat_model("gpt-4o")
    assert isinstance(model, ChatOpenAI)


def test_get_chat_model_passes_model_name_to_anthropic(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    model = get_chat_model("claude-sonnet-4-6")
    assert "claude-sonnet-4-6" in str(getattr(model, "model_name", getattr(model, "model", "")))


def test_get_chat_model_unknown_provider_raises():
    with pytest.raises(ValueError):
        get_chat_model("llama-3-405b")


def test_get_chat_model_missing_anthropic_key_raises(monkeypatch):
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    with pytest.raises(RuntimeError):
        get_chat_model("claude-haiku-4-5")
