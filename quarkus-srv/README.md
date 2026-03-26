# ModularIoT Server

Single Quarkus monorepo that produces one container image containing all ModularIoT components. Each component can be activated/deactivated at runtime via configuration.

## Module Structure

```
miot-core/            Shared foundation (config, models, auth, messaging, persistence)
miot-resource-core/   Shared SDK (entity events, KPI interfaces, resolution, Alfresco client, metrics)
miot-fleet/           Fleet directory (vehicles, trucks, trailers, carriers)
miot-driver/          Driver directory (lifecycle, documents, compliance, scoring)
miot-cli/             Application entrypoint
```

## Tech Stack

- **Quarkus 3.x** — CDI conditional activation, Kubernetes-native
- **Java 21**
- **PostgreSQL** — Schema-per-component via Flyway (`miot_core`, `miot_fleet`, `miot_resource`, `miot_driver`)
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
```

Override at runtime via env vars:

```bash
# All components
MIOT_COMPONENT_ALL_ENABLED=true

# Single component
MIOT_COMPONENT_FLEET_ENABLED=true
```

Only the schemas for enabled components are created by Flyway. Starting with `./start.sh fleet` will create `miot_core`, `miot_resource`, and `miot_fleet` schemas — but not `miot_driver`.

## Database

Each component owns its schema. Migrations run via Flyway at startup, filtered by active components:

```
miot-core/src/main/resources/db/migration/core/             # tenants, assets (always)
miot-resource-core/src/main/resources/db/migration/resource/ # entity events, scores, sync cursors, links, profiles (always)
miot-fleet/src/main/resources/db/migration/fleet/            # vehicles, trips, trucks, trailers, carriers
miot-driver/src/main/resources/db/migration/driver/          # drivers
```

## API Documentation

When running in dev mode, Swagger UI is available at:

- **Swagger UI**: http://localhost:8180/q/swagger-ui/
- **OpenAPI spec**: http://localhost:8180/q/openapi

Endpoints are grouped by component tag (Fleet, Drivers). Only enabled components appear in the spec.

## Endpoints

| Component | Endpoint | Description |
|-----------|----------|-------------|
| Fleet | `GET /api/v1/fleet/vehicles` | List vehicles |
| Fleet | `GET /api/v1/fleet/trucks[/{id}]` | List/get trucks |
| Fleet | `GET /api/v1/fleet/trailers[/{id}]` | List/get trailers |
| Fleet | `GET /api/v1/fleet/carriers[/{id}]` | List/get carriers |
| Driver | `GET /api/v1/drivers[/{id}]` | List/get drivers |
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
