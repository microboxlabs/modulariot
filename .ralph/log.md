# Plan 13 Iteration Log

Append-only. One entry per iteration. Format:

```
## Iteration N — YYYY-MM-DD HH:MM
- Task: <task ID + short>
- Status: [completed|blocked|partial]
- Commit: <SHA or "n/a">
- Notes: <one-line summary; tests run; surprises>
```

---

## Iteration 1 — 2026-05-12

- Task: A1 Add OTel + Traceloop deps to pyproject.toml
- Status: completed
- Commit: 8107571d
- Notes: Added `opentelemetry-{api,sdk,exporter-otlp}`, `opentelemetry-instrumentation-fastapi`, `traceloop-sdk` (dev: `pytest-opentelemetry`). `uv sync` clean: 163 packages resolved, 0 conflicts. Wrote `tests/observability/test_deps.py` (7 import smoke tests). Full suite: 158 passed, 1 skipped, 0 failed.

## Iteration 2 — 2026-05-12

- Task: A2 observability package scaffold (otel/pricing/spans/callbacks)
- Status: completed
- Commit: bfdac6a1
- Notes: New `miot_harness.observability` package with `pricing.py` (versioned `ModelPricing` table for Opus 4.7 / Sonnet 4.6 / Haiku 4.5 / gpt-4o-mini, Anthropic-bucket `TokenUsage`, `compute_cost` quantized to 6 decimals, `UnknownModelError`), `otel.py` (`configure_tracing` returns None when disabled, else builds `TracerProvider` w/ Resource carrying `service.name`/`service.namespace=modular`/`deployment.environment` + `BatchSpanProcessor(OTLPSpanExporter)`; `shutdown_tracing` is None-safe), `spans.py` (`agent_span(name, run_id, tenant_id?, mode?)` ctxmgr setting `gen_ai.operation.name`/`modular.*` attrs and nesting under parent context), `callbacks.py` (`NexoTelemetryCallback` tracking per-run-id span handles, mapping LangChain `usage_metadata` total-input back into Anthropic buckets, emitting `gen_ai.{system,request.model,usage.input/output/cache_read/cache_creation/cost_usd}` + `modular.{agent,run_id,tenant_id,mode}` and `Status(ERROR)` on `on_llm_error`). Tests: 17 new (`test_pricing.py`, `test_spans.py`, `test_otel.py`, `test_callbacks.py`) attaching an `InMemorySpanExporter` to pytest-opentelemetry's pre-installed provider, filtered to `nexo.*` spans. Full suite: 175 passed, 1 skipped, 0 failed.

## Iteration 3 — 2026-05-12

- Task: A3 wire telemetry callbacks into Nexo graph nodes + supervisor root span
- Status: completed
- Commit: 2e5fa252
- Notes: Added `_instrument(model, agent_name, ctx)` helper in `runtime/nexo_graph.py` that returns `model.with_config(callbacks=[NexoTelemetryCallback(...)])`. Wired through every LLM-bearing node wrapper (filter_expert, domain_analyst, synthesizer, critic, summarizer) using `ctx.run_id`/`ctx.tenant_id` from `HarnessContext`. In `runtime/supervisor.py`, wrapped `nexo_graph.ainvoke(...)` in `agent_span("run", run_id, tenant_id)` so a `nexo.run` root span lives over the graph invocation. Tests: 2 new (`tests/observability/test_graph_wiring.py`) — per-agent spans carry the expected `modular.{agent,run_id,tenant_id}` and the root `nexo.run` span carries `gen_ai.operation.name`. Full suite: 177 passed, 1 skipped, 0 failed.

## Iteration 4 — 2026-05-12

- Task: A5 add OTel + Langfuse settings to HarnessSettings
- Status: completed
- Commit: 64ab72ae
- Notes: A5 done out of document order — A4 (Traceloop init in lifespan) consumes these, so settings come first. Added `otel_enabled: bool = False`, `otel_endpoint = "http://localhost:4317"`, `otel_service_name = "miot-harness"`, `otel_environment = "local"`, `langfuse_public_key: str | None = None`, `langfuse_secret_key: str | None = None` under existing `env_prefix="MIOT_HARNESS_"`. Telemetry stays off by default — the FastAPI lifespan no-ops when `otel_enabled=False`. Tests: 4 new in `test_config.py` for defaults + env overrides. Full suite: 181 passed, 1 skipped, 0 failed.

