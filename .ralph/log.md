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
- Commit: <pending>
- Notes: New `miot_harness.observability` package with `pricing.py` (versioned `ModelPricing` table for Opus 4.7 / Sonnet 4.6 / Haiku 4.5 / gpt-4o-mini, Anthropic-bucket `TokenUsage`, `compute_cost` quantized to 6 decimals, `UnknownModelError`), `otel.py` (`configure_tracing` returns None when disabled, else builds `TracerProvider` w/ Resource carrying `service.name`/`service.namespace=modular`/`deployment.environment` + `BatchSpanProcessor(OTLPSpanExporter)`; `shutdown_tracing` is None-safe), `spans.py` (`agent_span(name, run_id, tenant_id?, mode?)` ctxmgr setting `gen_ai.operation.name`/`modular.*` attrs and nesting under parent context), `callbacks.py` (`NexoTelemetryCallback` tracking per-run-id span handles, mapping LangChain `usage_metadata` total-input back into Anthropic buckets, emitting `gen_ai.{system,request.model,usage.input/output/cache_read/cache_creation/cost_usd}` + `modular.{agent,run_id,tenant_id,mode}` and `Status(ERROR)` on `on_llm_error`). Tests: 17 new (`test_pricing.py`, `test_spans.py`, `test_otel.py`, `test_callbacks.py`) attaching an `InMemorySpanExporter` to pytest-opentelemetry's pre-installed provider, filtered to `nexo.*` spans. Full suite: 175 passed, 1 skipped, 0 failed.

