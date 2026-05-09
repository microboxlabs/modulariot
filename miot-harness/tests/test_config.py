from __future__ import annotations

from pathlib import Path

import pytest
from pydantic import ValidationError

from miot_harness.config import HarnessSettings, get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_default_nexo_settings():
    settings = HarnessSettings()

    assert settings.nexo_db_scripts_root is None
    assert settings.nexo_db_alias == "coordinador-dev"
    assert settings.nexo_tenant_lock == "mintral"
    assert settings.nexo_search_path == "nexo"
    assert settings.nexo_freshness_warn_minutes == 30
    assert settings.nexo_freshness_refuse_minutes == 240
    assert settings.nexo_max_turns == 8
    assert settings.nexo_critic_enabled is False
    assert settings.nexo_supervisor_mode == "rule"
    assert settings.nexo_filter_expert_model == "claude-haiku-4-5"
    assert settings.nexo_analyst_model == "claude-sonnet-4-6"
    assert settings.nexo_synthesizer_model == "claude-sonnet-4-6"
    assert settings.nexo_critic_model == "claude-sonnet-4-6"
    assert settings.nexo_summarizer_model == "claude-haiku-4-5"


def test_nexo_settings_from_env(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT", "/tmp/db-scripts")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_DB_ALIAS", "coordinador-prod-harness")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_TENANT_LOCK", "mintral")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_FRESHNESS_WARN_MINUTES", "15")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_FRESHNESS_REFUSE_MINUTES", "60")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_MAX_TURNS", "12")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_CRITIC_ENABLED", "true")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_FILTER_EXPERT_MODEL", "claude-haiku-4-5")
    monkeypatch.setenv("MIOT_HARNESS_NEXO_ANALYST_MODEL", "gpt-4o")

    settings = HarnessSettings()

    assert settings.nexo_db_scripts_root == Path("/tmp/db-scripts")
    assert settings.nexo_db_alias == "coordinador-prod-harness"
    assert settings.nexo_tenant_lock == "mintral"
    assert settings.nexo_freshness_warn_minutes == 15
    assert settings.nexo_freshness_refuse_minutes == 60
    assert settings.nexo_max_turns == 12
    assert settings.nexo_critic_enabled is True
    assert settings.nexo_filter_expert_model == "claude-haiku-4-5"
    assert settings.nexo_analyst_model == "gpt-4o"


def test_provider_api_keys_read_from_env(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-test")

    settings = HarnessSettings()

    assert settings.anthropic_api_key == "sk-ant-test"
    assert settings.openai_api_key == "sk-openai-test"


def test_supervisor_mode_validates_literal(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_NEXO_SUPERVISOR_MODE", "bogus")
    with pytest.raises(ValidationError):
        HarnessSettings()