## Iteration 5 — 2026-05-12

- Task: A4 wire Traceloop.init + configure_tracing into FastAPI lifespan
- Status: completed
- Commit: 3c6c92bb
- Notes: In `api/server.py` lifespan, call `configure_tracing(enabled=settings.otel_enabled, ...)` BEFORE the Nexo boot path. When it returns a provider (otel_enabled=true), follow with `Traceloop.init(app_name=service_name, api_endpoint=endpoint, disable_batch=False, telemetry_enabled=False)` so Anthropic/OpenAI SDK calls auto-emit `gen_ai.*` child spans against the same global TracerProvider the per-agent `NexoTelemetryCallback` uses. `app.state.tracer_provider` holds the provider for /health introspection. `shutdown_tracing` runs in BOTH lifespan finally branches (the early Nexo-disabled return path AND the normal path) so the batch exporter always flushes. Tests: 2 new in `tests/observability/test_lifespan_init.py` — mocks `configure_tracing`/`Traceloop`/`shutdown_tracing` and asserts the off-path skips Traceloop while the on-path forwards the settings to both. Full suite: 183 passed, 1 skipped, 0 failed.

## Iteration 6 — 2026-05-12

- Task: A6 LangGraph parallel-branch propagation gotcha test
- Status: completed
- Commit: f3d89989

## Iteration 7 — 2026-05-12

- Task: Phase A code-review followups (Issues 1-5 + Rec 4)
- Status: completed
- Commit: 21037769

## Iteration 8 — 2026-05-12

- Task: E1 LLM intent router + mode resolver (skipping blocked B/C/D)
- Status: completed
- Commit: fe9f0363

## Iteration 9 — 2026-05-12

- Task: E2 meta-question agent (Haiku tier, no SQL)
- Status: completed
- Commit: 9f53356b

## Iteration 10 — 2026-05-12

- Task: E3 composable DB primitives + sqlglot safety gate (HIGH-RISK)
- Status: completed (safety tests green — gate to E4+)
- Commit: 7b14c05a

## Iteration 11 — 2026-05-12

- Task: E3 post-review fixes (Critical C1 LATERAL + C2 side-effect funcs + I1 CTEs + I4 re-render)
- Status: completed (Critical bypasses closed before E4)
- Commit: 684fbd09

## Iteration 12 — 2026-05-12

- Task: E4 provenance log + curate script
- Status: completed
- Commit: 2a928ad4

## Iteration 13 — 2026-05-12

- Task: E5 conversational memory + ConversationStore interface
- Status: completed
- Commit: bbb51efd

## Iteration 14 — 2026-05-12

- Task: E6 agentic graph topology + E7 tenancy-gate refactor
- Status: completed
- Commit: 6955bba3

## Iteration 15 — 2026-05-12

- Task: E8 (tests already in place from TDD on E1-E7) + E9 modular.mode telemetry
- Status: completed
- Commit: d404fdf2

## Iteration 16 — 2026-05-12

- Task: F1 pytest green verification (offline-doable F task)
- Status: completed
- Commit: 302a61e8
- Notes: `uv run pytest` reports **275 passed, 1 skipped, 0 failed, 0 errors**. Plan 12's 151-test baseline preserved (no regressions); 124 new tests across observability/, runtime/, agents/, integrations/nexo/ for Phase A + Phase E. F2 (canned-mode live verification), F3 (agentic-mode live verification), F4 (one week of agentic traffic), F5 (PR open with verification artifacts) require operator preconditions per `.ralph/blockers.md` (Docker daemon for Langfuse stack, SSH tunnel to coordinador-prod, ANTHROPIC_API_KEY). Until those land the loop must BLOCKER stop. Phase E review checkpoint next.

## Iteration 17 — 2026-05-12

