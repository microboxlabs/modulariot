# MIOT Harness

Python-first backend scaffold for ASK MIOT agent orchestration.

This project pilots LangChain Deep Agents as a controlled ModularIoT harness:
the model can plan and narrate, while this backend owns typed tools, context,
permission checks, approvals, durable run state, and Storytelling artifacts.

## Why This Is A Root Workspace

`miot-harness/` is intentionally a sibling of `quarkus-srv/`, `ecm-srv/`, and
`turbo-repo/`.

The harness is a new backend runtime rather than a frontend package or Quarkus
module. Keeping it at the root lets it grow into a service that can be consumed
by the Next.js ASK MIOT sidebar, Quarkus APIs, Alfresco workflows, and future
workers without coupling the pilot to one existing workspace too early.

## Initial Shape

```text
src/miot_harness/
  agents/          # supervisor and specialist agent factories
  api/             # HTTP service entrypoints
  runtime/         # routing, tool execution, permissions, runs, events
  skills/          # progressive skill manifests and playbooks
  storytelling/    # MIOT story artifact contracts and renderer helpers
  tools/           # MIOT-native read/write tool implementations
  workspace/       # lightweight local workspace backend
```

## First Vertical Slice

The first pilot target remains:

> Tell me the story of delivery compliance this month and suggest one dashboard
> widget.

The scaffold includes mock MIOT tools for delivery compliance metrics, workflow
bottlenecks, story creation, widget drafting, and approval-gated dashboard patch
application.

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

Run the local demo without requiring a model key:

```bash
uv run miot-harness demo "Tell me the story of delivery compliance this month and suggest one dashboard widget."
```

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
- Story artifacts are strict JSON objects with evidence references.
- Deep Agents integration lives behind an adapter so the MIOT runtime can keep
  its own tool, permission, and audit contracts.

## Run Modes

`POST /runs` accepts an optional `mode` field on the request body
(`Literal["auto", "canned", "meta", "agentic"]`, default `"auto"`).
Mode picks *which dispatch path* the supervisor takes. The four values:

| `mode`     | Route          | DB touch | Non-Mintral?     | LLM calls / run | Best for                                              |
|------------|----------------|----------|------------------|-----------------|-------------------------------------------------------|
| `auto`     | (LLM-decided)  | depends  | depends on route | depends         | default — the intent router picks one of the below.   |
| `canned`   | `NEXO_QUERY`   | ✅ yes   | ❌ refused       | ~4-5            | "what's the data right now?" — curated `fn_dx_*`.     |
| `meta`     | `NEXO_META`    | ❌ no    | ✅ allowed       | 1               | "what data exists / how is X calculated?" — no SQL.   |
| `agentic`  | `NEXO_AGENTIC` | ✅ yes   | ❌ refused       | variable        | free-form exploration via composable primitives.      |

The explicit modes (`canned` / `meta` / `agentic`) bypass the LLM
intent router entirely. They're useful for ops (deterministic
dispatch), evals (pin the route so a test doesn't drift if router
quality changes), and cost-sensitive callers (`meta` is ~10× cheaper
per run than `canned`).

### `canned` — answer FROM the data

Routes through the plan-12 `nexo_graph`: `filter_expert` picks one
curated `fn_dx_*` Postgres function from the registered catalog, the
harness runs that SQL against the tunneled Coordinador DB,
`domain_analyst` inspects freshness, `synthesizer` writes the answer,
`critic` reviews it (when enabled). Refused at the tenant gate for
non-Mintral tenants because it reads confidential data.

Examples that route here:
- *"estado del coordinador hoy"* → `coordinador_centro_control`
- *"cola crítica para hoy"* → `coordinador_cola_critica`
- *"servicios con ETA en riesgo"* → `coordinador_eta_riesgo_hoy`

### `meta` — answer ABOUT the data

Calls `agents/meta_agent.py:meta_agent_node` **directly** — no
LangGraph, one async LLM call (Haiku tier). The system prompt is the
Coordinador primer plus the catalog of `fn_dx_*` descriptions; the
function signature has no `pool` / `registry` / `tools` parameter, so
"no SQL" is a structural guarantee — not a comment. Allowed for any
tenant (meta info is non-confidential); emits a
`tenant.bypass: meta_route` audit attribute when an off-lock tenant
uses it.

Examples that route here:
- *"what data do you have available?"*
- *"how is `es_critico` calculated?"*
- *"what does `fn_dx_kpi_servicio` return?"*

### `agentic` — explore the data with composable primitives

Routes through `runtime/agentic_graph.py`. Instead of being constrained
to one curated `fn_dx_*`, the planner can string together
`nexo_describe` / `nexo_select` / `nexo_grep` / `nexo_explain` calls
within the sqlglot safety gate (positive function allowlist, LATERAL
rejection, mutation rejection, EXPLAIN cost ceiling). Critic is ON
by default in this mode because the agent has more freedom to invent
joins. Same tenant gate as `canned` — refused for non-Mintral. See
`integrations/nexo/primitives.py`.

### Cost separation in Langfuse

Every emitted span carries the `mode:<m>` tag in `langfuse.tags`, so
filtering by `mode:canned` vs `mode:meta` in the UI (or
`uv run python -m miot_harness.observability.report --by mode` from
the CLI) shows the dollar split per mode. Combined with `tenant:<id>`,
this gives per-tenant-per-mode cost rollups suitable for tiered
billing (e.g. unlimited `meta` for a flat fee + per-`canned`-run
metered billing). See `infra/observability/README.md` for the full
filter / CLI / ClickHouse procedures.

