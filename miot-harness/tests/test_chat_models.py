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


def test_get_chat_model_effort_sets_adaptive_thinking(monkeypatch):
    # Opus 4.7+ path: effort → adaptive thinking + output_config.effort shorthand,
    # and crucially NOT thinking.type=enabled (which Opus 4.8 rejects with a 400).
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    model = get_chat_model("claude-opus-4-8", effort="xhigh")
    assert model.thinking == {"type": "adaptive"}
    assert model.effort == "xhigh"


def test_get_chat_model_no_effort_leaves_thinking_unset(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    model = get_chat_model("claude-opus-4-8")
    assert model.thinking is None
    assert model.effort is None


def test_get_chat_model_budget_path_unchanged(monkeypatch):
    # Pre-4.7 budget path (Sonnet 4.6) keeps thinking.type=enabled + max_tokens bump.
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    model = get_chat_model("claude-sonnet-4-6", thinking_budget_tokens=8000)
    assert model.thinking == {"type": "enabled", "budget_tokens": 8000}
    assert model.max_tokens == 8000 + 4096
    assert model.effort is None


def test_get_chat_model_effort_and_budget_together_raises(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    with pytest.raises(ValueError, match="not both"):
        get_chat_model("claude-opus-4-8", effort="high", thinking_budget_tokens=4096)


def test_get_chat_model_invalid_effort_raises(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    with pytest.raises(ValueError, match="invalid effort"):
        get_chat_model("claude-opus-4-8", effort="turbo")  # type: ignore[arg-type]