- Task: Phase E code review + cheap followups + supervisor-wire-up blocker note
- Status: completed (loop stopping with BLOCKER)
- Commit: 501a545e

## Iteration 18 — 2026-05-12

- Task: BLOCKER triage — Stage 1 (1A supervisor wire-up + 1B B-scaffolding + 1C cost CLI)
- Status: completed
- Commits: a63fd949 (1A), 2bdbdefb (1B), a2f5e8ae (1C)
- Notes: User picked Stage 1 (code-only first) for resolving the BLOCKER. Three commits land all offline-doable work: (1A) supervisor consumes `resolve_mode` / `LLMIntentRouter` / `agentic_graph` / `meta_agent_node` / `InMemoryConversationStore`; factory + FastAPI lifespan inject them on boot; 7 new tests cover canned/meta/agentic/non-Mintral-refused/auto/conversation-roundtrip/backward-compat. (1B) `infra/observability/` scaffolding: `docker-compose.yml` (7-service stack postgres+clickhouse+redis+minio+langfuse-web+langfuse-worker+otel-collector w/ health-checked depends_on), `otel-collector-config.yaml` (OTLP gRPC+HTTP receivers, memory_limiter+batch processors, otlphttp/langfuse exporter), `bootstrap.sh` (compose up, health poll, Langfuse bootstrap-API key mint, prints .env paste-block), `README.md` (bring-up, privacy posture, backup/restore via tar, backend-swap recipe, troubleshooting table). All YAML/shell linted offline. (1C) `observability/report.py` + 13 tests: pure `aggregate_cost(traces, by=agent|tenant|mode)` returning sorted `CostRow` with cost/tokens/n; `parse_since('7d'/'24h'/'90m')`; `--fixture` JSONL mode shipped for offline use; live Langfuse fetch deferred to F-phase. Marked B1-B4 + C3 as [x] in state.md; C1/C2/C4 explicitly noted as live-stack-dependent. Full suite: 295 passed, 1 skipped. Stage 2 (Docker install + API key + tunnel) is on the user.

## Iteration 19 — 2026-05-12

- Task: Live bring-up + F2/F3 verification + tests/conftest.py isolation + blockers cleared
- Status: completed
- Commits: b3dee407 (compose+collector+bootstrap fixes), 183cb3f3 (conftest + state + blockers cleared), then F5 PR opened: https://github.com/microboxlabs/modulariot/pull/462

## Iteration 20 — 2026-05-12

- Task: E10 (added mid-execution) — Langfuse first-class trace fields for per-client cost rollups
- Status: completed
- Commit: <pending>
- Notes: User noticed the Langfuse Tracing UI's filter sidebar (User ID / Session ID / Tags) was empty for our runs even though `tenant_id` / `user_id` / `conversation_id` flow through every request. Added E10 to plan 13 (the plan declares itself editable mid-execution under "Operational rules"). Implementation: `HarnessContext` gains `conversation_id: str | None`, propagated from `UserRequest.to_context()`. `agent_span` + `NexoTelemetryCallback` extended with `user_id` / `session_id` / `tags` / `environment` kwargs; they emit `langfuse.user.id` / `langfuse.session.id` / `langfuse.tags` (JSON-encoded for portability) / `langfuse.environment` alongside the existing `modular.*` attrs. `HarnessSupervisor._root_span_kwargs(ctx, route)` centralizes the mapping so all three dispatch paths (nexo / agentic / meta) carry identical Langfuse fields plus a per-route tag. `nexo_graph._instrument(...)` threads `ctx.user_id` + `ctx.conversation_id or ctx.thread_id` + a per-agent tag list. 4 new unit tests in `tests/observability/test_langfuse_attribution.py`. Live verification: `POST /runs {tenant_id:mintral, user_id:odtorres, conversation_id:odtorres-debug-2}` → ClickHouse `traces` table now shows `user_id='odtorres'`, `session_id='odtorres-debug-2'`, `tags=['agent:filter_expert','agent:synthesizer','mode:auto','route:nexo_query','tenant:mintral']`, `environment='local'` on the `nexo.run` row. Full suite: 299 passed, 1 skipped, 0 failed.

