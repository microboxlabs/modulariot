# Open Blockers

Ralph writes here when it cannot proceed. The user clears entries by editing this file and removing them after the underlying issue is resolved.

---

## OPEN 2026-05-12 — Operator preconditions for Phase D + Phase F live verification

Three Phase D tasks (D2 live verification, D3 week of data) and three Phase F
tasks (F2/F3/F4) cannot run from inside the autonomous loop. Each needs:

  1. **`ANTHROPIC_API_KEY`** exported in the shell where uvicorn runs.
     The chat model factory raises without a live key; the lifespan
     falls back to "Nexo disabled."

  2. **SSH tunnel up** against `coordinador-prod` so asyncpg can reach
     Citus on `localhost:6432`. Bring it up via:
         ./bin/tunnel.sh coordinador-prod
     (from the db-scripts repo). Leave it running for the duration.

  3. **Docker daemon running** for the Langfuse stack (Phase B1 onwards
     and all live-verification tasks). `docker compose up -d` from
     `infra/observability/`.

When all three are in place, Ralph can run B1 onwards autonomously.
Until then, B1 (and everything downstream) is BLOCKED.

Phases A1-A6 do NOT depend on these — instrumentation foundation can
proceed without a live backend, a live DB, or a live API key (tests
use FakeListChatModel + pytest-opentelemetry's in-memory exporter).

To clear: operator brings up the three preconditions, edits this entry
to "RESOLVED YYYY-MM-DD — <one-line>", and Ralph picks up from B1.

---

## OPEN 2026-05-12 — Phase E supervisor wire-up (deferred to F-phase)

Phase E shipped 7 new modules (intent_router, mode_resolver, conversation,
agentic_graph, tenancy, meta_agent, provenance) all with TDD-green tests,
but `HarnessSupervisor` (and `api/server.py` factory) do NOT yet consume
them. The new code is an orphan island until the supervisor refactor
lands. The Phase-E code-review checkpoint flagged this as Important #1.

Specifically, the F-phase wire-up needs to do (in `runtime/supervisor.py`
and `runtime/factory.py`):

  1. Inject `LLMIntentRouter`, `InMemoryConversationStore`, and
     `build_agentic_graph(...)` into `HarnessSupervisor.__init__`.
  2. In `run()`, call `resolve_mode(request, llm_router, tenant_lock)`
     to pick the route (replaces the keyword router).
  3. Dispatch on the resolved route:
       - NEXO_QUERY    → existing `nexo_graph.ainvoke`
       - NEXO_META     → call `meta_agent_node(...)` directly (no graph)
       - NEXO_AGENTIC  → `agentic_graph.ainvoke(...)`
       - others        → existing storytelling / direct paths
  4. Hydrate / persist `conversation_id` via `ConversationStore` around
     the dispatch.
  5. Connect the executor (when implemented in `agentic_graph.py`) to
     `ProvenanceLog.append(...)` on every primitive call.

The agentic_graph itself still needs its executor / freshness_judge /
domain_analyst nodes built once the supervisor calls it for real
(plan 13 §E6 names them; current scaffold has tenancy_gate / planner
stub / synthesizer / critic stub / summarizer stub only — sufficient
for topology + per-mode telemetry tests, insufficient for F3 live
verification).

This is NOT a code-quality blocker — the modules are correct and
tested in isolation. It's a "wire two halves of the plan together"
TODO. The PR description must annotate this clearly so reviewers
don't assume `/runs` already routes via the LLM router.

To clear: when the operator preconditions above are also resolved,
the next loop iteration picks this up alongside F2/F3/F4 live
verification and lands the wire-up as part of the F-phase work.

---
