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
    # Standard Postgres connection string, e.g.
    # `postgresql://user:password@host:port/database`. This is the sole
    # source of Nexo DB credentials — when unset, Nexo is disabled at boot
    # and the harness still serves non-Nexo runs with mocked tools.
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
    # Bounded to [0.0, 1.0]: the LLM router emits a probability in that
    # range, so any threshold outside it either disables the LLM router
    # entirely (>1) or disables the keyword fallback (<0). Either way
    # produces silent misrouting, so reject at startup.
    intent_router_confidence_threshold: float = Field(default=0.7, ge=0.0, le=1.0)

    # Composable Nexo primitives (E3). EXPLAIN total cost > this → refuse.
    # PostgreSQL plan-cost units. Default 10000 is roughly "10s of seq scans
    # on a million-row table" — generous enough for analyst exploration,
    # tight enough to refuse an unindexed cross-join. Must be strictly
    # positive; 0 or negative would refuse every query.
    nexo_explain_cost_threshold: float = Field(default=10000.0, gt=0.0)

    # Phase E5 hydration cap. When a `/runs` request carries
    # `conversation_id`, the supervisor reads prior turns from
    # `ConversationStore` and trims them via `trim_messages(...,
    # token_counter="approximate", strategy="last")` to fit this token
    # budget. Sized against Haiku-4-5's 200K window (the smallest model
    # we configure): 24K leaves 88% of the window for system prompt +
    # evidence + tools + current question + response. Fits ~5–7 long
    # Markdown synthesizer answers or ~30+ short turns. Turn-based
    # capping was rejected because our synthesizer's long Markdown
    # outputs (3–5K tokens each) blow a uniform turn count. Must be
    # strictly positive; 0 or negative is meaningless as a budget.
    conversation_token_budget: int = Field(default=24_000, gt=0)

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

    # Synthesizer streaming (plan: SSE rich events). When enabled, the
    # synthesizer's LLM call runs as a streaming `astream_events` loop
    # and emits `thinking.delta` / `thinking.completed` SSE events so
    # CLI clients see Claude's reasoning unfold in real time. Set to
    # False (or `MIOT_HARNESS_NEXO_SYNTHESIZER_STREAM=0` at runtime)
    # to fall back to the legacy `.ainvoke()` path with no thinking
    # visibility — the production kill switch.
    nexo_synthesizer_stream: bool = True
    # Extended-thinking budget for the synthesizer. 0 disables thinking
    # (the model still streams text). 4096 is a moderate default;
    # increase up to ~16K for harder reasoning, but note the latency
    # cost (8–15s extra at Sonnet 4.6 typical speed). Anthropic
    # constraint: max_tokens must exceed budget_tokens — the chat-model
    # factory bumps max_tokens automatically.
    nexo_synthesizer_thinking_budget: int = Field(default=4096, ge=0)

    # Tenants permitted to request `debug=true` runs. Debug runs surface
    # full tool inputs and truncated tool outputs over SSE, which on a
    # coordinador-touching path means real Mintral fleet data. None / empty
    # (default) blocks debug for ALL tenants — debug requests get a 403.
    # Comma-separated env var: `MIOT_HARNESS_ALLOW_DEBUG_TENANTS=mintral-dev,mintral-stg`.
    # Kept as a raw string so pydantic-settings doesn't try to parse it
    # as JSON; `debug_tenant_allowed()` below does the split.
    allow_debug_tenants: str | None = None

    def debug_tenant_allowed(self, tenant_id: str) -> bool:
        """Return True iff `tenant_id` is on the debug allow-list.

        Empty / unset allow-list denies every tenant — secure-by-default.
        Whitespace is trimmed on both sides of the comparison so an
        accidental leading/trailing space in the request body or env
        var doesn't quietly produce a false-negative match.
        """
        tenant_id = tenant_id.strip()
        if not tenant_id:
            return False
        raw = (self.allow_debug_tenants or "").strip()
        if not raw:
            return False
        allowed = {t.strip() for t in raw.split(",") if t.strip()}
        return tenant_id in allowed

    # Provider API keys (unprefixed, standard provider env names)
    anthropic_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("ANTHROPIC_API_KEY", "anthropic_api_key"),
    )
    openai_api_key: str | None = Field(
        default=None,
        validation_alias=AliasChoices("OPENAI_API_KEY", "openai_api_key"),
    )

    # Auth0 / JWT verification (defense-in-depth in front of the
    # Quarkus proxy). Off by default so unit tests and local dev see
    # the legacy unauthenticated surface; production deploys flip
    # `auth_enabled` and supply the issuer/JWKS/audience. Env-var
    # names mirror `quarkus-srv`'s `miot.auth.*` config so a single
    # block in Helm values can render both services.
    auth_enabled: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "MIOT_HARNESS_AUTH_ENABLED", "auth_enabled"
        ),
    )
    auth0_issuer: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AUTH0_ISSUER", "auth0_issuer"),
    )
    auth0_jwks_url: str | None = Field(
        default=None,
        validation_alias=AliasChoices("AUTH0_JWKS_URL", "auth0_jwks_url"),
    )
    auth0_rs256_audience: str | None = Field(
        default=None,
        validation_alias=AliasChoices(
            "AUTH0_RS256_AUDIENCE", "auth0_rs256_audience"
        ),
    )
    # Dev/staging escape hatch: when true, requests without the
    # `X-Miot-Tenant-Client-Id` header (i.e. callers reaching harness
    # directly, bypassing the Quarkus proxy) are accepted and the
    # body's `tenant_id` is honored. `validate_auth_config()` rejects
    # this in production. Removed entirely in rung R6.
    auth_direct_allowed: bool = Field(
        default=False,
        validation_alias=AliasChoices(
            "MIOT_HARNESS_AUTH_DIRECT_ALLOWED", "auth_direct_allowed"
        ),
    )

    def validate_auth_config(self) -> None:
        """Raise ``ValueError`` if the auth settings are internally
        inconsistent. Call once at startup (lifespan).

        Two rules:
        - When ``auth_enabled`` is true, all three of ``auth0_issuer``,
          ``auth0_jwks_url``, and ``auth0_rs256_audience`` must be set.
          Otherwise ``verify_token`` would have nothing to compare
          against and would silently accept any well-formed RS256 token.
        - ``auth_direct_allowed`` is dev-only: rejected when ``env``
          equals ``"production"``. The header is the only way the
          proxy passes the verified tenant; allowing the body to win
          in prod is the exact hole this rung closes.
        """
        if self.auth_enabled:
            missing = [
                name
                for name, value in (
                    ("auth0_issuer", self.auth0_issuer),
                    ("auth0_jwks_url", self.auth0_jwks_url),
                    ("auth0_rs256_audience", self.auth0_rs256_audience),
                )
                if not value
            ]
            if missing:
                raise ValueError(
                    "auth_enabled=True but the following settings are unset: "
                    + ", ".join(missing)
                )
        if self.auth_direct_allowed and self.env == "production":
            raise ValueError(
                "auth_direct_allowed=True is not permitted when env='production'; "
                "the X-Miot-Tenant-Client-Id header from the proxy is the only "
                "trusted tenant source in prod."
            )


@lru_cache(maxsize=1)
def get_settings() -> HarnessSettings:
    return HarnessSettings()
