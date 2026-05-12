# Open Blockers

Ralph writes here when it cannot proceed. The user clears entries by editing this file and removing them after the underlying issue is resolved.

---

## RESOLVED 2026-05-12 — Operator preconditions for Phase D + Phase F live verification

Originally OPEN: needed `ANTHROPIC_API_KEY`, SSH tunnel to coordinador-prod, and a Docker daemon for the Langfuse stack.

Cleared via a live bring-up session (commits `b3dee407` and the in-session `infra/observability/` debugging):

- Docker Desktop installed; `docker compose up -d` from `infra/observability/`
  brings up all 7 services (postgres / clickhouse / redis / minio / langfuse-web /
  langfuse-worker / otel-collector) cleanly. ClickHouse healthcheck switched
  to `127.0.0.1` to avoid the macOS IPv6-loopback trap; Langfuse
  `ENCRYPTION_KEY` replaced with a real `openssl rand -hex 32` value;
  `CLICKHOUSE_CLUSTER_ENABLED=false` added so single-node ClickHouse skips
  ZooKeeper; `LANGFUSE_INIT_PROJECT_{PUBLIC,SECRET}_KEY` baked in so the
  API keys are deterministic and re-runnable.
- SSH tunnel up via `./bin/tunnel.sh open coordinador-prod` (local
  port `6434`, mapping to Citus pgbouncer remote port `6432`).
- `ANTHROPIC_API_KEY` present in `miot-harness/.env`; harness boots
  with `nexo.enabled=true` and the full curated tool list registered.

---

## RESOLVED 2026-05-12 — Phase E supervisor wire-up

Originally OPEN: `HarnessSupervisor` did not consume `resolve_mode`,
`LLMIntentRouter`, `agentic_graph`, `meta_agent_node`, or
`InMemoryConversationStore`.

Cleared in commit `a63fd949` (1A). `HarnessSupervisor.__init__` now
accepts the Phase-E modules as optional kwargs; `run()` resolves the
route via `resolve_mode(...)` and dispatches to nexo_graph /
agentic_graph / meta_agent_node / storytelling per the route.
`conversation_id` round-trips via `ConversationStore`. The FastAPI
lifespan in `api/server.py` injects all five Phase-E modules once
the Nexo boot path succeeds; the keyword-router path stays intact
when Nexo is disabled. 7 new tests under
`tests/runtime/test_supervisor_phase_e.py` cover the dispatch tree,
the agentic-non-Mintral refusal, the auto-mode delegation, the
conversation round-trip, and the backward-compat keyword-only
construction.

---
