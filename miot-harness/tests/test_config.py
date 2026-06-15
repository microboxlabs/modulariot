from __future__ import annotations

import pytest
from pydantic import ValidationError

from miot_harness.config import HarnessSettings, get_settings


@pytest.fixture(autouse=True)
def _clear_settings_cache():
    get_settings.cache_clear()
    yield
    get_settings.cache_clear()


def test_default_datasource_and_agents_settings():
    settings = HarnessSettings()

    assert settings.datasource_kind == "nexo"
    assert settings.datasource_dsn is None
    assert settings.datasource_application_name == "miot-harness"
    # None → profile default; the provider resolves the effective values.
    assert settings.datasource_tenant_lock is None
    assert settings.datasource_freshness_warn_minutes is None
    assert settings.datasource_freshness_refuse_minutes is None
    assert settings.agents_max_turns == 8
    assert settings.agents_critic_enabled is False
    assert settings.agents_supervisor_mode == "rule"
    assert settings.agents_filter_expert_model == "claude-haiku-4-5"
    assert settings.agents_analyst_model == "claude-sonnet-4-6"
    assert settings.agents_synthesizer_model == "claude-sonnet-4-6"
    assert settings.agents_critic_model == "claude-sonnet-4-6"
    assert settings.agents_summarizer_model == "claude-haiku-4-5"


def test_datasource_and_agents_settings_from_env(monkeypatch):
    monkeypatch.setenv(
        "MIOT_HARNESS_DATASOURCE_DSN", "postgresql://harness:secret@db:6432/citus"
    )
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_TENANT_LOCK", "mintral")
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_FRESHNESS_WARN_MINUTES", "15")
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_FRESHNESS_REFUSE_MINUTES", "60")
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_MAX_TURNS", "12")
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_CRITIC_ENABLED", "true")
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_FILTER_EXPERT_MODEL", "claude-haiku-4-5")
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_ANALYST_MODEL", "gpt-4o")

    settings = HarnessSettings()

    assert settings.datasource_dsn == "postgresql://harness:secret@db:6432/citus"
    assert settings.datasource_tenant_lock == "mintral"
    assert settings.datasource_freshness_warn_minutes == 15
    assert settings.datasource_freshness_refuse_minutes == 60
    assert settings.agents_max_turns == 12
    assert settings.agents_critic_enabled is True
    assert settings.agents_filter_expert_model == "claude-haiku-4-5"
    assert settings.agents_analyst_model == "gpt-4o"


def test_datasource_and_agents_settings_env_names(monkeypatch) -> None:
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_KIND", "nexo")
    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_DSN", "postgresql://u:p@h:5432/db")
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_MAX_TURNS", "5")
    s = HarnessSettings()
    assert s.datasource_kind == "nexo"
    assert s.datasource_dsn == "postgresql://u:p@h:5432/db"
    assert s.agents_max_turns == 5
    assert not hasattr(s, "nexo_dsn")  # clean break — old name is gone


def test_nexo_provider_private_settings(monkeypatch) -> None:
    from miot_harness.integrations.nexo.settings import NexoSettings

    monkeypatch.setenv("MIOT_HARNESS_NEXO_SEARCH_PATH", "custom_schema")
    ns = NexoSettings()
    assert ns.nexo_search_path == "custom_schema"
    assert ns.nexo_explain_cost_threshold == 10000.0


def test_provider_api_keys_read_from_env(monkeypatch):
    monkeypatch.setenv("ANTHROPIC_API_KEY", "sk-ant-test")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-openai-test")

    settings = HarnessSettings()

    assert settings.anthropic_api_key == "sk-ant-test"
    assert settings.openai_api_key == "sk-openai-test"


