from __future__ import annotations

import pytest

from miot_harness.agents.chat_models import get_chat_model, loop_model_kwargs
from miot_harness.config import get_settings


@pytest.fixture(autouse=True)
def _api_key_and_cache(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_default_timeout_unchanged():
    model = get_chat_model("claude-sonnet-4-6")
    assert model.default_request_timeout == 60


def test_loop_timeout_override():
    model = get_chat_model("claude-sonnet-4-6", timeout=300)
    assert model.default_request_timeout == 300


def _loop_kwargs(name, run_effort=None):
    return loop_model_kwargs(
        name,
        default_effort="high",
        default_thinking_budget=4096,
        run_effort=run_effort,
    )


def test_loop_kwargs_default_to_deployment_settings():
    assert _loop_kwargs("claude-opus-4-8") == {"effort": "high"}
    assert _loop_kwargs("claude-sonnet-4-6") == {"thinking_budget_tokens": 4096}
    assert _loop_kwargs("gpt-5") == {}


def test_run_effort_maps_to_each_provider_knob():
    assert _loop_kwargs("claude-opus-4-8", "max") == {"effort": "max"}
    assert _loop_kwargs("claude-sonnet-4-6", "low") == {"thinking_budget_tokens": 1024}
    assert _loop_kwargs("claude-sonnet-4-6", "max") == {"thinking_budget_tokens": 16384}
    assert _loop_kwargs("gpt-5", "max") == {"reasoning_effort": "high"}
    assert _loop_kwargs("openrouter:openai/o3", "low") == {"reasoning_effort": "low"}
    assert _loop_kwargs("gpt-4o", "high") == {}
    assert _loop_kwargs("deepseek:deepseek-chat", "high") == {}


def test_run_effort_reaches_the_built_models(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    get_settings.cache_clear()
    opus = get_chat_model("claude-opus-4-8", **_loop_kwargs("claude-opus-4-8", "low"))
    assert opus.effort == "low"
    sonnet = get_chat_model("claude-sonnet-4-6", **_loop_kwargs("claude-sonnet-4-6", "medium"))
    assert sonnet.thinking == {"type": "enabled", "budget_tokens": 2048}
    gpt = get_chat_model("gpt-5", **_loop_kwargs("gpt-5", "medium"))
    assert gpt.reasoning_effort == "medium"
    assert get_chat_model("gpt-4o").reasoning_effort is None