- Notes: User brought up tunnel + Docker + Langfuse stack. Four compose-level corrections found live and fixed in commit b3dee407: ClickHouse healthcheck `localhost`→`127.0.0.1` (macOS IPv6 loopback trap); `ENCRYPTION_KEY` regenerated via `openssl rand -hex 32` (Langfuse v3 Zod-validates the format); `CLICKHOUSE_CLUSTER_ENABLED=false` added (single-node skips ZooKeeper); `LANGFUSE_INIT_PROJECT_{PUBLIC,SECRET}_KEY` baked in so the OTel Collector ships traces with deterministic auth. F2 live-verified (G6/G7/G8 canned-mode curls all return Markdown answers from real Coordinador snapshot, including stale-data warning where appropriate). F3 live-verified: META mode answers any tenant from primer+catalog, AGENTIC refused for non-Mintral at request-validation, AGENTIC for Mintral runs through stub planner+synthesizer, AUTO route correctly classifies "dimensionamiento para mañana" as NEXO_QUERY at conf=0.75. Direct ClickHouse query confirms Langfuse received: 11 `nexo.run` root spans + 6 `nexo.synthesizer` + 6 `nexo.filter_expert` per-agent spans + 22 `anthropic.chat` (Traceloop auto-instrumented) child spans, all carrying `modular.mode`/`modular.run_id`/`modular.tenant_id` metadata. Per-mode split: 5 auto / 3 canned / 2 meta / 1 agentic. Side fix: 7 default-value tests started failing because pydantic-settings was auto-loading the populated dev `.env` — added `tests/conftest.py` with an autouse fixture that pins `env_file` to `/nonexistent/.env` and clears `MIOT_HARNESS_*` from the inherited shell. Full suite: 295 passed, 1 skipped. Blockers entries marked RESOLVED. State.md updated: C1, D1, D2, F2, F3 all → [x]; D3, F4 stay [ ] (time-gated); C2, C4, F5 stay [ ] (follow-up PR). Ready for F5 PR.


