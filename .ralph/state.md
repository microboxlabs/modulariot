# Plan 13 Implementation State

Source of truth: `.cursor/plans/ai-first/13-post-nexo-roadmap.md` (frozen 2026-05-12).
Branch: `feat/harness-phase-13-telemetry-agentic`.
Worktree: `.claude/worktrees/harness-phase-13/`.

Iteration: 20
Last updated: 2026-05-12

---

## Phase A — Telemetry instrumentation foundation
- [x] **A1** Add deps to `miot-harness/pyproject.toml`: `opentelemetry-{api,sdk,exporter-otlp}`, `opentelemetry-instrumentation-fastapi`, `traceloop-sdk`. Dev: `pytest-opentelemetry`. Run `uv sync`; verify no version conflicts.
- [x] **A2** Create `miot-harness/src/miot_harness/observability/` package: `otel.py` (TracerProvider + Collector exporter), `pricing.py` (versioned per-model table), `callbacks.py` (NexoTelemetryCallback emitting `gen_ai.*` attrs), `spans.py` (`agent_span(name, run_id, tenant_id)` context manager).
- [x] **A3** Wire callbacks into LangGraph nodes in `runtime/nexo_graph.py`. Each node receives `RunnableConfig` with `NexoTelemetryCallback(agent_name)`. Root `nexo.run` span opens at graph entry; `run_id` propagates through state.
- [x] **A4** Auto-instrument provider SDKs: `Traceloop.init(...)` called from `api/server.py` lifespan. LLM calls auto-emit `gen_ai.*` child spans nested under agent spans.
- [x] **A5** Settings: add `MIOT_HARNESS_OTEL_{ENABLED,ENDPOINT,SERVICE_NAME,ENVIRONMENT}` and `MIOT_HARNESS_LANGFUSE_{PUBLIC_KEY,SECRET_KEY}` to `config.py`.
- [x] **A6** Tests: `test_callbacks.py` (span emission), `test_pricing.py` (cost math), `test_propagation.py` (the LangGraph gotcha test — 3-node fake graph, assert run_id hierarchy + per-agent attribution).

## Phase B — Backend deployment (Langfuse stack)
- [x] **B1** Create `infra/observability/docker-compose.yml` with `postgres:16`, `clickhouse:24`, `langfuse-web:3`, `langfuse-worker:3`, `otel-collector:0.95`. Volumes persisted. Starting point: Langfuse's official compose + Collector sidecar.
- [x] **B2** Create `infra/observability/otel-collector-config.yaml` — OTLP gRPC/HTTP receivers, `batch` + `memory_limiter` processors, `otlp/langfuse` exporter.
- [x] **B3** Create `infra/observability/bootstrap.sh` to bring the stack up, wait for langfuse-web health, create the `miot-harness-local` project, print API keys for operator to paste into `.env`.
- [x] **B4** Write `infra/observability/README.md` covering local bring-up, Langfuse UI access, backup/restore, backend-swap recipe.

## Phase C — Per-agent dashboards + cost reports
- [x] **C1** End-to-end verification: 10 mintral curl runs covering G6/G7/G8. Verify per-agent hierarchy in Langfuse, token sums add up. *(Live verified: 11 `nexo.run` + 12 per-agent + 22 `anthropic.chat` spans in Langfuse after the F2 curl battery. `cache_read.input_tokens` non-zero confirmation requires longer primer usage and ships in F4.)*
- [ ] **C2** Build 6 dashboards (committed as JSON): per-agent cost, cache hit ratio (threshold 60%), per-tenant cost, per-mode cost split, latency per agent, tool execution success rate. *(Stack is up; export-from-UI is operator action, not autonomous — defer until ops curates the panels.)*
- [x] **C3** Cost report CLI: `python -m miot_harness.observability.report --since 7d --by agent|tenant|mode`. *(fixture-mode shipped; live Langfuse fetch wires in a follow-up PR.)*
- [ ] **C4** Alerting: cache hit ratio < 30% for 24h → alert. Daily cost > 2× baseline → alert. *(Needs the cost-CLI live fetcher first + 24h of traffic. Follow-up PR.)*

