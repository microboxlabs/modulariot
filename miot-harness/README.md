# MIOT Harness

The backend behind ASK MIOT. One model, chosen per run, talks to the user and
calls tools; the harness owns the tools, context, permission checks, approvals,
conversation memory and run records.

## Why This Is A Root Workspace

`miot-harness/` is intentionally a sibling of `quarkus-srv/`, `ecm-srv/`, and
`turbo-repo/`.

The harness is a new backend runtime rather than a frontend package or Quarkus
module. Keeping it at the root lets it grow into a service that can be consumed
by the Next.js ASK MIOT sidebar, Quarkus APIs, Alfresco workflows, and future
workers without coupling the pilot to one existing workspace too early.

## How a run works

1. The API resolves the tenant, the permission policy and the conversation.
2. The agent loop (`runtime/agent_loop.py`) runs the model the request named
   in `model`, or the default. The model calls tools directly and answers.
3. The turn, with its tool calls and results, is stored; long conversations
   are folded into a summary.

| Part | Where |
|---|---|
| Agent loop, prompt | `runtime/agent_loop.py`, `runtime/agent_prompt.py` |
| Advisor and workhorse seats (`ask_advisor`, `delegate`) | `runtime/agent_seats.py` |
| Datasource tools | `datasource/`, `integrations/` |
| Skills (`load_skill`, `SKILL.md`, MCP skills via `mcp_call`) | `context_skills/` |
| Permissions and approvals | `runtime/permissions.py`, `runtime/approvals.py` |
| Conversation memory and compaction | `runtime/conversation.py` |
| API | `api/server.py` |

`GET /models` lists the models a run may name. A tenant outside the
datasource's tenant lock still talks to the model; the datasource tools
refuse for it.

### Models

| Env var | Default | Purpose |
|---|---|---|
| `MIOT_HARNESS_AGENTS_AGENT_LOOP_MODEL` | `claude-sonnet-4-6` | Default conversation model. |
| `MIOT_HARNESS_AGENTS_AGENT_LOOP_MODELS` | `[]` | Other models a run may name (JSON list). |
| `MIOT_HARNESS_AGENTS_AGENT_LOOP_EFFORT` | `high` | Reasoning effort on adaptive-thinking models. |
| `MIOT_HARNESS_AGENTS_AGENT_LOOP_THINKING_BUDGET` | `4096` | Thinking budget on the other models; `0` turns it off. |
| `MIOT_HARNESS_AGENTS_AGENT_LOOP_MAX_TURNS` | `12` | Model calls per run before it must answer. |
| `MIOT_HARNESS_AGENTS_ADVISOR_MODEL` | `claude-opus-4-8` | `ask_advisor` seat; empty disables it. |
| `MIOT_HARNESS_AGENTS_WORKHORSE_MODEL` | `claude-sonnet-4-6` | `delegate` seat; empty disables it. |
| `MIOT_HARNESS_AGENTS_SUMMARIZER_MODEL` | `claude-haiku-4-5` | Conversation compaction. |

Without a working model every run answers that no model is configured.

## Setup

