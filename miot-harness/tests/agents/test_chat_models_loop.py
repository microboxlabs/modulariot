from __future__ import annotations

import pytest

from miot_harness.agents.chat_models import get_chat_model
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
