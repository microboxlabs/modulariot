# Harness datasource refactor — design

**Branch**: `based/harness-nexo-refactor`
**Date**: 2026-06-05
**Status**: approved (brainstorming with odtorres)

## Problem

The harness hardcodes the names of one specific deployment everywhere:

- **Nexo** (a Citus/Postgres DB): 330 occurrences across 32 Python files,
  16 `MIOT_HARNESS_NEXO_*` env vars, `runtime/nexo_graph.py`, the `/health`
  response, OTel span names.
- **Coordinador** (the product/schema): the `coordinador_*` tool prefix,
  `COORDINADOR_PRIMER`, and agent system prompts.
- **mintral** (a customer tenant): the tenant-lock default, refusal copy,
  router keywords, test fixtures.

The harness is meant to be environment-independent: the datasource could be
a DB, a filesystem, a cloud API — and in the future a skill/plugin or an MCP
server. Core code must not name any specific connection system.

## Decisions (from brainstorming)

1. **Depth**: abstraction + rename. A real provider interface; Nexo becomes
   the first implementation. Not a full plugin system yet.
2. **Scope**: all of it — Coordinador and mintral move behind the seam too.
3. **Compatibility**: clean break on env vars and the `/health` payload.
   docker-compose, `.env.example`, deploy scripts, and docs update in the
   same PR. No aliases.
4. **Generic term**: `datasource` (`DataSourceProvider`,
   `MIOT_HARNESS_DATASOURCE_*`, `/health` `"datasource"` block).
5. **Loading**: named in-repo registry selected by
   `MIOT_HARNESS_DATASOURCE_KIND=nexo`. The registry is the future
   plugin/MCP hook; no entry-point machinery yet.
6. **Delivery**: one PR with staged commits, each leaving the suite green.

## Architecture

```text
src/miot_harness/
├── datasource/
│   ├── provider.py      # DataSourceProvider ABC + DataSourceProfile + BootResult
│   └── registry.py      # {"nexo": NexoProvider}; resolve(kind) -> provider
├── integrations/
│   └── nexo/            # the ONLY place that says Postgres/Coordinador/Mintral
│       ├── provider.py  # NexoProvider(boot, close, profile=NEXO_PROFILE)
│       ├── settings.py  # NexoSettings (provider-private env vars)
│       └── pool.py / introspect.py / tool_factory.py / primer.py / primitives.py
│                        # unchanged logic, now private to the package
└── runtime/, agents/, api/, observability/
                         # generic terms only; read DataSourceProfile
```

Boot flow: `server.py` lifespan → `registry.resolve(settings.datasource_kind)`
→ `provider.boot(tool_registry, settings)` → core builds the data graph with
`provider.profile` plumbed down. Core never imports `integrations.nexo`.

## The interface

```python
class DataSourceProvider(ABC):
    profile: DataSourceProfile
    async def boot(self, registry: ToolRegistry, settings: HarnessSettings) -> BootResult: ...
    async def close(self) -> None: ...

@dataclass(frozen=True)
class DataSourceProfile:
    name: str                       # "nexo" — /health, graph label, span prefix
    display_name: str               # "Coordinador" — agent prompt templating
    source_label: str               # "Coordinador · nexo (Citus DB)" — SSE/evidence source
    tool_prefix: str                # "coordinador_" — filter_expert tool filtering
    primer: str                     # COORDINADOR_PRIMER — agent grounding text
    router_keywords: frozenset[str] # keyword-router literals
    tenant_lock: str | None         # "mintral" — default; env-overridable
    tenant_refusal_template: str    # exact current refusal copy, templated
    freshness_warn_minutes: int     # 30 — default; env-overridable
    freshness_refuse_minutes: int   # 240 — default; env-overridable
```

`BootResult` = today's `NexoBootResult` renamed (`enabled`, `registered`,
`reason`, `snapshot_age_minutes`).

Every profile field maps 1:1 to a hardcode found in the coupling audit;
nothing speculative. **Runtime output stays byte-identical** for: tool names
(`coordinador_*`), SSE `source` strings, refusal copy, OTel span names
(`nexo.*` via `span_prefix=profile.name`), node-lifecycle `graph` label
(`"nexo"`). What changes is who supplies the words.

## Settings (clean break)

| Group | New | Old |
|---|---|---|
| Core datasource | `datasource_kind` (new, default `"nexo"`) | — |
| | `datasource_dsn` | `nexo_dsn` |
| | `datasource_application_name` | `nexo_application_name` |
| | `datasource_tenant_lock` (overrides profile) | `nexo_tenant_lock` |
| | `datasource_freshness_warn_minutes` / `_refuse_minutes` (override profile) | `nexo_freshness_*` |
| Agent/graph | `agents_filter_expert_model`, `agents_analyst_model`, `agents_synthesizer_model`, `agents_critic_model`, `agents_summarizer_model`, `agents_supervisor_mode`, `agents_max_turns`, `agents_critic_enabled`, `agents_synthesizer_stream`, `agents_synthesizer_thinking_budget` | `nexo_*` equivalents |
| Provider-private (`integrations/nexo/settings.py`) | `MIOT_HARNESS_NEXO_SEARCH_PATH`, `MIOT_HARNESS_NEXO_EXPLAIN_COST_THRESHOLD` | unchanged — Postgres concepts, honestly Nexo's |

