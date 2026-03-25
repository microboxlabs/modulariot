# ModularIoT Server

Single Quarkus monorepo that produces one container image containing all ModularIoT components. Each component can be activated/deactivated at runtime via configuration.

## Deployment Modes

| Mode | Command | Use Case |
|------|---------|----------|
| All-in-one | `miot all` | Local dev, small on-prem |
| Single component | `miot fleet` | Kubernetes, scale independently |
| Selective | `miot all --components=fleet,alerts` | Mixed mode |

## Module Structure

```
miot-core/    Shared foundation (config, models, auth, messaging, persistence)
miot-fleet/   Fleet monitoring (vehicles, trips, GPS ingestion)
miot-cli/     Application entrypoint (Picocli CLI)
```

## Tech Stack

- **Quarkus 3.x** — CDI conditional activation, Picocli, Kubernetes-native
- **Java 21**
- **PostgreSQL** — Schema-per-component via Flyway (`miot_core`, `miot_fleet`, ...)
- **Hibernate Reactive + Panache**
- **Vert.x EventBus** — In-process inter-component messaging

## Quick Start

```bash
# Build
./mvnw clean install

# Run all-in-one (dev mode with hot reload)
./mvnw quarkus:dev -pl miot-cli

# Run only fleet component
./mvnw quarkus:dev -pl miot-cli -Dmiot.component.fleet.enabled=true

# Run tests
./mvnw test

# Build container image
./mvnw package -Dquarkus.container-image.build=true
```

## Component Activation

Components activate via config properties:

```properties
miot.component.fleet.enabled=true
```

Override at runtime:

```bash
# Via CLI
docker run ghcr.io/microboxlabs/miot:latest miot fleet

# Via env var
MIOT_COMPONENT_FLEET_ENABLED=true
```

## Database

Each component owns its schema. Migrations run via Flyway at startup:

```
miot-core/src/main/resources/db/migration/core/     # tenants, assets
miot-fleet/src/main/resources/db/migration/fleet/    # vehicles, trips
```

## Docker

```bash
docker build -t miot:latest .
docker run miot:latest miot all         # all-in-one
docker run miot:latest miot fleet       # single component
```

## License

Apache 2.0