- Notes: Dispatched `superpowers:requesting-code-review` for the Phase E surface (E1 router/resolver, E2 meta, E4 provenance, E5 conversation, E6 agentic_graph, E7 tenancy, E8/E9 mode telemetry — E3 was reviewed earlier). 0 Critical, 7 Important, 5 Minor. Applied cheap fixes here: (#4) `.env.example` gained 3 new sections for MIOT_HARNESS_INTENT_ROUTER_{MODEL,CONFIDENCE_THRESHOLD} and MIOT_HARNESS_NEXO_EXPLAIN_COST_THRESHOLD; (#2) `agentic_graph.py` docstring rewritten to be honest about which nodes are wired vs which are deferred; (#3) `_ = provenance_log` clarified with intent comment. Big remaining Important #1 — supervisor doesn't yet consume `resolve_mode` / `LLMIntentRouter` / `InMemoryConversationStore` / `build_agentic_graph` / `meta_agent_node` — written up as a new OPEN entry in `.ralph/blockers.md` with concrete step-list for the F-phase wire-up. The F-phase tasks (F2-F5) are all gated on operator preconditions (Docker daemon, SSH tunnel, ANTHROPIC_API_KEY) per blockers.md. Output BLOCKER and STOP — every remaining task in document order requires either operator preconditions or the supervisor wire-up that depends on them. Full suite: 275 passed, 1 skipped.


- Notes: E8 was implicitly completed via TDD during E1-E7 — all seven test files the plan lists exist: `test_intent_router.py` (11 tests), `test_mode_resolver.py` (6), `test_meta_agent.py` (4), `test_primitives.py` (47), `test_provenance.py` (7), `test_conversation.py` (7), `test_agentic_graph.py` (4), `test_tenancy_gate.py` (7). E9: added `mode: RunMode = "auto"` to `HarnessContext` (propagated from `UserRequest.to_context()`). Supervisor's `agent_span("run", ...)` now passes `mode=ctx.mode` so the root `nexo.run` carries `modular.mode`. `nexo_graph._instrument(...)` forwards `ctx.mode` to `NexoTelemetryCallback`, so every per-agent `nexo.<agent>` span carries the same attribute — enabling C2 per-mode cost split when Phase B/C land. Tests: 2 new in `tests/observability/test_mode_telemetry.py` (root span carries `modular.mode='agentic'`; per-agent callback spans carry `modular.mode='canned'` after running the real graph). C2 dashboards and `nexo.critic` non-zero are infra-dependent (Phase B+C blocked) — the attr surface is wired and verified. Full suite: 275 passed, 1 skipped, 0 failed.

- Notes: E6: new `runtime/agentic_graph.py` exposing `build_agentic_graph(settings, models, provenance_log)` → LangGraph `StateGraph[NexoState]` with nodes `tenancy_gate / planner / synthesizer / critic / summarizer`. Entry point gates on tenant, turn cap = 12 (planner bumps `turn_count`, exits with failure at cap). The behavioral details (planner Sonnet decision, executor calling primitives, freshness_judge, domain_analyst critic verdict routing) are stubs in this iteration — the plan acknowledges F3 (live verification) is the behavior gate. Test coverage asserts wiring: non-Mintral refusal, happy-path runs to synthesizer answer, turn-cap exit, required-nodes topology check. E7: new `runtime/tenancy.py` with pure `tenancy_gate_decision(ctx, route, settings) → TenancyDecision(allowed, refusal_message, audit_attr)`. Behavior matrix per plan: NEXO_QUERY/NEXO_AGENTIC → tenant must match `nexo_tenant_lock` else refuse; NEXO_META → allow any tenant + emit `tenant.bypass: meta_route` audit attr when off-lock; unknown route → safe-default refuse. Refactored both `nexo_graph._tenant_gate_node` and `agentic_graph.tenancy_gate` to delegate to the shared decision. Tests: 11 new (4 agentic_graph wiring + 7 tenancy matrix incl. off-lock meta audit, locked-tenant no-audit, unknown-route refuse). Full suite: 273 passed, 1 skipped, 0 failed.

- Notes: New `runtime/conversation.py` with `ConversationTurn` (user_message + assistant_answer), `ConversationHistory` (id, turns, summary), `ConversationStore` Protocol (v2 Redis is a drop-in), and `InMemoryConversationStore` v1 impl. `summarize_if_needed(conversation_id, summarizer)` returns False below the configured turn cap (default 10), invokes the async summarizer at turn-11 and stores the result in `history.summary`. `UserRequest.conversation_id: str | None = None` and `HarnessRunRecord.conversation_id: str | None = None` added so Langfuse groups multi-turn chats by this attribute. Tests: 7 in `tests/runtime/test_conversation.py` (unknown→None, single-turn append, order preserved, two conversations isolated, summarize no-op below threshold, fires above, conversation_id round-trips across two /runs calls). Full suite: 262 passed, 1 skipped, 0 failed.

- Notes: New `observability/provenance.py` with `ProvenanceEntry` dataclass (question, sql, plan_cost, rows_returned, refreshed_at, run_id, tenant_id) and `ProvenanceLog(root, enabled=True)` that appends one JSONL line per call, partitioned by UTC date (`evals/provenance/YYYY-MM-DD.jsonl`), creating the parent dir on first write. `enabled=False` makes calls no-op. Naive `now` arg coerced to UTC; `refreshed_at` may be None. Tests: 7 in `tests/observability/test_provenance.py` (all fields round-trip, append-only, date partition, mkdir on missing parent, disable flag, refreshed_at None/value parametric). New `scripts/provenance-curate.py` (worktree root) — argparse CLI that loads N days of JSONL, normalizes WHERE clauses (`'literal'`→`$`, `\d+`→`$`) into pattern buckets, counts top (table, where-pattern) repeats, cross-tenant tables (≥2 tenants signal multi-tenant abstraction in plan 14), plan-cost outliers, and renders as text or JSON. Module loads without errors. Full suite: 255 passed, 1 skipped, 0 failed.

- Notes: Reviewer found 2 real bypasses through the E3 safety gate. (C1) `LATERAL pg_read_file('/etc/passwd')` parsed as `exp.Anonymous` inside `exp.Lateral` — never an `exp.Table`, allowlist iterator skipped it. Fix: `validate_select_sql` walks `exp.Lateral` nodes and raises `UnsupportedConstruct` outright; agentic queries don't need LATERAL. (C2) `pg_terminate_backend`, `set_config`, `pg_sleep`, `lo_import`, `pg_reload_conf`, `dblink`, `pg_read_file`, `pg_advisory_lock` all SELECT-eligible per AST (no Insert/Update/Delete node) but cause DoS / session-state mutation / file exfil / kill backends. Fix: positive function allowlist `_SAFE_FUNCTIONS` (~80 entries: aggregates, math, string, date/time, JSON, array, window). `_function_name_candidates(func)` returns the full set of sqlglot's per-builtin spellings (`Anonymous.this`, `sql_name()`, `key`, class name) so the gate matches whether sqlglot normalizes `to_char` → `TimeToStr` / `time_to_str` / `timetostr` etc. (I1) CTE aliases collected from `exp.With.expressions` and exempted from the table allowlist — legitimate `WITH ok AS (SELECT ...) SELECT * FROM ok` now passes. (I4) `_render_safe(ast)` returns `ast.sql(dialect='postgres')` so DB sees only what the gate validated; `nexo_select`/`nexo_grep`/`nexo_explain` all route through it. Plus `exp.Merge`/`exp.Copy` added to `_MUTATION_NODES`. Test additions: 3 LATERAL rejections, 9 side-effect function rejections (terminate_backend, cancel_backend, set_config, pg_sleep, lo_import, pg_reload_conf, pg_advisory_lock, pg_read_file, dblink), 5 safe-builtin acceptances (count, lower/max, coalesce+to_char+now, date_trunc, json_build_object), 1 CTE-allowlisted acceptance, 2 MERGE/COPY rejections. Direct probe re-run via `uv run python -c "..."` confirms all 8 bypass forms now blocked. Full suite: 248 passed, 1 skipped, 0 failed.

- Notes: Added `sqlglot>=25.0` to pyproject (`sqlglot==30.7.0` installed) — missed in A1; the plan calls for it. New setting `nexo_explain_cost_threshold: float = 10000.0`. New `integrations/nexo/primitives.py` with: (1) safety gate `validate_select_sql(sql)` running sqlglot's postgres AST parser then walking for mutation nodes (`Insert/Update/Delete/Drop/Create/Alter/AlterColumn/Grant/TruncateTable`), rejecting multi-statement input, and asserting every `exp.Table` is allowlisted via `^nexo\.dx_[a-zA-Z0-9_]+$`. (2) Four primitives: `nexo_describe` (information_schema.columns lookup, narrow allowlist), `nexo_select` (column/where/order/limit, default LIMIT 100, hard cap 5000), `nexo_grep` (sugar over ILIKE with quoted column identifier), `nexo_explain` (EXPLAIN FORMAT JSON; raises `CostGateViolation` when total cost exceeds threshold). Custom exceptions: `SafetyGateViolation` base + `MultiStatementRejected`/`MutationRejected`/`AllowlistViolation`/`UnsupportedConstruct`/`CostGateViolation`. Tests: 27 new in `tests/integrations/nexo/test_primitives.py`: 13 safety tests (3 multi-statement, 8 mutation, 5 allowlist deny, 3 allowlist allow, 1 CTE-with-mutation) + 8 functional tests against a sync `pool.acquire()` returning an async context manager (matches asyncpg's real shape). Full suite: 228 passed, 1 skipped, 0 failed. Plan-prompt gate met: "Move past E3 without safety tests green" is satisfied.

