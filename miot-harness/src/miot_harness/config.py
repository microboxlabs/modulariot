from __future__ import annotations

import logging
import os
from functools import lru_cache
from pathlib import Path
from typing import Literal

from dotenv import dotenv_values
from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict

logger = logging.getLogger(__name__)


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

    # Datasource connection / domain overrides (provider-agnostic).
    # Selects the DataSourceProvider from datasource/registry.py.
    datasource_kind: str = "nexo"
    # Standard Postgres connection string, e.g.
    # `postgresql://user:password@host:port/database`. This is the sole
    # source of the datasource's DB credentials — when unset, the datasource
    # is disabled at boot and the harness still serves non-data runs with
    # mocked tools.
    datasource_dsn: str | None = None
    # Surfaces in Postgres `pg_stat_activity.application_name` so DBAs
    # can attribute connections to the harness without log correlation.
    datasource_application_name: str = "miot-harness"
    # None → profile default (the provider's DataSourceProfile.tenant_lock).
    # `min_length=1` rejects the empty string at boot (same rationale as
    # `identity_signing_key`): "" is ambiguous — truthiness resolution
    # would silently fall back to the profile lock, while a strict
    # is-not-None reading would make it an unmatchable lock refusing
    # every tenant. Refusing to start beats either silent behavior.
    datasource_tenant_lock: str | None = Field(default=None, min_length=1)
    # None → profile default. An explicit 0 is honored ("anything older
    # than now is stale"); negatives are rejected at boot.
    datasource_freshness_warn_minutes: int | None = Field(default=None, ge=0)
    # None → profile default.
    datasource_freshness_refuse_minutes: int | None = Field(default=None, ge=0)
    # Boot-time per-function freshness survey (Gap 2): probes every
    # zero-required-arg datasource function once and exposes the result
    # in /health and the meta-agent catalog. Kill switch if boot latency
    # against the real DB becomes a problem.
    datasource_freshness_survey_enabled: bool = True
    agents_max_turns: int = 8
    # Agentic-mode turn cap. Looser than the canned cap (8) because
    # exploration is the whole point of the agentic loop; each turn is
    # one planner LLM call + at most one tool invocation.
    agents_agentic_max_turns: int = Field(default=12, gt=0)
    agents_critic_enabled: bool = False

    # Phase 3 verify gate. When enabled, the agentic planner's decision to
    # finish is intercepted by a verifier node (rule-based + a small LLM judge)
    # that asks "do the EXECUTED results fulfil the request?"; on a gap it
    # routes back to the planner to re-plan (bounded by max_replans). This makes
    # completion structural — the planner can no longer satisfice (answer from a
    # grep sample, or stop before running the join it already identified). When
    # `agents_verifier_model` is unset, the gate degrades to rule-based checks
    # only (no extra LLM call). Tests build the graph without a verifier model,
    # so they exercise the rules-only path.
    agents_agentic_verify_enabled: bool = True
    agents_agentic_max_replans: int = Field(default=2, ge=0)
    # Small "did we answer it?" judge. Held separate from the synthesizer so it
    # can stay cheap. Empty string disables the LLM judge (rules-only verify).
    agents_verifier_model: str = "claude-haiku-4-5"

    # Provenance log for agentic tool invocations (plan 13, E4). One JSONL
    # line per executed step under `<dir>/YYYY-MM-DD.jsonl`; the weekly
    # curation pass mines these for curated-function candidates.
    provenance_log_dir: Path = Path("evals/provenance")
    provenance_log_enabled: bool = True

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

    # Context & Skills subsystem (Phase 1: file-backed). Default dirs are
    # packaged in the image so it boots with zero mounted config; a K8s
    # ConfigMap/volume overrides them. The loader handles a missing dir
    # gracefully (diagnostic, not a crash), so no existence check here —
    # `get_settings()` stays side-effect-free.
    context_dir: Path = Path(__file__).parent / "context_skills" / "defaults" / "context"
    skills_dir: Path = Path(__file__).parent / "context_skills" / "defaults" / "skills"
    # Source-kind seam for the future API/DB-backed source (Phase 2).
    context_source_kind: str = "file"
    skills_source_kind: str = "file"
    # Connections subsystem (datasource connections authored as content,
    # like skills/context). The packaged default dir ships NO connection
    # definitions — no client/tenant config is baked into the image. Operators
    # supply connections via a K8s volume (MIOT_HARNESS_CONNECTIONS_DIR). When
    # the dir has no connection files (the default, or an empty operator dir),
    # the loader falls back to synthesizing one connection from the legacy
    # MIOT_HARNESS_DATASOURCE_* env, so existing deployments keep working.
    # See connections/loader.py and connections/defaults/README.md.
    connections_dir: Path = Path(__file__).parent / "connections" / "defaults"
    connections_source_kind: str = "file"
    # Master switch for the Tier-B generic safe-query surface (Phase 1). When
    # False (default), `backend: pg` connections load but register NO query
    # tools — the generic SELECT capability ships inert. A connection must ALSO
    # declare `capabilities.generic_query: true` to light up. Off everywhere
    # today; only the dev/local `acs` connection opts in.
    generic_query_enabled: bool = False
    # Connection Knowledge Base (Phase 2): boot-time schema index for generic
    # `pg` connections (table list + types + row estimates, folded into the
    # agent grounding). Kill switch (mirrors the freshness survey); only affects
    # connections that are already generic-query-enabled. `max_tables` bounds the
    # always-on index so a large schema can't bloat every prompt (explicit
    # truncation note, never silent).
    generic_schema_introspect_enabled: bool = True
    generic_schema_max_tables: int = Field(default=80, ge=0)
    # Curated knowledge packs (Phase 2 slice 2): product-specific semantics
    # attached to a generic connection when its schema matches a pack
    # fingerprint (e.g. Alfresco/Activiti). Packs are content, shipped in the
    # image; a K8s volume can add more via MIOT_HARNESS_KNOWLEDGE_PACKS_DIR.
    # Gated on generic query being enabled, so inert by default.
    generic_knowledge_packs_enabled: bool = True
    knowledge_packs_dir: Path = (
        Path(__file__).parent / "datasource" / "knowledge" / "packs"
    )
    # Hard cap on connector tools registered from skill files — bounds the
    # blast radius of a misconfigured/oversized ConfigMap.
    max_connector_tools: int = Field(default=50, ge=0)
    # When True, an ERROR-level context/skills diagnostic fails readiness
    # (/health/ready 503) instead of only logging. Default False = log and
    # continue, matching the datasource boot contract. Prod sets True.
    context_skills_strict: bool = False

    # Virtual filesystem scratchpad. An in-memory, per-conversation file
    # store that lets agents offload notes/plans/intermediate findings out
    # of the LLM context window across a multi-turn run (see
    # tools/filesystem.py). On by default; flip `fs_enabled=False` to drop
    # the four `fs_*` tools from the registry. The per-conversation caps
    # bound a single scratchpad's memory footprint (exceeding any returns a
    # typed `ok=False` tool result, no partial write); `fs_max_conversations`
    # is a global LRU bound on how many scratchpads stay in memory so the
    # store can't grow without limit as new conversation/thread ids arrive.
    fs_enabled: bool = True
    fs_max_file_bytes: int = Field(default=65_536, gt=0)
    fs_max_total_bytes: int = Field(default=1_048_576, gt=0)
    fs_max_files: int = Field(default=64, gt=0)
    fs_max_conversations: int = Field(default=512, gt=0)

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
    agents_supervisor_mode: Literal["rule", "llm"] = "rule"
    agents_filter_expert_model: str = "claude-haiku-4-5"
    agents_analyst_model: str = "claude-sonnet-4-6"
    agents_synthesizer_model: str = "claude-sonnet-4-6"
    agents_critic_model: str = "claude-sonnet-4-6"
    agents_summarizer_model: str = "claude-haiku-4-5"

    # Agentic plan-mode planner seat (Phase 3). Held separate from the canned
    # analyst so the cheap canned path can stay on Sonnet while the agentic
    # planner runs on a stronger tier. Opus 4.8 removed the Sonnet-4.6
    # hallucination we saw side-by-side with Claude Code ("53 servicios" from a
    # fuzzy grep, never running the real query). `effort` is the Opus 4.7+
    # `output_config.effort` knob ("high" == the model's default/no-op;
    # "xhigh"/"max" deepen reasoning at a latency+cost premium). None disables
    # the effort/adaptive-thinking path entirely (plain Opus call).
    agents_planner_model: str = "claude-opus-4-8"
    agents_planner_effort: Literal["low", "medium", "high", "xhigh", "max"] | None = "high"

    # Synthesizer streaming (plan: SSE rich events). When enabled, the
    # synthesizer's LLM call runs as a streaming `astream_events` loop
    # and emits `thinking.delta` / `thinking.completed` SSE events so
    # CLI clients see Claude's reasoning unfold in real time. Set to
    # False (or `MIOT_HARNESS_AGENTS_SYNTHESIZER_STREAM=0` at runtime)
    # to fall back to the legacy `.ainvoke()` path with no thinking
    # visibility — the production kill switch.
    agents_synthesizer_stream: bool = True
    # Extended-thinking budget for the synthesizer. 0 disables thinking
    # (the model still streams text). 4096 is a moderate default;
    # increase up to ~16K for harder reasoning, but note the latency
    # cost (8–15s extra at Sonnet 4.6 typical speed). Anthropic
    # constraint: max_tokens must exceed budget_tokens — the chat-model
    # factory bumps max_tokens automatically.
    agents_synthesizer_thinking_budget: int = Field(default=4096, ge=0)

    # Tenants permitted to request `debug=true` runs. Debug runs surface
    # full tool inputs and truncated tool outputs over SSE, which on a
    # data-touching path means real tenant data. None / empty
    # (default) blocks debug for ALL tenants — debug requests get a 403.
    # Comma-separated env var: `MIOT_HARNESS_ALLOW_DEBUG_TENANTS=acme-dev,acme-stg`.
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

    # Steering: which deployments may use permission_mode="bypass".
    # - dev_only (default): only when env != "prod"; otherwise downgraded.
    # - audited: any tenant, every auto-approval emits an audit event.
    # - per_tenant: only tenants listed in steering_bypass_tenants.
    steering_bypass_policy: Literal["dev_only", "audited", "per_tenant"] = (
        "dev_only"
    )
    # Comma-separated tenant allowlist for steering_bypass_policy="per_tenant".
    # e.g. MIOT_HARNESS_STEERING_BYPASS_TENANTS=acme,globex
    steering_bypass_tenants: str | None = None

    def bypass_tenant_allowed(self, tenant_id: str) -> bool:
        """True when `tenant_id` appears in the comma-separated
        steering_bypass_tenants allowlist (whitespace-trimmed)."""
        if not self.steering_bypass_tenants:
            return False
        allowed = {
            t.strip() for t in self.steering_bypass_tenants.split(",") if t.strip()
        }
        return tenant_id in allowed

    # Plan 07 gap 8: signed identity header. When `identity_signing_key`
    # is set, requests must carry a valid `X-MIOT-Identity` header
    # (HMAC-SHA256 of `{tenant_id, user_id, exp}`) and tenant_id/user_id
    # from the request body are ignored — the verified values from the
    # header win. When unset (the default for local dev / evals), the
    # body values are accepted and requests pass through without a
    # header. Production must set this.
    #
    # `min_length=1` rejects the empty string at boot. The middleware
    # otherwise treats "" as "set" (it's not None) and would enable
    # signed mode with a trivially-guessable HMAC key — a far worse
    # failure mode than refusing to start.
    identity_signing_key: str | None = Field(default=None, min_length=1)
    # Skew tolerance for `exp` claims, in seconds. Tighter is better;
    # 60s accounts for routine clock drift in a docker-compose stack.
    identity_skew_seconds: int = Field(default=60, ge=0)

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
    def validate_auth_config(self) -> None:
        """Raise ``ValueError`` if the auth settings are internally
        inconsistent. Call once at startup (lifespan).

        When ``auth_enabled`` is true, all three of ``auth0_issuer``,
        ``auth0_jwks_url``, and ``auth0_rs256_audience`` must be set.
        Otherwise ``verify_token`` would have nothing to compare
        against and would silently accept any well-formed RS256 token.
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


@lru_cache(maxsize=1)
def get_settings() -> HarnessSettings:
    return HarnessSettings()


def load_dotenv_into_environ(settings: HarnessSettings) -> list[str]:
    """Populate ``os.environ`` from the settings' ``.env`` file (local only).

    File-based connections resolve their ``dsn_env`` from the *process*
    environment (``os.environ``), exactly as k8s injects each DSN as a real env
    var. Locally those DSNs live in ``.env``, which pydantic reads for its own
    fields but never exports — so without this, file connections boot disabled
    ("no DSN unset"). This bridges that gap by copying ``.env`` keys into
    ``os.environ``.

    Contract: real environment variables ALWAYS win (never overridden), so prod
    behaviour is unchanged. No-op in ``production`` or when no ``.env`` exists
    (the prod case). Returns the names newly set, for logging.
    """
    if settings.env == "production":
        return []
    env_file = settings.model_config.get("env_file") or ".env"
    path = Path(str(env_file))
    if not path.is_file():
        return []
    newly: list[str] = []
    for key, value in dotenv_values(path).items():
        if value is not None and key not in os.environ:
            os.environ[key] = value
            newly.append(key)
    return newly
