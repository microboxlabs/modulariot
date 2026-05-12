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
- Commit: <pending>
- Notes: In `api/server.py` lifespan, call `configure_tracing(enabled=settings.otel_enabled, ...)` BEFORE the Nexo boot path. When it returns a provider (otel_enabled=true), follow with `Traceloop.init(app_name=service_name, api_endpoint=endpoint, disable_batch=False, telemetry_enabled=False)` so Anthropic/OpenAI SDK calls auto-emit `gen_ai.*` child spans against the same global TracerProvider the per-agent `NexoTelemetryCallback` uses. `app.state.tracer_provider` holds the provider for /health introspection. `shutdown_tracing` runs in BOTH lifespan finally branches (the early Nexo-disabled return path AND the normal path) so the batch exporter always flushes. Tests: 2 new in `tests/observability/test_lifespan_init.py` — mocks `configure_tracing`/`Traceloop`/`shutdown_tracing` and asserts the off-path skips Traceloop while the on-path forwards the settings to both. Full suite: 183 passed, 1 skipped, 0 failed.




