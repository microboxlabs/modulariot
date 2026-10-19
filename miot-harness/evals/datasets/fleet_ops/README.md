# fleet_ops synthetic dataset

Raw operational tables for a road-freight operation, generated with fixed
problems a data team has to handle before a KPI is right: reopened services,
tractor swaps, missing telemetry, missing checks, elapsed time that includes
stops, and excluded symptom types. It backs the `analytics` chat eval suite.

| File | Purpose |
|---|---|
| `generate.py` | Writes the schema and data as SQL (deterministic per `--seed` and `--now`) |
| `truth.sql` | The correct answers the `analytics` cases expect |
| `connection.md` | A harness connection for the dataset |

## Load it locally

```bash
uv run python evals/datasets/fleet_ops/generate.py --now 2026-09-28T03:00:00+00:00 > /tmp/fleet_ops.sql
createdb fleet_demo
psql -d fleet_demo -f /tmp/fleet_ops.sql
psql -d fleet_demo -c "CREATE ROLE fleet_reader LOGIN PASSWORD 'fleet_reader'"
psql -d fleet_demo -c "GRANT USAGE ON SCHEMA ops, telemetry TO fleet_reader;
  GRANT SELECT ON ALL TABLES IN SCHEMA ops, telemetry TO fleet_reader;
  ALTER ROLE fleet_reader SET default_transaction_read_only = on"
```

`fleet_reader` is a local test role. The expected numbers in
`src/miot_harness/evals/analytics_cases.yaml` match `--seed 7` and the `--now`
above; change either and rerun `truth.sql` to update them.

## Run the suite

Start a harness whose connections directory holds only `connection.md` (copy it
to `<dir>/fleet/connection.md`), with
`MIOT_HARNESS_FLEET_DSN=postgresql://fleet_reader:fleet_reader@localhost:5432/fleet_demo`,
then:

```bash
uv run miot-harness-chat-evals --suite analytics --port <harness port> --tenant-id "$TENANT"
```
