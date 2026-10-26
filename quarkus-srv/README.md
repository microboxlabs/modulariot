# ModularIoT Server

Single Quarkus monorepo that produces one container image containing all ModularIoT components. Each component can be activated/deactivated at runtime via configuration.

## Module Structure

```
miot-core/            Shared foundation (config, models, auth, messaging, persistence)
miot-content-gcs/     Content store driver for Google Cloud Storage (gcs://)
miot-fleet/           Fleet component (fleet directory)
miot-tracking/        Asset tracking (GPS ingestion via Pulsar)
miot-symptoms/        Symptoms dispatcher (CDC → RouteTable → process_symptoms_* / webhook)
miot-gateway/         Routing gateway (body-aware traffic forking, canary splits) → README
miot-integrations/    External API connections, credential profiles, auth resolution
miot-cli/             Application entrypoint
```

## Tech Stack

- **Quarkus 3.x** — CDI conditional activation, Kubernetes-native
- **Java 21**
- **PostgreSQL** — Schema-per-component via Flyway (`miot_core`, `miot_tracking`, `miot_integrations`, `miot_conversational`)
- **Hibernate Reactive + Panache**
- **Vert.x EventBus** — In-process inter-component messaging
- **Micrometer + Prometheus** — Per-client metrics with `client_id` tags
- **SmallRye OpenAPI + Swagger UI** — API documentation

## Quick Start

```bash
# Build all modules
./mvnw clean install -DskipTests

# Start with all components
./start.sh all

# Start specific components
./start.sh fleet            # fleet only
./start.sh gateway          # gateway only (no DB required)
./start.sh integrations     # integration connections and credential profiles
./start.sh symptoms         # symptoms dispatcher (RouteTable + Pulsar; GPS optional for readiness)

# Pass extra Maven/Quarkus args after --
./start.sh fleet -- -Dquarkus.http.port=9090

# Run tests
./mvnw test

# Build container image
./mvnw package -Dquarkus.container-image.build=true
```

## Component Activation

Components are **disabled by default**. Enable via master switch or individually:

```properties
# Master switch — enables all components (all-in-one mode)
miot.component.all.enabled=true

# Individual overrides — defaults to master switch value
miot.component.fleet.enabled=true
miot.component.tracking.enabled=true
miot.component.symptoms.enabled=true
miot.component.gateway.enabled=true
miot.component.integrations.enabled=true
```

Override at runtime via env vars:

```bash
# All components
MIOT_COMPONENT_ALL_ENABLED=true

# Single component
MIOT_COMPONENT_FLEET_ENABLED=true
MIOT_COMPONENT_GATEWAY_ENABLED=true
MIOT_COMPONENT_INTEGRATIONS_ENABLED=true
```

Only the schemas for enabled DB-backed components are created by Flyway. Starting with `./start.sh integrations` creates `miot_core` and `miot_integrations`. The gateway component requires no database.

## Database

Each component owns its schema. Migrations run via Flyway at startup, filtered by active components:

```
miot-core/src/main/resources/db/migration/core/             # tenants, assets (always)
miot-tracking/src/main/resources/db/migration/tracking/      # asset data, client maps, metrics, latest snapshot functions
miot-integrations/src/main/resources/db/migration/integrations/ # credential profiles, connections, operations, test/audit events
```

Migration version ranges are reserved per component so subset deployments can include only the active module locations while Flyway still has stable ordering. Take a new migration's version from its component's range, not from the highest version on trunk:

| Component | Schema | Migration range |
|-----------|--------|-----------------|
| Core | `miot_core` | `V0.1.x` |
| Retired (Alfresco fleet directory, resource core, drivers) | `miot_resource`, `miot_driver` | `V0.2.x`–`V0.4.x`, do not reuse |
| Tracking | `miot_tracking` | `V0.5.x` |
| Integrations | `miot_integrations` | `V0.6.x` |
| Conversational | `miot_conversational` | `V0.7.x` up to `V0.7.1`, then `V0.11.x` |
| Symptoms | `miot_symptoms` (also reads StreamHub `prod_iot_gps`) | `V0.8.x` up to `V0.8.5`, then `V0.12.x` |
| Fleet | `miot_fleet` (reads StreamHub `prod_iot_gps` for signals and trips) | `V0.9.x` |
| Trips | `miot_trips` | `V0.10.x` |

These migrations sit outside their component's range. They are applied, so they keep their versions; do not reuse them:

| Component | Versions |
|-----------|----------|
| Symptoms | `V0.9.2`, `V0.9.3`, `V0.9.4`, `V0.9.5`, `V0.9.7` |
| Conversational | `V0.9.6`, `V0.9.8`, `V0.10.1`, `V0.10.2` |