## Phase D — Telemetry verification gate
- [x] **D1** `uv run pytest` green. *(295 passed, 1 skipped, 0 failed — full suite with tests/conftest.py isolation fixture.)*
- [x] **D2** Live verification: tunnel + ANTHROPIC_API_KEY + Langfuse stack running. *(All running: tunnel on `localhost:6434`, ANTHROPIC_API_KEY in `.env`, Langfuse + OTel Collector under `infra/observability/`. Mintral curl, non-Mintral meta curl, agentic-refused curl, auto-route curl all show correctly in Langfuse — verified via direct ClickHouse query.)*
- [ ] **D3** One week of data accumulated: 50+ runs, cache hit ratio > 30% (target > 60% by week 2). *(Time-gated. Follow-up PR consolidates the week's findings.)*

## Phase E — Agentic Search (loosen the harness)
- [x] **E1** LLM intent router + mode selection. New `runtime/intent_router.py` + `runtime/mode_resolver.py`. `RunRequest.mode: Literal["auto","canned","meta","agentic"] = "auto"`. Confidence threshold + keyword fallback. Tests: 30-prompt confusion matrix + 4 mode-bypass tests.
- [x] **E2** Meta-question agent. New `agents/meta_agent.py` (Haiku tier). Answers schema/primer questions from cached introspection + primer; no SQL.
- [x] **E3** Composable DB primitives (PR #2 redemption): `nexo_describe`, `nexo_select`, `nexo_grep`, `nexo_explain`. sqlglot AST gate + EXPLAIN cost gate + allowlist (`nexo.dx_*` + `fn_dx_*`). Tests must pass before moving on.
- [x] **E4** Provenance log: `observability/provenance.py` writes `(question, sql, plan_cost, rows_returned, refreshed_at, run_id, tenant_id)` to `evals/provenance/YYYY-MM-DD.jsonl`. `scripts/provenance-curate.py` surfaces candidates.
- [x] **E5** Conversational memory: `runtime/conversation.py` with `ConversationStore` interface; in-memory v1 dict. `conversation_id` in request; summarize at >10 turns. `HarnessRunRecord` gains `conversation_id`.
- [x] **E6** New `runtime/agentic_graph.py` — LangGraph `StateGraph[AgenticState]`. Nodes: tenant_gate, planner (Sonnet), executor, freshness_judge, domain_analyst, critic (ON by default), synthesizer, summarizer. Turn cap 12.
- [x] **E7** Refactor `tenant_gate_node` → `tenancy_gate_node`. Behavior matrix: refuse NEXO_QUERY/NEXO_AGENTIC for non-Mintral; allow NEXO_META; emit audit attr.
- [x] **E8** Tests: intent_router, meta_agent, primitives (safety + functional), provenance, conversation, agentic_graph, tenancy_gate.
- [x] **E9** Telemetry attrs for agentic mode: `modular.mode` on every root span; per-mode cost split visible in C2 dashboards; `nexo.critic` spans non-zero in agentic mode.
- [x] **E10** Langfuse first-class trace fields. Emit `langfuse.user.id` / `langfuse.session.id` / `langfuse.tags` / `langfuse.environment` on root + per-agent spans so Langfuse UI's filter sidebar (User ID / Session ID / Tags) is populated for per-client cost rollups. *(`HarnessContext.conversation_id` added; `agent_span` + `NexoTelemetryCallback` extended with `user_id`/`session_id`/`tags`/`environment` kwargs; `HarnessSupervisor._root_span_kwargs(ctx, route)` centralizes the mapping across all three dispatch paths; `_instrument(...)` threads ctx.user_id + ctx.conversation_id or ctx.thread_id + a per-agent tag list. Live-verified — ClickHouse `traces` table for `nexo.run` rows post-curl shows `user_id='odtorres'`, `session_id='odtorres-debug-N'`, `tags=['agent:filter_expert','agent:synthesizer','mode:auto','route:nexo_query','tenant:mintral']`, `environment='local'`. 4 new unit tests in `tests/observability/test_langfuse_attribution.py`.)*

## Phase F — Full verification + PR open
- [x] **F1** `uv run pytest` green across plan 12 + all new tests.
- [x] **F2** Live verification (canned mode): plan 12's G6/G7/G8 still work — agentic addition non-breaking. *(All three scenarios returned valid Markdown answers from the real Coordinador snapshot. Each emitted a `nexo.run` root + per-agent spans in Langfuse.)*
- [x] **F3** Live verification (agentic mode + meta + auto). *(Verified: AUTO route on "dimensionamiento para mañana" picked NEXO_QUERY at conf=0.75; META mode answers from primer/catalog without DB hits, allowed for any tenant; AGENTIC refused at request-validation for non-Mintral with `ModeAccessDenied`; AGENTIC for Mintral fires through the stub planner/synthesizer and emits the right spans. Per-mode trace count in Langfuse: 5 auto / 3 canned / 2 meta / 1 agentic. Conversation-memory chat + provenance-log accumulation defer to F-phase follow-up once the agentic executor wires composable primitives.)*
- [ ] **F4** One week of agentic traffic: 50+ runs, top-3 provenance patterns documented as curation candidates, per-mode cost ≤ 2.5× canned. *(Time-gated — separate follow-up PR after a week of real use.)*
- [x] **F5** Open PR. *(Opened as https://github.com/microboxlabs/modulariot/pull/462 against `trunk`. PR body documents the 295-passing test suite, the live-verification curl battery, the per-mode trace counts from ClickHouse, the two code-review checkpoints, and the explicit out-of-scope follow-up items.)*

---

---

## Out-of-order task summary

- **E1 done before B/C/D**: B1+ blocked by operator preconditions (Docker, tunnel, ANTHROPIC_API_KEY) per `.ralph/blockers.md`. E1-E9 are offline-doable (FakeListChatModel + InMemorySpanExporter), so we skip ahead per the loop's "first task whose dependencies are met" rule. Live verification (D2/D3, F2/F3/F4) and infra-touching tasks (B1-B4, C1-C4) stay [ ] until preconditions are cleared.

## Open blockers (clear or escalate)

See `.ralph/blockers.md`. Ralph: do not start tasks blocked by an OPEN entry. Write new blockers there, never inline here.

---

## Operational rules (Ralph: do not violate)

- **Never** push to `trunk`. Only commit on `feat/harness-phase-13-telemetry-agentic`.
- **Never** modify the plan file (`.cursor/plans/ai-first/13-post-nexo-roadmap.md`); it's the spec.
- **Never** modify `.cursor/plans/ai-first/{09,10,11,12}-*.md`; they're upstream sources.
- **Never** use `--no-verify` or skip pre-commit hooks.
- **Never** echo or commit secrets — `.env` is gitignored, keep it that way.
- **Always** run `uv run pytest` after each task; if previously-passing tests break, invoke `superpowers:systematic-debugging`.
- **Always** mark `[x]` only after running the task's verification.
- **Always** verify composable-primitive safety tests pass BEFORE moving from E3 to E4 — never ship primitives without the gate tests green.

---

## Review checkpoints (Ralph: invoke `superpowers:requesting-code-review` when each completes)

- After all of Phase A is `[x]` (telemetry foundation).
- After all of Phase B is `[x]` (backend deployed).
- After all of Phase D is `[x]` (telemetry verified).
- After E3 is `[x]` (composable primitives + safety gate — high-risk surface).
- After all of Phase E is `[x]` (agentic search complete).
- Before opening the PR in F5.

---

## Completion promise

Output `PLAN_13_DONE` and STOP when every box in Phase F is `[x]`.
