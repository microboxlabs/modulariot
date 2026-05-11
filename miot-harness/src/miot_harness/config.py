from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class HarnessSettings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_prefix="MIOT_HARNESS_",
        extra="ignore",
        case_sensitive=False,
    )

    env: str = "local"
    workspace_dir: Path = Path(".miot-workspace")
    default_tenant_id: str = "demo-tenant"
    default_user_id: str = "demo-user"

    # Nexo data integration (Coordinador / Mintral)
    nexo_db_scripts_root: Path | None = None
    nexo_db_alias: str = "coordinador-dev"
    # Direct DSN override. When set, bypasses the
    # `db_scripts_root + alias` file lookup so containerized deployments
    # can mount a single secret instead of a full db-scripts directory.
    # Precedence: nexo_dsn > db_scripts_root file. If neither is set,
    # Nexo is disabled at boot.
    nexo_dsn: str | None = None
    # Surfaces in Postgres `pg_stat_activity.application_name` so DBAs
    # can attribute connections to the harness without log correlation.
    nexo_application_name: str = "miot-harness"
    nexo_tenant_lock: str = "mintral"
    nexo_search_path: str = "nexo"
    nexo_freshness_warn_minutes: int = 30
    nexo_freshness_refuse_minutes: int = 240
    nexo_max_turns: int = 8
    nexo_critic_enabled: bool = False

    # Operations / observability
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    request_id_header: str = "x-request-id"

    # Multi-agent model assignment (per plan 12 §"Cost-control rules")
    nexo_supervisor_mode: Literal["rule", "llm"] = "rule"
    nexo_filter_expert_model: str = "claude-haiku-4-5"
    nexo_analyst_model: str = "claude-sonnet-4-6"
    nexo_synthesizer_model: str = "claude-sonnet-4-6"
    nexo_critic_model: str = "claude-sonnet-4-6"
    nexo_summarizer_model: str = "claude-haiku-4-5"

    # Provider API keys (unprefixed, standard provider env names)
    anthropic_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("ANTHROPIC_API_KEY", "anthropic_api_key"),
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )


@lru_cache(maxsize=1)
def get_settings() -> HarnessSettings:
    return HarnessSettings()