- Notes: New `agents/meta_agent.py` with `MetaAgentCatalogEntry` dataclass (narrow projection of `FunctionDescriptor`) and `meta_agent_node(state, *, model, primer, catalog)` — system prompt is `primer + formatted catalog`; LLM answers from cached schema/primer; no `registry`/`tools`/`pool` parameter so "no SQL" is a structural guarantee, not a comment. 4 tests in `tests/agents/test_meta_agent.py`: answers reference catalog functions, primer text reaches the system prompt, every catalog entry's title+body reach the system prompt, and signature has no DB/tool params. Full suite: 201 passed, 1 skipped, 0 failed.

- Notes: B1+ blocked by operator preconditions; per loop rule "skip to first unblocked", jump to E1. New `runtime/intent_router.py` (`LLMIntentRouter` with FakeListChatModel-driveable async route(), tolerant JSON parsing of LLM output, bare or ```json``` fenced, validates against the 6-route enum, falls back to keyword router below `confidence_threshold` or on parse failure). New `runtime/mode_resolver.py` (`resolve_mode(request, llm_router, tenant_lock)` dispatches: auto→llm_router; canned→NEXO_QUERY; meta→NEXO_META (any tenant); agentic→NEXO_AGENTIC iff tenant matches lock, else raises `ModeAccessDenied`). Extended `HarnessRoute` with NEXO_META/NEXO_AGENTIC/OTHER. Added `mode: RunMode = "auto"` to `UserRequest` with `Literal["auto","canned","meta","agentic"]`. Added `intent_router_model` + `intent_router_confidence_threshold` to `HarnessSettings`. Tests: 11 new — `tests/runtime/test_intent_router.py` (30-prompt confusion-matrix with ≥90% accuracy gate, low-conf fallback, unparseable-JSON fallback, fenced-JSON parsing, invalid-route-name fallback) and `tests/runtime/test_mode_resolver.py` (5 mode-bypass paths + pydantic validation rejection of invalid mode). Full suite: 197 passed, 1 skipped, 0 failed.

