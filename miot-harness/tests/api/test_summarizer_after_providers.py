"""The summarizer's provider can come from the modulith, which loads after
boot. Compaction must pick it up once it arrives."""

from __future__ import annotations

import asyncio
import logging
from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from langchain_core.language_models.fake_chat_models import FakeListChatModel

from miot_harness.agents.chat_models import provider_registry, set_provider_registry
from miot_harness.agents.model_providers import Provider, ProviderRegistry
from miot_harness.api import server
from miot_harness.api.server import create_app
from miot_harness.config import get_settings
from miot_harness.runtime.conversation import ConversationHistory, ConversationTurn

MODEL = "llmgateway:summary-model"


@pytest.fixture(autouse=True)
def _settings(tmp_path: Any, monkeypatch: pytest.MonkeyPatch) -> Iterator[None]:
    monkeypatch.delenv("MIOT_HARNESS_DATASOURCE_DSN", raising=False)
    monkeypatch.setenv("MIOT_HARNESS_WORKSPACE_DIR", str(tmp_path))
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_SUMMARIZER_MODEL", MODEL)
    get_settings.cache_clear()
    set_provider_registry(ProviderRegistry())
    yield
    set_provider_registry(None)
    get_settings.cache_clear()


def test_compaction_uses_a_provider_that_loads_after_boot(
    caplog: pytest.LogCaptureFixture, monkeypatch: pytest.MonkeyPatch
) -> None:
    keys: list[str] = []

    def fake_chat_model(name: str, **_: Any) -> FakeListChatModel:
        provider, _model = provider_registry().resolve(name)
        keys.append(provider.api_key)
        return FakeListChatModel(responses=["the summary"])

    monkeypatch.setattr(server, "get_chat_model", fake_chat_model)
    history = ConversationHistory(
        conversation_id="c1",
        turns=[ConversationTurn(user_message="q1", assistant_answer="a1")],
    )

    app = create_app()
    with caplog.at_level(logging.WARNING), TestClient(app):
        summarizer = app.state.harness.conversation_summarizer
        assert summarizer is not None
        assert "Conversation compaction" not in caplog.text

        with pytest.raises(RuntimeError, match="llmgateway"):
            asyncio.run(summarizer(history))

        set_provider_registry(ProviderRegistry([Provider("llmgateway", "openai_compatible", "k")]))
        assert asyncio.run(summarizer(history)) == "the summary"
    assert keys == ["k"]
