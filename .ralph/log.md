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
- Commit: <pending>
- Notes: E6: new `runtime/agentic_graph.py` exposing `build_agentic_graph(settings, models, provenance_log)` → LangGraph `StateGraph[NexoState]` with nodes `tenancy_gate / planner / synthesizer / critic / summarizer`. Entry point gates on tenant, turn cap = 12 (planner bumps `turn_count`, exits with failure at cap). The behavioral details (planner Sonnet decision, executor calling primitives, freshness_judge, domain_analyst critic verdict routing) are stubs in this iteration — the plan acknowledges F3 (live verification) is the behavior gate. Test coverage asserts wiring: non-Mintral refusal, happy-path runs to synthesizer answer, turn-cap exit, required-nodes topology check. E7: new `runtime/tenancy.py` with pure `tenancy_gate_decision(ctx, route, settings) → TenancyDecision(allowed, refusal_message, audit_attr)`. Behavior matrix per plan: NEXO_QUERY/NEXO_AGENTIC → tenant must match `nexo_tenant_lock` else refuse; NEXO_META → allow any tenant + emit `tenant.bypass: meta_route` audit attr when off-lock; unknown route → safe-default refuse. Refactored both `nexo_graph._tenant_gate_node` and `agentic_graph.tenancy_gate` to delegate to the shared decision. Tests: 11 new (4 agentic_graph wiring + 7 tenancy matrix incl. off-lock meta audit, locked-tenant no-audit, unknown-route refuse). Full suite: 273 passed, 1 skipped, 0 failed.

- Notes: New `runtime/conversation.py` with `ConversationTurn` (user_message + assistant_answer), `ConversationHistory` (id, turns, summary), `ConversationStore` Protocol (v2 Redis is a drop-in), and `InMemoryConversationStore` v1 impl. `summarize_if_needed(conversation_id, summarizer)` returns False below the configured turn cap (default 10), invokes the async summarizer at turn-11 and stores the result in `history.summary`. `UserRequest.conversation_id: str | None = None` and `HarnessRunRecord.conversation_id: str | None = None` added so Langfuse groups multi-turn chats by this attribute. Tests: 7 in `tests/runtime/test_conversation.py` (unknown→None, single-turn append, order preserved, two conversations isolated, summarize no-op below threshold, fires above, conversation_id round-trips across two /runs calls). Full suite: 262 passed, 1 skipped, 0 failed.

- Notes: New `observability/provenance.py` with `ProvenanceEntry` dataclass (question, sql, plan_cost, rows_returned, refreshed_at, run_id, tenant_id) and `ProvenanceLog(root, enabled=True)` that appends one JSONL line per call, partitioned by UTC date (`evals/provenance/YYYY-MM-DD.jsonl`), creating the parent dir on first write. `enabled=False` makes calls no-op. Naive `now` arg coerced to UTC; `refreshed_at` may be None. Tests: 7 in `tests/observability/test_provenance.py` (all fields round-trip, append-only, date partition, mkdir on missing parent, disable flag, refreshed_at None/value parametric). New `scripts/provenance-curate.py` (worktree root) — argparse CLI that loads N days of JSONL, normalizes WHERE clauses (`'literal'`→`$`, `\d+`→`$`) into pattern buckets, counts top (table, where-pattern) repeats, cross-tenant tables (≥2 tenants signal multi-tenant abstraction in plan 14), plan-cost outliers, and renders as text or JSON. Module loads without errors. Full suite: 255 passed, 1 skipped, 0 failed.

