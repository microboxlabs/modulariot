# Local dev: GPS webhooks (dual cluster)

Setup mirrors `skill-miot-harness` (local app + local modulith against
**coordinador-dev**), but GPS webhook routes are wired as a **StreamHub-domain**
API so they can later point at the StreamHub cluster without touching
coordinator proxies.

## Clusters

| Cluster | Context | Role |
|---------|---------|------|
| Coordinator | `AKS-MINT_COORDINADOR_BI_DEV` | Auth/orgs, Alfresco, calendar, harness, **modulith** (`dev-mintral-miot-modulith`) |
| StreamHub | `gke_streamhub-438614_us-central1_autopilot-streamhub-prod` | GPS ingest, db-writer, enrichment, symptoms, PostgREST |

Modulith (orgs + `miot_integrations`) lives on **coordinator** today.
GPS **data** (`asset_data`, `asset_client_map`) lives on **StreamHub** DB.
Webhook **product API** is built in modulith integrations; the app treats it as
StreamHub-domain via `MIOT_STREAMHUB_API_URL`.

## Prerequisites

1. **Coordinator DB tunnel** (already used by harness):

```bash
cd ~/sources/microboxlabs/db-scripts
./bin/tunnel.sh start coordinador-dev   # localhost:6433
```

2. Optional **StreamHub GPS DB** (visibility/matcher later):

```bash
./bin/tunnel.sh start prod-iot-gps      # localhost:8432  (prod positions)
# or
./bin/tunnel.sh start streamhub-dev     # localhost:9432  (miot_dev)
```

3. kubectl contexts for both clusters (secrets already pulled into gitignored envs).

## Env files (gitignored)

| File | Purpose |
|------|---------|
| `quarkus-srv/.env` | Modulith → coordinator DB + dual JWT |
| `quarkus-srv/miot-cli/.env` | Same (cwd when starting via start.sh) |
| `turbo-repo/apps/app/.env.local` | App dual backends |

### App URL split

| Variable | Points at | Auth |
|----------|-----------|------|
| `MIOT_RESOURCE_URL` | Coordinator modulith (local or remote) | User session JWT |
| `MIOT_STREAMHUB_API_URL` | StreamHub-domain modulith (local same pod for now) | `MIOT_STREAMHUB_AUTH=session` (default) or `m2m` |
| `STREAMHUB_*` | PostgREST / IoT M2M token broker | client_credentials |

GPS webhook Next routes use `forwardToStreamhubModulith` →
`MIOT_STREAMHUB_API_URL` (fallback `MIOT_RESOURCE_URL`).

WhatsApp / members / modules stay on `forwardToQuarkus` → `MIOT_RESOURCE_URL`.

### Why not always M2M for webhooks?

Org Settings uses **user JWT** so `OrganizationRequestFilter` can validate
Alfresco membership. M2M only passes when `azp`/`aud` equals
`org.tenantClientId`. Platform StreamHub M2M clients usually do **not** match
every logistic-operator org — so UI stays on `session`. Use
`MIOT_STREAMHUB_AUTH=m2m` only for service probes with a matching client.

## Run

```bash
# Terminal 1 — modulith (integrations + fleet + driver)
cd quarkus-srv
./start.sh integrations fleet driver
# → http://localhost:8180/miot

# Terminal 2 — app
cd turbo-repo
# ensure deps: npm install (once)
cd apps/app && npm run dev -- --port 3050
# → http://localhost:3050/app
```

Flyway: with `MIOT_COMPONENT_INTEGRATIONS_ENABLED=true`, local startup should
apply `V0.6.4__add_gps_webhook_subscriptions.sql` onto coordinator
`miot_integrations` (same DB as WhatsApp connections).

## Smoke checks

```bash
# Modulith health
curl -s http://localhost:8180/miot/q/health | head

# OpenAPI tag (integrations enabled)
curl -s http://localhost:8180/miot/q/openapi | grep -i gps || true

# App: login as coordinator-dev user → Settings → Organizations → GPS webhooks
```

## Moving GPS API to StreamHub later

1. Deploy modulith (or integrations worker) on StreamHub GKE with DB that has
   both `miot_integrations` and `asset_client_map` (shared Postgres decision).
2. Point app `MIOT_STREAMHUB_API_URL` at that host.
3. Keep `MIOT_RESOURCE_URL` on coordinator for orgs/WhatsApp/harness.
4. No GPS route code change — only env.

## Related

- Proxy: `turbo-repo/apps/app/src/app/api/utils/streamhub-modulith-proxy.ts`
- Coordinator proxy: `turbo-repo/apps/app/src/app/api/utils/quarkus-proxy.ts`
- StreamHub M2M helper: `turbo-repo/apps/app/src/app/api/utils/streamhub-api-client.ts`
