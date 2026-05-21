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

    # Phase E (plan 13): LLM intent router. Default model is Haiku tier
    # for cost — the router is invoked on every "auto" request. Below
    # the confidence threshold we fall back to the keyword router so
    # we never silently misroute when the LLM is uncertain.
    intent_router_model: str = "claude-haiku-4-5"
    intent_router_confidence_threshold: float = 0.7

    # Composable Nexo primitives (E3). EXPLAIN total cost > this → refuse.
    # PostgreSQL plan-cost units. Default 10000 is roughly "10s of seq scans
    # on a million-row table" — generous enough for analyst exploration,
    # tight enough to refuse an unindexed cross-join.
    nexo_explain_cost_threshold: float = 10000.0

    # Phase E5 hydration cap. When a `/runs` request carries
    # `conversation_id`, the supervisor reads prior turns from
    # `ConversationStore` and trims them via `trim_messages(...,
    # token_counter="approximate", strategy="last")` to fit this token
    # budget. Sized against Haiku-4-5's 200K window (the smallest model
    # we configure): 24K leaves 88% of the window for system prompt +
    # evidence + tools + current question + response. Fits ~5–7 long
    # Markdown synthesizer answers or ~30+ short turns. Turn-based
    # capping was rejected because our synthesizer's long Markdown
    # outputs (3–5K tokens each) blow a uniform turn count.
    conversation_token_budget: int = 24_000

    # Operations / observability
    log_level: Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"] = "INFO"
    request_id_header: str = "x-request-id"

    # OTel + Traceloop / Langfuse (Phase A telemetry foundation)
    otel_enabled: bool = False
    otel_endpoint: str = "http://localhost:4317"
    otel_service_name: str = "miot-harness"
    otel_environment: str = "local"
    langfuse_public_key: str | None = None
    langfuse_secret_key: str | None = None
    # Where the cost-report CLI fetches traces from (also used by future
    # ops tooling). Default points at the local docker-compose stack; in
    # prod this becomes the deployed Langfuse URL.
    langfuse_host: str = "http://localhost:3000"

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
