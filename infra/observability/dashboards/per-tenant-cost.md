# Per-tenant cost dashboard (plan 13 §C2 — 1 of 6)

This file ships the **build procedure** for the per-tenant cost widget
rather than a JSON export. Langfuse v3's dashboard schema lives across
two Postgres tables (`dashboards` + `dashboard_widgets`) with internal
foreign keys and no stable public import API yet, so a committed JSON
file would be brittle on first import to a fresh stack. Once Langfuse
publishes a dashboard-import endpoint, we'll switch this file for the
JSON export.

## Build the widget in the Langfuse UI (~2 min)

1. Open http://localhost:3000 → log in as `dev@modulariot.local`.
2. Project menu → **Dashboards** → **+ New widget**.
3. Configure:
   - **Name:** `Per-tenant cost (7d)`
   - **Description:** `Sums calculatedTotalCost grouped by tenant: tag.`
   - **View:** `TRACES`
   - **Dimensions:** `tags`
   - **Filters:**
     - `tags` `regex` `^tenant:`
   - **Metrics:** `Sum of total_cost`
   - **Chart type:** `Horizontal bar`
   - **Time window:** `Last 7 days` (or whatever billing window you want)
4. **Save**.
5. Project menu → **Dashboards** → **+ New dashboard** → drop the widget
   onto a 4×3 grid cell. Save as `Per-tenant cost`.

That dashboard now renders one bar per `tenant:<id>` tag with the
summed cost. Click any bar to drill into the underlying traces.

## ClickHouse query (power-user fallback)

If you'd rather aggregate from the raw store (e.g. for a billing export
that's separate from the UI), run this directly against the local
ClickHouse:

Note: Langfuse v3 stores `total_cost` per **observation** (one LLM call),
not per trace; the `tenant:` tag lives on the trace row. The query
joins the two tables to roll cost up by tag:

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
  AND t.timestamp >= now() - INTERVAL 7 DAY
GROUP BY tag
ORDER BY cost_usd DESC
FORMAT PrettyCompact;"
```

Sample output (from a stack with two tenants):

```
   ┌─tag────────────┬─n_traces─┬─cost_usd─┐
1. │ tenant:mintral │        4 │ 0.078648 │
2. │ tenant:gama    │        1 │ 0.008334 │
   └────────────────┴──────────┴──────────┘
```

## CLI alternative

```bash
MIOT_HARNESS_LANGFUSE_PUBLIC_KEY=pk-lf-…  MIOT_HARNESS_LANGFUSE_SECRET_KEY=sk-lf-… \
  uv run python -m miot_harness.observability.report --since 7d --by tenant
```

Same data, prints as text or JSON (`--format json`). See
`miot-harness/src/miot_harness/observability/report.py` for the
projection logic.
