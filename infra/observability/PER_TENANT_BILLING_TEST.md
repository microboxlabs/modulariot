# Per-tenant billing — manual end-to-end test

This document walks through the live verification of the per-tenant
telemetry surface (E10 + supervisor wire-up + NEXO_META gap fix + cost
CLI). Follow it any time you want to confirm that:

- Every trace and observation carries `tenant:<id>` and `mode:<m>` tags
  alongside `langfuse.user.id` / `langfuse.session.id`.
- Langfuse's UI filter sidebar lights up by tenant.
- The cost CLI (`python -m miot_harness.observability.report`) returns
  per-tenant cost numbers against the running stack.
- The NEXO_META observation-level attribution gap stays closed
  (inner LLM call carries `tenant:`, not just the root trace).

Open three terminals — `T1` for the tunnel, `T2` for uvicorn, `T3`
for the test commands.

All paths below are **relative to the repo root**. Set the env var
once in every terminal you'll use:

```bash
export REPO_ROOT="$(git rev-parse --show-toplevel)"     # from inside the repo
# …or hand-set if you're outside, e.g.
# export REPO_ROOT=/path/to/your/modulariot-checkout
```

---

## Prerequisites

- Docker Desktop running with the Langfuse stack up:
  ```bash
  cd "$REPO_ROOT/infra/observability"
  docker compose ps
  ```
  All 7 services must show `Up (healthy)`.
- `miot-harness/.env` populated with `ANTHROPIC_API_KEY`,
  `MIOT_HARNESS_NEXO_DB_SCRIPTS_ROOT`, `MIOT_HARNESS_NEXO_DB_ALIAS`,
  `MIOT_HARNESS_OTEL_ENABLED=true`, and the freshness overrides
  (`MIOT_HARNESS_NEXO_FRESHNESS_REFUSE_MINUTES=10000`, same for
  `MIOT_HARNESS_NEXO_FRESHNESS_WARN_MINUTES`).

---

## Step 1 — Bring up the SSH tunnel (T1)

From your local checkout of the `db-scripts` repo (this is a
**separate repo**, not part of `modulariot` — adjust path to wherever
you cloned it):

```bash
cd "${DB_SCRIPTS_ROOT:?set DB_SCRIPTS_ROOT to your db-scripts checkout}"
./bin/tunnel.sh open coordinador-prod
```

Expected: `"Port 6434 is already open"` (tunnel was running) or
`"Started tunnel on port 6434"` (fresh start). **Leave T1 attached.**

Verify from any other shell:

```bash
nc -z localhost 6434 && echo "tunnel UP"
```

---

## Step 2 — Boot uvicorn with the new code (T2)

```bash
cd "$REPO_ROOT/miot-harness"

# Kill any stale worker that booted without the tunnel
pkill -f "uvicorn miot_harness" 2>/dev/null

# Start fresh (stays attached so you can watch per-request logs)
uv run uvicorn miot_harness.api.server:create_app --factory --host 127.0.0.1 --port 8000
```

Wait for:

- `INFO: Application startup complete.`
- `Nexo: Phase E wired (LLM router=claude-haiku-4-5, agentic_graph, meta_agent)`

**Stay attached to T2.** Each `POST /runs` prints a log line here.

---

## Step 3 — Health check (T3)

```bash
curl -sS http://127.0.0.1:8000/health | python3 -m json.tool
```

Expected:

```json
{
  "status": "ok",
  "env": "local",
  "nexo": {
    "enabled": true,
    "tools": ["coordinador_auditoria_pod", "coordinador_centro_control", ...],
    "snapshot_age_minutes": <some number>
  }
}
```

If `"enabled": false`, the tunnel isn't reachable — go back to Step 1.

---

## Step 4 — Fire runs across multiple tenants and users (T3)

Three different combinations exercise canned mode, explicit meta mode,
and the AUTO router. Two `tenant_id`s (`mintral`, `gama`) and three
`user_id`s (`odtorres`, `alice`, `bob`).

