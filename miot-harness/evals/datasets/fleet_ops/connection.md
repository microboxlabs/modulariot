---
name: fleet
backend: pg
dsn_env: MIOT_HARNESS_FLEET_DSN
required: false
options:
  schemas: [ops, telemetry]
  # tenant_lock: <the tenant allowed to use it>
  statement_timeout_ms: 15000
  explain_cost_threshold: 200000
capabilities:
  curated: false
  generic_query: true
---

# Fleet operations (schemas `ops`, `telemetry`)

Operational data for a road-freight operation: transport services and their
workflow, pre-trip checks, the registered fleet, and GPS trip summaries.
Read-only. The table catalog is discovered automatically.
