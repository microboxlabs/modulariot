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
- Commit: <pending>
- Notes: New `agents/meta_agent.py` with `MetaAgentCatalogEntry` dataclass (narrow projection of `FunctionDescriptor`) and `meta_agent_node(state, *, model, primer, catalog)` — system prompt is `primer + formatted catalog`; LLM answers from cached schema/primer; no `registry`/`tools`/`pool` parameter so "no SQL" is a structural guarantee, not a comment. 4 tests in `tests/agents/test_meta_agent.py`: answers reference catalog functions, primer text reaches the system prompt, every catalog entry's title+body reach the system prompt, and signature has no DB/tool params. Full suite: 201 passed, 1 skipped, 0 failed.

- Notes: B1+ blocked by operator preconditions; per loop rule "skip to first unblocked", jump to E1. New `runtime/intent_router.py` (`LLMIntentRouter` with FakeListChatModel-driveable async route(), tolerant JSON parsing of LLM output, bare or ```json``` fenced, validates against the 6-route enum, falls back to keyword router below `confidence_threshold` or on parse failure). New `runtime/mode_resolver.py` (`resolve_mode(request, llm_router, tenant_lock)` dispatches: auto→llm_router; canned→NEXO_QUERY; meta→NEXO_META (any tenant); agentic→NEXO_AGENTIC iff tenant matches lock, else raises `ModeAccessDenied`). Extended `HarnessRoute` with NEXO_META/NEXO_AGENTIC/OTHER. Added `mode: RunMode = "auto"` to `UserRequest` with `Literal["auto","canned","meta","agentic"]`. Added `intent_router_model` + `intent_router_confidence_threshold` to `HarnessSettings`. Tests: 11 new — `tests/runtime/test_intent_router.py` (30-prompt confusion-matrix with ≥90% accuracy gate, low-conf fallback, unparseable-JSON fallback, fenced-JSON parsing, invalid-route-name fallback) and `tests/runtime/test_mode_resolver.py` (5 mode-bypass paths + pydantic validation rejection of invalid mode). Full suite: 197 passed, 1 skipped, 0 failed.

- Notes: Acted on reviewer feedback (`superpowers:requesting-code-review` checkpoint after Phase A). (1) Added 6 new MIOT_HARNESS_OTEL_*/MIOT_HARNESS_LANGFUSE_* entries to `.env.example` so the file's "every config.py setting documented here" invariant holds. (2) Broadened `tests/observability/conftest.py` span filter from `nexo.*` only to `(nexo., gen_ai., anthropic., openai.)` so Phase B Traceloop auto-instrumentation spans aren't silently dropped in tests. (3) `observability/otel.py`: if a real `TracerProvider` is already globally installed (pytest-opentelemetry, hot-reload), `configure_tracing` now logs a warning and returns the EXISTING provider instead of silently handing back a detached one whose spans go nowhere. Test rewrite uses `patch` on `trace.get_tracer_provider`/`trace.set_tracer_provider` so we can exercise both branches without polluting global state. (4) `observability/spans.py` docstring rewritten — removed the stale claim that nodes wrap themselves in `agent_span` (they don't; the callback emits `nexo.<agent>` for LLM calls; `agent_span` is currently only used for the root `nexo.run` in supervisor). (5) `tests/observability/test_propagation.py`: added `await asyncio.sleep(0)` to force event-loop interleaving between branches + corrected docstring to specify what the test does and doesn't prove (structural attr defense vs. OTel-context propagation). (Rec 4) Wired `FastAPIInstrumentor.instrument_app(app, tracer_provider=tracer_provider)` in lifespan so HTTP request spans parent `nexo.run` and the full request → graph → LLM tree shows up in Langfuse. Full suite: 186 passed, 1 skipped, 0 failed.

- Notes: A6's other two test files (test_callbacks.py, test_pricing.py) were written under A2 as part of TDD on the source files. A6 adds the missing piece: `tests/observability/test_propagation.py` — a synthetic 3-node graph `planner → (branch_a ∥ branch_b) → joiner` with LangGraph fan-out where each parallel branch instantiates its own `NexoTelemetryCallback`. Asserts that even under parallel execution every emitted `nexo.*` span carries the right `modular.{agent,run_id,tenant_id}` (the explicit attrs Langfuse regroups by when OTel context propagation breaks across LangGraph branches). Second test: 20 concurrent callbacks via `asyncio.gather` confirm per-`run_id` span-dict isolation. Phase A is now [x] across A1-A6; next checkpoint = `superpowers:requesting-code-review`. Full suite: 185 passed, 1 skipped, 0 failed.