- Notes: Reviewer found 2 real bypasses through the E3 safety gate. (C1) `LATERAL pg_read_file('/etc/passwd')` parsed as `exp.Anonymous` inside `exp.Lateral` — never an `exp.Table`, allowlist iterator skipped it. Fix: `validate_select_sql` walks `exp.Lateral` nodes and raises `UnsupportedConstruct` outright; agentic queries don't need LATERAL. (C2) `pg_terminate_backend`, `set_config`, `pg_sleep`, `lo_import`, `pg_reload_conf`, `dblink`, `pg_read_file`, `pg_advisory_lock` all SELECT-eligible per AST (no Insert/Update/Delete node) but cause DoS / session-state mutation / file exfil / kill backends. Fix: positive function allowlist `_SAFE_FUNCTIONS` (~80 entries: aggregates, math, string, date/time, JSON, array, window). `_function_name_candidates(func)` returns the full set of sqlglot's per-builtin spellings (`Anonymous.this`, `sql_name()`, `key`, class name) so the gate matches whether sqlglot normalizes `to_char` → `TimeToStr` / `time_to_str` / `timetostr` etc. (I1) CTE aliases collected from `exp.With.expressions` and exempted from the table allowlist — legitimate `WITH ok AS (SELECT ...) SELECT * FROM ok` now passes. (I4) `_render_safe(ast)` returns `ast.sql(dialect='postgres')` so DB sees only what the gate validated; `nexo_select`/`nexo_grep`/`nexo_explain` all route through it. Plus `exp.Merge`/`exp.Copy` added to `_MUTATION_NODES`. Test additions: 3 LATERAL rejections, 9 side-effect function rejections (terminate_backend, cancel_backend, set_config, pg_sleep, lo_import, pg_reload_conf, pg_advisory_lock, pg_read_file, dblink), 5 safe-builtin acceptances (count, lower/max, coalesce+to_char+now, date_trunc, json_build_object), 1 CTE-allowlisted acceptance, 2 MERGE/COPY rejections. Direct probe re-run via `uv run python -c "..."` confirms all 8 bypass forms now blocked. Full suite: 248 passed, 1 skipped, 0 failed.

- Notes: Added `sqlglot>=25.0` to pyproject (`sqlglot==30.7.0` installed) — missed in A1; the plan calls for it. New setting `nexo_explain_cost_threshold: float = 10000.0`. New `integrations/nexo/primitives.py` with: (1) safety gate `validate_select_sql(sql)` running sqlglot's postgres AST parser then walking for mutation nodes (`Insert/Update/Delete/Drop/Create/Alter/AlterColumn/Grant/TruncateTable`), rejecting multi-statement input, and asserting every `exp.Table` is allowlisted via `^nexo\.dx_[a-zA-Z0-9_]+$`. (2) Four primitives: `nexo_describe` (information_schema.columns lookup, narrow allowlist), `nexo_select` (column/where/order/limit, default LIMIT 100, hard cap 5000), `nexo_grep` (sugar over ILIKE with quoted column identifier), `nexo_explain` (EXPLAIN FORMAT JSON; raises `CostGateViolation` when total cost exceeds threshold). Custom exceptions: `SafetyGateViolation` base + `MultiStatementRejected`/`MutationRejected`/`AllowlistViolation`/`UnsupportedConstruct`/`CostGateViolation`. Tests: 27 new in `tests/integrations/nexo/test_primitives.py`: 13 safety tests (3 multi-statement, 8 mutation, 5 allowlist deny, 3 allowlist allow, 1 CTE-with-mutation) + 8 functional tests against a sync `pool.acquire()` returning an async context manager (matches asyncpg's real shape). Full suite: 228 passed, 1 skipped, 0 failed. Plan-prompt gate met: "Move past E3 without safety tests green" is satisfied.

- Notes: New `agents/meta_agent.py` with `MetaAgentCatalogEntry` dataclass (narrow projection of `FunctionDescriptor`) and `meta_agent_node(state, *, model, primer, catalog)` — system prompt is `primer + formatted catalog`; LLM answers from cached schema/primer; no `registry`/`tools`/`pool` parameter so "no SQL" is a structural guarantee, not a comment. 4 tests in `tests/agents/test_meta_agent.py`: answers reference catalog functions, primer text reaches the system prompt, every catalog entry's title+body reach the system prompt, and signature has no DB/tool params. Full suite: 201 passed, 1 skipped, 0 failed.