Conversational continues at `V0.11.x` and Symptoms at `V0.12.x`, for the same reason. Conversational's schema changed in `V0.9.6`, and a new database applies migrations in version order, so a `V0.7.x` migration that touches what `V0.9.6` created fails there. A migration must sort after every migration it depends on, whatever its component's range.

## Content store

Modules keep files (photos, signed documents) through `ContentService` in `miot-core`. Each file has a row in `miot_core.content`; modules store its id. The bytes go to the driver set by `miot.content.store`. A file is read by the driver of its URL scheme, so files written before a store change stay readable.

| Variable | Default | Purpose |
|---|---|---|
| `MIOT_CONTENT_STORE` | `fs` | Driver for new files: `fs` or `gcs` |
| `MIOT_CONTENT_FS_ROOT` | `data/content` | Directory of the `fs` driver (a volume in Kubernetes) |
| `MIOT_CONTENT_GCS_BUCKET` | — | Bucket of the `gcs` driver. Credentials come from workload identity or `GOOGLE_APPLICATION_CREDENTIALS` |
| `MIOT_CONTENT_MAX_BYTES` | `20971520` | Largest accepted file |
| `MIOT_CONTENT_TYPES` | `image/jpeg,image/png,image/webp,image/heic,application/pdf` | Accepted types. The first bytes must match the declared type |

A file that no record took within 24 hours (`miot.content.unowned-grace`) is deleted every hour.

The cleanup locks each selected row until its bytes have been deleted, and keeps failed deletions for a later run. Uploads inside a `PgTx` transaction register file removal on transaction or savepoint rollback.

The filesystem root is a trusted service directory. New `fs://.content-...` URLs name direct files under that root; URL components are never used as parent directories. Older hierarchical URLs require `SecureDirectoryStream` support (available on the Linux default provider), and fail closed on providers without it. File reads do not follow symbolic links.

## API Documentation

When running in dev mode, Swagger UI is available at:

- **Swagger UI**: http://localhost:8180/q/swagger-ui/
- **OpenAPI spec**: http://localhost:8180/q/openapi

Endpoints are grouped by component tag (Asset Tracking, Integration Connections, Control Tower). Only enabled components appear in the spec.

## Endpoints

| Component | Endpoint | Description |
|-----------|----------|-------------|
| Fleet | `GET /api/v1/orgs/{organizationId}/fleet/assets` | Assets of the organization, with filters and counts |
| Fleet | `GET /api/v1/orgs/{organizationId}/fleet/assets/{assetId}` | One asset: fields and their source, trips, documents, indicators |
| Fleet | `GET /api/v1/orgs/{organizationId}/fleet/assets/{assetId}/activity` | Daily engine hours, idle time and distance |
| Fleet | `PATCH /api/v1/orgs/{organizationId}/fleet/assets/{assetId}` | Set or clear fields and document dates |
| Fleet | `POST /api/v1/orgs/{organizationId}/fleet/assets/{assetId}/suggestions/{kind}/accept\|dismiss` | Apply or hide a suggestion |
| Tracking | `POST /api/v1/asset/track` | Ingest GPS position |
| Integrations | `GET /api/v1/orgs/{organizationId}/integrations/connections` | List integration connections |
| Integrations | `POST /api/v1/orgs/{organizationId}/integrations/connections` | Create an integration connection |
| Integrations | `GET /api/v1/orgs/{organizationId}/integrations/credential-profiles` | List credential profiles |
| Integrations | `POST /api/v1/orgs/{organizationId}/integrations/credential-profiles` | Create a credential profile |
| Gateway | `POST /{path}` | APISIX mirror receiver (any path) |
| Gateway | `GET /internal/fork/rules` | List fork rules and filter sizes |
| Gateway | `POST /internal/fork/rules/{id}/filter` | Add routing keys to in-memory filter |
| Gateway | `DELETE /internal/fork/rules/{id}/filter/{key}` | Remove a routing key |
| Gateway | `POST /internal/fork/rules/{id}/filter/reload` | Reload filter from ConfigMap file |
| Health | `GET /q/health` | Health check (component status) |
| Metrics | `GET /q/metrics` | Prometheus metrics |

## Docker

```bash
docker build -t miot:latest .
docker run -e MIOT_COMPONENT_ALL_ENABLED=true miot:latest        # all-in-one
docker run -e MIOT_COMPONENT_FLEET_ENABLED=true miot:latest      # fleet only
```

## License

Apache 2.0