This project uses [uv](https://docs.astral.sh/uv/) for environment and
dependency management. Install uv (`brew install uv` or see the uv docs), then:

```bash
cd miot-harness
uv sync
cp .env.example .env
```

`uv sync` creates `.venv/`, installs the project plus the `dev` dependency
group, and pins exact versions in `uv.lock`. Commit `uv.lock` so the harness
builds reproducibly across machines and CI.

Run the API:

```bash
uv run uvicorn miot_harness.api.server:create_app --factory --reload
```

Run the test suite:

```bash
uv run pytest
```

Add a runtime dependency with `uv add <pkg>` (e.g. `uv add tavily-python` if
you wire up a Tavily-backed search tool, per the LangChain Deep Agents
quickstart). Add a dev-only dependency with `uv add --dev <pkg>`.

## Authentication

The harness sits behind a Quarkus proxy (`quarkus-srv`) which is the
production front door for all `/runs*` traffic. Quarkus terminates the
user-facing Auth0 token (RS256 for web users, HS256 for M2M), runs the
existing `OrganizationRequestFilter` (Alfresco group membership + parent
→ child org fan-out), and forwards to the harness with the resolved
tenant in a header. The harness re-verifies the same Auth0 RS256 token
as **defense in depth** — anyone reaching the harness port without
going through the proxy is rejected.

Auth is **off by default** so unit tests and local dev see the legacy
unauthenticated surface. Flip it on in prod by setting
`MIOT_HARNESS_AUTH_ENABLED=true` and the three Auth0 settings:

| Env var                   | Required when            | Purpose                                       |
|---------------------------|--------------------------|-----------------------------------------------|
| `MIOT_HARNESS_AUTH_ENABLED` | always (default `false`) | Gate `/runs*` on a valid Bearer token         |
| `AUTH0_ISSUER`            | `AUTH_ENABLED=true`      | `iss` claim must equal this exact string      |
| `AUTH0_JWKS_URL`          | `AUTH_ENABLED=true`      | RS256 public-key set (Auth0 well-known URL)   |
| `AUTH0_RS256_AUDIENCE`    | `AUTH_ENABLED=true`      | `aud` claim must contain this exact string    |

Env-var names mirror `quarkus-srv`'s `miot.auth.*` config so a single
Helm-values block can render both services. Lifespan boot fails fast on
incomplete config (`validate_auth_config`), so a missing issuer is a
crash at startup, not a silent accept-anything.

`/health` and `/health/ready` are **always** unauthenticated (kubelet
probes don't auth). Only `POST /runs`, `POST /runs:start`,
`GET /runs/{id}`, and `GET /runs/{id}/stream` are gated.

## Design Defaults

- Read-only tools can execute without approval.
- Mutating tools return approval requests and should only apply after a user
  decision.
- Tenant and user context must come from authenticated server context, not from
  model-provided text.

## Datasource

The harness core is datasource-agnostic. A `DataSourceProvider` owns the
connection lifecycle and registers tools, and a declarative
`DataSourceProfile` supplies every domain-specific name and threshold
the core reads (display name, tool prefix, primer, tenant lock, freshness
SLA). The core never hardcodes which
system the tools come from — see `src/miot_harness/datasource/`.

`MIOT_HARNESS_DATASOURCE_KIND` selects the provider at boot from the
named registry (`datasource/registry.py`). The first (and default)
provider is **nexo** (Citus/Postgres, Coordinador schema), which lives
entirely under `src/miot_harness/integrations/nexo/` — the only package
allowed to say "Nexo", "Coordinador", or "orion".

| Env var                              | Default        | Purpose                                                             |
|--------------------------------------|----------------|--------------------------------------------------------------------|
| `MIOT_HARNESS_DATASOURCE_KIND`       | `nexo`         | Registry key selecting the `DataSourceProvider`.                   |
| `MIOT_HARNESS_DATASOURCE_DSN`        | _(unset)_      | Datasource connection string; unset → datasource disabled at boot. |
| `MIOT_HARNESS_DATASOURCE_APPLICATION_NAME` | `miot-harness` | Surfaces in `pg_stat_activity.application_name`.             |
| `MIOT_HARNESS_DATASOURCE_TENANT_LOCK`| _(profile)_    | Override the profile's tenant lock; unset → profile default.       |
| `MIOT_HARNESS_DATASOURCE_FRESHNESS_WARN_MINUTES`   | _(profile)_ | Override snapshot-age warn threshold.                        |
| `MIOT_HARNESS_DATASOURCE_FRESHNESS_REFUSE_MINUTES` | _(profile)_ | Override snapshot-age refuse threshold.                     |

Provider-private knobs keep the `MIOT_HARNESS_NEXO_*` prefix because they
are genuinely Nexo's (Postgres concepts) — currently
`MIOT_HARNESS_NEXO_SEARCH_PATH` (schema) and the EXPLAIN cost ceiling.

## Cost in Langfuse

Every span carries `tenant:<id>` and, when the run named one, `model:<name>`
in `langfuse.tags`. `uv run python -m miot_harness.observability.report --by
tenant` rolls cost up per tenant; see `infra/observability/README.md`.