- Notes: B1+ blocked by operator preconditions; per loop rule "skip to first unblocked", jump to E1. New `runtime/intent_router.py` (`LLMIntentRouter` with FakeListChatModel-driveable async route(), tolerant JSON parsing of LLM output, bare or ```json``` fenced, validates against the 6-route enum, falls back to keyword router below `confidence_threshold` or on parse failure). New `runtime/mode_resolver.py` (`resolve_mode(request, llm_router, tenant_lock)` dispatches: auto→llm_router; canned→NEXO_QUERY; meta→NEXO_META (any tenant); agentic→NEXO_AGENTIC iff tenant matches lock, else raises `ModeAccessDenied`). Extended `HarnessRoute` with NEXO_META/NEXO_AGENTIC/OTHER. Added `mode: RunMode = "auto"` to `UserRequest` with `Literal["auto","canned","meta","agentic"]`. Added `intent_router_model` + `intent_router_confidence_threshold` to `HarnessSettings`. Tests: 11 new — `tests/runtime/test_intent_router.py` (30-prompt confusion-matrix with ≥90% accuracy gate, low-conf fallback, unparseable-JSON fallback, fenced-JSON parsing, invalid-route-name fallback) and `tests/runtime/test_mode_resolver.py` (5 mode-bypass paths + pydantic validation rejection of invalid mode). Full suite: 197 passed, 1 skipped, 0 failed.

- Notes: Acted on reviewer feedback (`superpowers:requesting-code-review` checkpoint after Phase A). (1) Added 6 new MIOT_HARNESS_OTEL_*/MIOT_HARNESS_LANGFUSE_* entries to `.env.example` so the file's "every config.py setting documented here" invariant holds. (2) Broadened `tests/observability/conftest.py` span filter from `nexo.*` only to `(nexo., gen_ai., anthropic., openai.)` so Phase B Traceloop auto-instrumentation spans aren't silently dropped in tests. (3) `observability/otel.py`: if a real `TracerProvider` is already globally installed (pytest-opentelemetry, hot-reload), `configure_tracing` now logs a warning and returns the EXISTING provider instead of silently handing back a detached one whose spans go nowhere. Test rewrite uses `patch` on `trace.get_tracer_provider`/`trace.set_tracer_provider` so we can exercise both branches without polluting global state. (4) `observability/spans.py` docstring rewritten — removed the stale claim that nodes wrap themselves in `agent_span` (they don't; the callback emits `nexo.<agent>` for LLM calls; `agent_span` is currently only used for the root `nexo.run` in supervisor). (5) `tests/observability/test_propagation.py`: added `await asyncio.sleep(0)` to force event-loop interleaving between branches + corrected docstring to specify what the test does and doesn't prove (structural attr defense vs. OTel-context propagation). (Rec 4) Wired `FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)` in lifespan so HTTP request spans parent `nexo.run` and the full request → graph → LLM tree shows up in Langfuse. Full suite: 186 passed, 1 skipped, 0 failed.

- Notes: A6's other two test files (test_callbacks.py, test_pricing.py) were written under A2 as part of TDD on the source files. A6 adds the missing piece: `tests/observability/test_propagation.py` — a synthetic 3-node graph `planner → (branch_a ∥ branch_b) → joiner` with LangGraph fan-out where each parallel branch instantiates its own `NexoTelemetryCallback`. Asserts that even under parallel execution every emitted `nexo.*` span carries the right `modular.{agent,run_id,tenant_id}` (the explicit attrs Langfuse regroups by when OTel context propagation breaks across LangGraph branches). Second test: 20 concurrent callbacks via `asyncio.gather` confirm per-`run_id` span-dict isolation. Phase A is now [x] across A1-A6; next checkpoint = `superpowers:requesting-code-review`. Full suite: 185 passed, 1 skipped, 0 failed.





