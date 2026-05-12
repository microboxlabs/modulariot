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