```bash
# Mintral / odtorres — canned route via auto router
curl -sS -X POST http://127.0.0.1:8000/runs \
  -H 'Content-Type: application/json' \
  -d '{"message":"estado del coordinador hoy","tenant_id":"mintral","user_id":"odtorres"}' \
  | python3 -c "import json,sys;r=json.load(sys.stdin);print('run:',r['run_id'],'| status:',r['status'])"

# Gama / alice — explicit meta mode (closes NEXO_META observation-level gap)
curl -sS -X POST http://127.0.0.1:8000/runs \
  -H 'Content-Type: application/json' \
  -d '{"message":"what data do you have?","tenant_id":"gama","user_id":"alice","mode":"meta"}' \
  | python3 -c "import json,sys;r=json.load(sys.stdin);print('run:',r['run_id'],'| status:',r['status'])"

# Mintral / bob — canned mode bypassing the router
curl -sS -X POST http://127.0.0.1:8000/runs \
  -H 'Content-Type: application/json' \
  -d '{"message":"cola crítica","tenant_id":"mintral","user_id":"bob","mode":"canned"}' \
  | python3 -c "import json,sys;r=json.load(sys.stdin);print('run:',r['run_id'],'| status:',r['status'])"
```

Expected: three `completed` rows. Wait ~5 seconds for the OTel
Collector to batch-flush to Langfuse.

---

## Step 5 — Verify in the Langfuse UI

1. Open http://localhost:3000 → log in as
   `dev@modulariot.local` / `please-change-this`.
2. Project menu top-left → **miot-harness-local** → **Tracing**.
3. In the **Filters** sidebar, expand **Tags**. Expected chips:
   - `tenant:mintral`, `tenant:gama`
   - `mode:auto`, `mode:meta`, `mode:canned`
   - `route:nexo_query`, `route:nexo_meta`
   - `agent:filter_expert`, `agent:synthesizer`, `agent:meta_agent`
4. **Click `tenant:mintral`** — list filters to 2 runs.
   - `User ID = odtorres` on one row, `User ID = bob` on the other.
   - `Total Cost` column shows USD per run.
5. **Sort by `Total Cost` desc** — top spender visible.
6. **Click `tenant:gama`** alone — only Alice's meta run appears.
7. **Combine filters** (`tenant:mintral` + `User ID` filter `=odtorres`)
   — cost-per-user-per-tenant view.
8. **Users page** (project menu → Users) — one row per `user_id`
   with lifetime cost + trace count.

---

## Step 6 — Cost-report CLI (T3)

```bash
# Find your local stack's keys (they're set by LANGFUSE_INIT_PROJECT_*_KEY
# envs in infra/observability/docker-compose.yml; bootstrap.sh prints them
# on every run).
export MIOT_HARNESS_LANGFUSE_PUBLIC_KEY=$(
  grep LANGFUSE_INIT_PROJECT_PUBLIC_KEY "$REPO_ROOT/infra/observability/docker-compose.yml" \
    | head -1 | awk '{print $2}'
)
export MIOT_HARNESS_LANGFUSE_SECRET_KEY=$(
  grep LANGFUSE_INIT_PROJECT_SECRET_KEY "$REPO_ROOT/infra/observability/docker-compose.yml" \
    | head -1 | awk '{print $2}'
)

cd "$REPO_ROOT/miot-harness"
uv run python -m miot_harness.observability.report --since 1h --by tenant
```

Expected output shape (numbers will vary):

```
  #  TENANT                COST_USD       INPUT      OUTPUT      N
  1  mintral               0.012345           0           0      2
  2  gama                  0.001100           0           0      1
```

Switch grouping or output format:

```bash
uv run python -m miot_harness.observability.report --since 1h --by mode
uv run python -m miot_harness.observability.report --since 1h --by agent
uv run python -m miot_harness.observability.report --since 1h --by tenant --format json
```

The `--format json` form is what you'd pipe into a billing system.

Token columns are 0 at trace level — Langfuse v3 stores token counts
on observations, not trace rows. Cost is correct; tokens require a
follow-up observation-level fetcher.

---

## Step 7 — Verify the NEXO_META gap stays closed