Tenant lock and freshness windows become profile defaults overridable by
env, so removing the env var does not change behavior.

## Renames

Core code (no behavior change):

| Old | New |
|---|---|
| `runtime/nexo_graph.py` / `build_nexo_graph` | `runtime/data_graph.py` / `build_data_graph` |
| `NexoState` / `NexoPlan` / `NexoStep` / `NexoEvidence` | `DataState` / `DataPlan` / `DataStep` / `DataEvidence` |
| `HarnessRoute.NEXO_QUERY / NEXO_META / NEXO_AGENTIC` | `DATA_QUERY / DATA_META / DATA_AGENTIC` |
| `supervisor._run_nexo*` / `supervisor.nexo_graph` | `_run_data*` / `data_graph` |
| `NexoTelemetryCallback` | `AgentTelemetryCallback(span_prefix=profile.name)` |
| `load_nexo_tools` / `create_nexo_pool` / `NexoBootResult` | private to provider / `BootResult` |

Wire contract (visible, clean break):

| Surface | Old | New |
|---|---|---|
| `route.selected` data | `"nexo_query"` / `"nexo_meta"` / `"nexo_agentic"` | `"data_query"` / `"data_meta"` / `"data_agentic"` |
| Artifact type | `"nexo_plan"` | `"data_plan"` |
| `/health`, `/health/ready` | `"nexo": {...}` | `"datasource": {"name": "nexo", "enabled": ..., "tools": ..., "snapshot_age_minutes": ...}` |
| Node-lifecycle `graph` label | `"nexo"` | unchanged (it is `profile.name`) |
| OTel spans, tool names, `source` strings, refusal copy | | unchanged (profile-supplied) |

Cross-package: `turbo-repo/packages/miot-harness-client/src/types.ts` route
strings and `miot-chat` test fixtures update in the same PR
(`graph: "nexo"` stays valid). Client docs/changelog sync via the
doc-sync-package flow before any release tag.

## Evals and tests

- `evals/golden/nexo/examples.yaml` stays — it is the nexo provider's golden
  dataset. Convention: `evals/golden/<datasource-kind>/`.
- `run_golden.py` de-hardcoded: fake registry builds stubs from each entry's
  `expected_tools` verbatim; stub `source` and refusal-detection substrings
  come from the imported provider profile; real mode boots via the registry.
- Tests: nexo-specific fixtures move under `tests/integrations/nexo/`;
  core runtime/agent tests use a `FakeProvider` with a synthetic profile —
  the de-facto second provider that proves the seam.
  `test_supervisor_nexo_branch.py` → `test_supervisor_data_branch.py`.
- Gates per commit: full pytest, `ruff check`, `mypy`, fake-mode evals
  25/25, and the grep gate:
  `grep -ri "nexo\|coordinador\|mintral" src/ --exclude-dir=integrations`
  must return zero matches at the final commit.

## Error handling

- Unknown `MIOT_HARNESS_DATASOURCE_KIND` → boot fails fast listing available
  kinds (same pattern as `validate_auth_config`).
- No DSN / boot failure → `BootResult(enabled=False, reason=...)`; harness
  serves non-data routes exactly as today; disabled-copy comes from the
  profile so user-visible text is unchanged.
- Env overrides unset → profile defaults apply (mintral lock, 30/240
  freshness windows): zero behavior change for existing deploys that only
  set `MIOT_HARNESS_NEXO_DSN` → they must rename it to
  `MIOT_HARNESS_DATASOURCE_DSN` (the one mandatory ops change).

## Delivery — one PR, staged commits

1. **Seam**: `datasource/` package + `NexoProvider` wrapping existing
   modules + `FakeProvider` fixture. Nothing else moves; suite green.
2. **Core consumes profile**: agents/router/tenancy/graph/observability
   read the profile; prompts templated by `display_name`/`primer`.
3. **Renames**: modules, types, routes, supervisor methods, wire strings;
   client TS types + chat test fixtures.
4. **Settings break**: config regroup; compose/.env/deploy scripts/docs.
5. **Evals**: run_golden de-hardcoding; README/docs sweep; final grep gate.

## Out of scope

- Entry-point / pip-installable plugin discovery (future; the registry is
  the hook).
- MCP-backed provider implementation (future; `boot()` is where it plugs).
- Renaming the golden dataset content or re-validating real-mode baselines.
- Any change to agent pipeline behavior, prompt semantics, or scoring.