- Notes: Acted on reviewer feedback (`superpowers:requesting-code-review` checkpoint after Phase A). (1) Added 6 new MIOT_HARNESS_OTEL_*/MIOT_HARNESS_LANGFUSE_* entries to `.env.example` so the file's "every config.py setting documented here" invariant holds. (2) Broadened `tests/observability/conftest.py` span filter from `nexo.*` only to `(nexo., gen_ai., anthropic., openai.)` so Phase B Traceloop auto-instrumentation spans aren't silently dropped in tests. (3) `observability/otel.py`: if a real `TracerProvider` is already globally installed (pytest-opentelemetry, hot-reload), `configure_tracing` now logs a warning and returns the EXISTING provider instead of silently handing back a detached one whose spans go nowhere. Test rewrite uses `patch` on `trace.get_tracer_provider`/`trace.set_tracer_provider` so we can exercise both branches without polluting global state. (4) `observability/spans.py` docstring rewritten — removed the stale claim that nodes wrap themselves in `agent_span` (they don't; the callback emits `nexo.<agent>` for LLM calls; `agent_span` is currently only used for the root `nexo.run` in supervisor). (5) `tests/observability/test_propagation.py`: added `await asyncio.sleep(0)` to force event-loop interleaving between branches + corrected docstring to specify what the test does and doesn't prove (structural attr defense vs. OTel-context propagation). (Rec 4) Wired `FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)` in lifespan so HTTP request spans parent `nexo.run` and the full request → graph → LLM tree shows up in Langfuse. Full suite: 186 passed, 1 skipped, 0 failed.

- Notes: A6's other two test files (test_callbacks.py, test_pricing.py) were written under A2 as part of TDD on the source files. A6 adds the missing piece: `tests/observability/test_propagation.py` — a synthetic 3-node graph `planner → (branch_a ∥ branch_b) → joiner` with LangGraph fan-out where each parallel branch instantiates its own `NexoTelemetryCallback`. Asserts that even under parallel execution every emitted `nexo.*` span carries the right `modular.{agent,run_id,tenant_id}` (the explicit attrs Langfuse regroups by when OTel context propagation breaks across LangGraph branches). Second test: 20 concurrent callbacks via `asyncio.gather` confirm per-`run_id` span-dict isolation. Phase A is now [x] across A1-A6; next checkpoint = `superpowers:requesting-code-review`. Full suite: 185 passed, 1 skipped, 0 failed.