The inner LLM call in meta mode must carry the tenant tag at the
**observation** level (not just the root trace). Before E10's
supervisor wrap fix, this was missing.

```bash
docker exec miot-obs-clickhouse clickhouse-client \
  --user clickhouse --password clickhouse \
  --query "
SELECT
  name,
  JSONExtractString(metadata['attributes'], 'modular.tenant_id') AS tenant_id,
  JSONExtractString(metadata['attributes'], 'modular.agent') AS agent
FROM observations
WHERE project_id = 'miot-harness-local'
  AND name = 'nexo.meta_agent'
ORDER BY start_time DESC
LIMIT 3
FORMAT PrettyCompact;"
```

Expected — Alice's `gama` run shows up with `agent = meta_agent`:

```
   ┌─name────────────┬─tenant_id─┬─agent──────┐
1. │ nexo.meta_agent │ gama      │ meta_agent │
   └─────────────────┴───────────┴────────────┘
```

If `tenant_id` is empty, the gap regressed — re-check
`runtime/supervisor.py`'s `_run_nexo_meta` and confirm it calls
`instrument_model(self.meta_model, "meta_agent", ctx)` before
`meta_agent_node(...)`.

---

## Step 8 — ClickHouse SQL for billing exports

The query a cron-job or billing pipeline would run. Langfuse v3 keeps
`total_cost` on **observations** (one LLM call), and the `tenant:`
tag on the **trace** row — so the rollup joins the two tables:

```bash
docker exec miot-obs-clickhouse clickhouse-client \
  --user clickhouse --password clickhouse \
  --query "
SELECT
  arrayJoin(t.tags) AS tag,
  count(DISTINCT t.id) AS n_traces,
  round(sum(o.total_cost), 6) AS cost_usd
FROM traces t
JOIN observations o ON o.trace_id = t.id AND o.project_id = t.project_id
WHERE t.project_id = 'miot-harness-local'
  AND startsWith(tag, 'tenant:')
  AND t.timestamp >= now() - INTERVAL 1 DAY
GROUP BY tag
ORDER BY cost_usd DESC
FORMAT PrettyCompact;"
```

Expected: one row per `tenant:<id>` tag seen in the window, with its
trace count and total USD cost (computed by summing observation-level
costs grouped by their parent trace's tag).

---

## Step 9 (optional) — Persistent dashboard

Follow `dashboards/per-tenant-cost.md` step-by-step (~2 minutes in the
Langfuse UI) to build a **Per-tenant cost** widget on a dashboard.
After save, the dashboard renders one bar per tenant with the summed
cost — no filtering required.

---

## Pass / fail checklist

The test passes when ALL of the following are true:

- [ ] Step 3: `/health` reports `nexo.enabled=true` with tools listed.
- [ ] Step 4: Three runs return `status: completed`.
- [ ] Step 5: Langfuse UI Filters sidebar shows `tenant:mintral`,
      `tenant:gama`, and `User ID` chips populate per run.
- [ ] Step 6: `--by tenant` CLI prints both tenants with non-zero
      `COST_USD` columns sorted descending.
- [ ] Step 7: ClickHouse query returns at least one
      `nexo.meta_agent` row with `tenant_id = gama` (not empty).
- [ ] Step 8: ClickHouse `traces.tags` aggregate matches the CLI
      totals (modulo rounding).

If any item fails, capture the failing output and re-check the
corresponding source file:

| Failed item | First file to inspect |
|---|---|
| Step 3 nexo disabled | `miot-harness/.env` (tunnel + Nexo settings) |
| Step 5 tags missing | `observability/spans.py`, `observability/callbacks.py` |
| Step 6 CLI errors out | `MIOT_HARNESS_LANGFUSE_*` env vars in T3 |
| Step 7 tenant empty for meta | `runtime/supervisor.py:_run_nexo_meta` |

---

## Related docs

- `infra/observability/README.md` — stack bring-up, privacy posture,
  the same per-tenant rollup flow at a glance.
- `infra/observability/dashboards/per-tenant-cost.md` — persistent
  dashboard build procedure.
- `miot-harness/src/miot_harness/observability/report.py` — the
  CLI's projection + fetcher source.
