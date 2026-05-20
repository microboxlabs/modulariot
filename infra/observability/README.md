# Local Observability Stack — Langfuse + OTel Collector

Plan 13 (Phase B) ships a Docker Compose stack that runs Langfuse v3
self-hosted plus an OTel Collector sidecar for local development.
Production deploys are out of scope for plan 13; that lands in plan 15
(deploy target + auth).

## Bring up

Prereqs:
- Docker Desktop (or any Docker engine with Compose v2).
- ~3 GB free RAM. Containers idle around 1.5 GB; first boot ClickHouse
  + Postgres migrations spike higher.

```bash
cd infra/observability
./bootstrap.sh
```

The script:
1. `docker compose up -d` brings up:
   - `postgres` (Langfuse primary DB)
   - `clickhouse` (Langfuse analytics)
   - `redis` (Langfuse queue / cache)
   - `minio` (S3-compatible blob storage for event uploads)
   - `langfuse-web` (UI + ingest API, exposed on `:3000`)
   - `langfuse-worker` (background jobs)
   - `otel-collector` (OTLP gRPC on `:4317`, HTTP on `:4318`)
2. Polls `langfuse-web` `/api/public/health` until 200.
3. Calls Langfuse's bootstrap API to mint API keys for the
   `miot-harness-local` project.
4. Prints the keys you paste into `miot-harness/.env`.

After paste, flip telemetry on:

```dotenv
MIOT_HARNESS_OTEL_ENABLED=true
MIOT_HARNESS_OTEL_ENDPOINT=http://localhost:4317
MIOT_HARNESS_LANGFUSE_PUBLIC_KEY=pk-lf-...
MIOT_HARNESS_LANGFUSE_SECRET_KEY=sk-lf-...
```

…and restart uvicorn. The FastAPI lifespan calls `configure_tracing(...)`
and `Traceloop.init(...)` so per-agent spans + auto-instrumented LLM
calls flow to the Collector → Langfuse.

## Access

- **Langfuse UI:** http://localhost:3000
  - User: `dev@modulariot.local`
  - Password: `please-change-this` (from `LANGFUSE_INIT_USER_PASSWORD`
    in `docker-compose.yml`; **rotate before sharing the host**).
- **Collector self-metrics:** http://localhost:8888/metrics
- **Postgres (Langfuse internals):** `localhost:5432` (not exposed by
  default — uncomment the `ports:` block in compose if needed).

## Tear down

```bash
docker compose down           # keep volumes (data survives restart)
docker compose down -v        # drop volumes (full reset; Langfuse re-init)
```

## Privacy posture

This stack is **single-tenant, self-hosted, internal use only**. Full LLM
messages and tool outputs are stored in Langfuse for debug value. We do
not scrub PII at the harness boundary — that is a future SaaS-shaped
concern (plan 15+).

## Backup / restore

Volumes used:
- `postgres-data` (Langfuse traces metadata)
- `clickhouse-data` + `clickhouse-logs` (Langfuse analytics)
- `redis-data` (Langfuse ingestion queue / cache; appendonly enabled)
- `minio-data` (event payloads / blob storage)

To snapshot for migration:

```bash
docker compose stop
docker run --rm -v miot-harness-observability_postgres-data:/data \
  -v "$PWD":/backup busybox tar czf /backup/postgres.tgz -C /data .
docker run --rm -v miot-harness-observability_clickhouse-data:/data \
  -v "$PWD":/backup busybox tar czf /backup/clickhouse.tgz -C /data .
docker compose start
```

Restore is the mirror: stop, `tar xzf` back into the volume, start.

## Backend-swap recipe

If you want to point telemetry at a different backend (Honeycomb,
Datadog, Jaeger), edit `otel-collector-config.yaml`:

1. Add a new exporter under `exporters:` (e.g. `otlp/honeycomb` with
   the appropriate auth header).
2. Add it to the `traces` pipeline's `exporters:` list (fan-out — both
   Langfuse and the new backend receive the same spans).
3. `docker compose restart otel-collector`.

The harness itself stays pointed at `localhost:4317` — the Collector
abstracts the backend.

## Troubleshooting

| Symptom | Likely cause | Fix |
|---|---|---|
| `langfuse-web` won't start | ClickHouse migrations stuck | `docker compose logs clickhouse` → look for permission errors; nuke `clickhouse-data` volume if first-boot only. |
| Bootstrap prints "could not auto-provision" | LANGFUSE_INIT_* envs out of sync with running container | `docker compose down -v` then re-run `./bootstrap.sh`. |
| No spans in UI | Harness sends to wrong endpoint | Confirm `MIOT_HARNESS_OTEL_ENDPOINT=http://localhost:4317` in `.env`; check `docker compose logs otel-collector`. |
| Collector OOMs | Burst from a load test | Raise `memory_limiter.limit_percentage` in `otel-collector-config.yaml`, then restart. |
| `/api/public/health` 503 | Redis or MinIO not ready | `docker compose ps` shows which container failed; `docker compose logs <name>`. |

## What this is *not*

- **Not prod-grade.** Default passwords; no TLS; no auth on the
  Collector. Use only on developer machines.
- **Not multi-tenant.** Plan 14's AMS work expects per-tenant
  Langfuse projects; that's deploy-target work in plan 15.
- **Not retention-bounded.** Langfuse defaults to 30-day retention
  per the project setting; tune in the UI if local disk fills up.
