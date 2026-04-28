# ModularIoT Server

Single Quarkus monorepo that produces one container image containing all ModularIoT components. Each component can be activated/deactivated at runtime via configuration.

## Module Structure

```
miot-core/            Shared foundation (config, models, auth, messaging, persistence)
miot-resource-core/   Shared SDK (entity events, KPI interfaces, resolution, Alfresco client, metrics)
miot-fleet/           Fleet directory (vehicles, trucks, trailers, carriers)
miot-driver/          Driver directory (lifecycle, documents, compliance, scoring)
miot-tracking/        Asset tracking (GPS ingestion via Pulsar)
miot-gateway/         Routing gateway (body-aware traffic forking, canary splits) → README
miot-integrations/    External API connections, credential profiles, auth resolution
miot-cli/             Application entrypoint
```

## Tech Stack

- **Quarkus 3.x** — CDI conditional activation, Kubernetes-native
- **Java 21**
- **PostgreSQL** — Schema-per-component via Flyway (`miot_core`, `miot_resource`, `miot_fleet`, `miot_driver`, `miot_tracking`, `miot_integrations`)
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
./start.sh driver           # driver only
./start.sh fleet driver     # fleet + driver
./start.sh gateway          # gateway only (no DB required)
./start.sh integrations     # integration connections and credential profiles

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
miot.component.driver.enabled=true
miot.component.tracking.enabled=true
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

Only the schemas for enabled DB-backed components are created by Flyway. Starting with `./start.sh fleet` will create `miot_core`, `miot_resource`, and `miot_fleet` schemas — but not `miot_driver`. Starting with `./start.sh integrations` creates `miot_core`, `miot_resource`, and `miot_integrations`. The gateway component requires no database.

## Database

Each component owns its schema. Migrations run via Flyway at startup, filtered by active components:

```
miot-core/src/main/resources/db/migration/core/             # tenants, assets (always)
miot-resource-core/src/main/resources/db/migration/resource/ # entity events, scores, sync cursors, links, profiles (always)
miot-fleet/src/main/resources/db/migration/fleet/            # vehicles, trips, trucks, trailers, carriers
miot-driver/src/main/resources/db/migration/driver/          # drivers
miot-tracking/src/main/resources/db/migration/tracking/      # asset data, client maps, metrics, latest snapshot functions
miot-integrations/src/main/resources/db/migration/integrations/ # credential profiles, connections, operations, test/audit events
```

Migration version ranges are reserved per component so subset deployments can include only the active module locations while Flyway still has stable ordering:

| Component | Schema | Migration range |
|-----------|--------|-----------------|
| Core | `miot_core` | `V0.1.x` |
| Fleet | `miot_fleet` | `V0.2.x` |
| Resource Core | `miot_resource` | `V0.3.x` |
| Driver | `miot_driver` | `V0.4.x` |
| Tracking | `miot_tracking` | `V0.5.x` |
| Integrations | `miot_integrations` | `V0.6.x` |

## API Documentation

When running in dev mode, Swagger UI is available at:

- **Swagger UI**: http://localhost:8180/q/swagger-ui/
- **OpenAPI spec**: http://localhost:8180/q/openapi

Endpoints are grouped by component tag (Fleet, Drivers, Asset Tracking, Integration Connections). Only enabled components appear in the spec.

## Endpoints

| Component | Endpoint | Description |
|-----------|----------|-------------|
| Fleet | `GET /api/v1/fleet/vehicles` | List vehicles |
| Fleet | `GET /api/v1/fleet/trucks[/{id}]` | List/get trucks |
| Fleet | `GET /api/v1/fleet/trailers[/{id}]` | List/get trailers |
| Fleet | `GET /api/v1/fleet/carriers[/{id}]` | List/get carriers |
| Driver | `GET /api/v1/drivers[/{id}]` | List/get drivers |
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