def test_supervisor_mode_validates_literal(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_AGENTS_SUPERVISOR_MODE", "bogus")
    with pytest.raises(ValidationError):
        HarnessSettings()


def test_otel_settings_have_safe_defaults():
    """Telemetry stays off unless explicitly enabled — `local` env, no exporter."""

    settings = HarnessSettings()

    assert settings.otel_enabled is False
    assert settings.otel_endpoint == "http://localhost:4317"
    assert settings.otel_service_name == "miot-harness"
    assert settings.otel_environment == "local"


def test_otel_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENABLED", "true")
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENDPOINT", "http://collector:4317")
    monkeypatch.setenv("MIOT_HARNESS_OTEL_SERVICE_NAME", "miot-harness-prod")
    monkeypatch.setenv("MIOT_HARNESS_OTEL_ENVIRONMENT", "prod")

    settings = HarnessSettings()

    assert settings.otel_enabled is True
    assert settings.otel_endpoint == "http://collector:4317"
    assert settings.otel_service_name == "miot-harness-prod"
    assert settings.otel_environment == "prod"


def test_langfuse_keys_default_to_none():
    settings = HarnessSettings()
    assert settings.langfuse_public_key is None
    assert settings.langfuse_secret_key is None


def test_langfuse_keys_read_from_env(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_LANGFUSE_PUBLIC_KEY", "pk-lf-test")
    monkeypatch.setenv("MIOT_HARNESS_LANGFUSE_SECRET_KEY", "sk-lf-test")

    settings = HarnessSettings()

    assert settings.langfuse_public_key == "pk-lf-test"
    assert settings.langfuse_secret_key == "sk-lf-test"


def test_langfuse_host_default_points_at_local_stack():
    settings = HarnessSettings()
    assert settings.langfuse_host == "http://localhost:3000"


def test_langfuse_host_read_from_env(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_LANGFUSE_HOST", "https://langfuse.internal.modulariot.dev")
    settings = HarnessSettings()
    assert settings.langfuse_host == "https://langfuse.internal.modulariot.dev"


def test_conversation_token_budget_default_is_24k():
    settings = HarnessSettings()
    assert settings.conversation_token_budget == 24_000


def test_conversation_token_budget_read_from_env(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_CONVERSATION_TOKEN_BUDGET", "8000")
    settings = HarnessSettings()
    assert settings.conversation_token_budget == 8_000


def test_fs_settings_defaults():
    settings = HarnessSettings()
    assert settings.fs_enabled is True
    assert settings.fs_max_file_bytes == 65_536
    assert settings.fs_max_total_bytes == 1_048_576
    assert settings.fs_max_files == 64
    assert settings.fs_max_conversations == 512


def test_fs_settings_read_from_env(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_FS_ENABLED", "false")
    monkeypatch.setenv("MIOT_HARNESS_FS_MAX_FILE_BYTES", "1024")
    monkeypatch.setenv("MIOT_HARNESS_FS_MAX_TOTAL_BYTES", "4096")
    monkeypatch.setenv("MIOT_HARNESS_FS_MAX_FILES", "8")
    monkeypatch.setenv("MIOT_HARNESS_FS_MAX_CONVERSATIONS", "16")
    settings = HarnessSettings()
    assert settings.fs_enabled is False
    assert settings.fs_max_file_bytes == 1024
    assert settings.fs_max_total_bytes == 4096
    assert settings.fs_max_files == 8
    assert settings.fs_max_conversations == 16


def test_fs_caps_reject_non_positive(monkeypatch):
    monkeypatch.setenv("MIOT_HARNESS_FS_MAX_FILES", "0")
    with pytest.raises(ValidationError):
        HarnessSettings()


def test_debug_tenant_allowed_trims_both_sides():
    """Both the allow-list entries AND the input tenant_id are trimmed
    so accidental whitespace on either side doesn't produce a silent
    false-negative match.
    """
    settings = HarnessSettings(allow_debug_tenants=" mintral-dev , mintral-stg ")
    assert settings.debug_tenant_allowed("mintral-dev") is True
    assert settings.debug_tenant_allowed("  mintral-dev  ") is True
    assert settings.debug_tenant_allowed("\tmintral-stg\n") is True
    assert settings.debug_tenant_allowed("unauthorized") is False
    assert settings.debug_tenant_allowed("") is False
    assert settings.debug_tenant_allowed("   ") is False


def test_debug_tenant_allowed_denies_when_unset():
    settings = HarnessSettings(allow_debug_tenants=None)
    assert settings.debug_tenant_allowed("mintral-dev") is False


def test_empty_tenant_lock_rejected_at_boot(monkeypatch: pytest.MonkeyPatch) -> None:
    """An empty MIOT_HARNESS_DATASOURCE_TENANT_LOCK is ambiguous (silently
    fall back to the profile lock vs an unmatchable refuse-everyone lock) —
    reject at boot instead, same pattern as identity_signing_key."""
    from pydantic import ValidationError

    monkeypatch.setenv("MIOT_HARNESS_DATASOURCE_TENANT_LOCK", "")
    with pytest.raises(ValidationError):
        HarnessSettings()
