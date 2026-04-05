# Migration Plan: quarkus-http-pulsar-publisher → quarkus-srv modulith

## Context

The `quarkus-http-pulsar-publisher` is a standalone microservice (`cl.streamhub` groupId) that serves as an HTTP-to-Pulsar gateway for three distinct domains: **live video streaming** (HLS frame ingestion + playback), **GPS asset tracking**, and **Alfresco task event forwarding**. It needs to be ported into the `quarkus-srv` modulith to consolidate into a single deployable image with runtime-activated components.

The microservice has **no shared code** with the modulith today — different auth model (SmallRye JWT with `@RolesAllowed` vs OIDC + `TenantRequestFilter`), different package namespace (`cl.streamhub` vs `com.microboxlabs.miot`), and different infrastructure deps (Pulsar + Redis + GCS vs Hibernate Reactive + Panache).

## Service Decomposition

The http-publisher contains **3 logically independent services**:

| Service | Endpoints | Dependencies | Complexity |
|---------|-----------|-------------|------------|
| **Stream (HLS)** | Frame ingestion, playback, devices, deferred archives | Redis, Pulsar, Storage (FS/GCS), PostgreSQL (symlinks) | HIGH — 16 service interfaces, 10 impl classes, 4 resources |
| **Asset Tracking** | `POST /v1/asset/track` | Pulsar only | LOW — 1 resource, 1 service, 1 impl |
| **Alfresco Tasks** | `POST /alfresco/tasks/events` | Pulsar only | LOW — 1 resource, 1 service, 1 impl |

## Library Dependencies Decision

| Library | GroupId | Decision | Rationale |
|---------|---------|----------|-----------|
| `gps-model:1.4.0` | `cl.streamhub` | **Keep as external dep** | Published model jar on Artifact Registry; complex domain model with validation annotations + MetricRegistry. Not worth inlining — it's a stable, versioned contract shared with other systems (GPS devices, processors). |
| `task-monitoring-model:1.0.0` | `com.microboxlabs` | **Keep as external dep** | Same reasoning — published contract shared with Alfresco task producers. Small and stable. |
| `quarkus-messaging-pulsar` | `io.quarkus` | **Add to modulith** | New dep for the modulith. Add to miot-cli (or new modules). |
| `quarkus-redis-client` | `io.quarkus` | **Add to modulith** | New dep. Only needed by stream module. |
| `quarkus-google-cloud-storage` | `io.quarkiverse` | **Add to modulith** | New dep. Only needed by stream module. |
| `quarkus-reactive-pg-client` | `io.quarkus` | **Already available** | Modulith already uses reactive PG. |
| `smallrye-jwt` | `io.smallrye` | **Adapt** | Modulith uses quarkus-oidc. The http-publisher's JWT extraction (`azp`/`sub` claims, `@RolesAllowed`) needs to adapt to the modulith's `TenantContext` / `OrganizationContext` pattern. |

## Decisions Made

- **API scoping:** Tenant-scoped (not org-scoped) — these are M2M device endpoints
- **Alfresco v1 topic:** Dropped — only v2 topic kept
- **Debug endpoints:** Dropped — not needed in modulith

---

## Phase 1: miot-tracking (Asset Tracking Module)

Simple "HTTP → Pulsar" bridge. Establishes the Pulsar integration pattern in the modulith.

### Module Structure
```
miot-tracking/
├── pom.xml
└── src/main/java/com/microboxlabs/miot/tracking/
    ├── TrackingComponent.java                  # IMiotComponent impl
    ├── api/
    │   └── AssetTrackingResource.java          # POST /api/v1/asset/track
    └── service/
        ├── AssetTrackingService.java           # Interface
        └── impl/
            └── PulsarAssetTrackingService.java
```

### Steps
1. Add Artifact Registry repository to parent `pom.xml` (for gps-model dep)
2. Add `quarkus-messaging-pulsar` and `gps-model` to parent depManagement
3. Create `miot-tracking` Maven module
4. Implement `TrackingComponent` (IMiotComponent, feature flag `miot.component.tracking.enabled`)
5. Port `AssetTrackingService` interface + `PulsarAssetTrackingService` impl
6. Port `AssetTrackingResource` — adapt JWT extraction to use `TenantContext`
7. Add Pulsar config to `application.properties`
8. Add feature flag `miot.component.tracking.enabled` to `application.properties`
9. Update `miot-cli/pom.xml` to depend on miot-tracking
10. Update parent `pom.xml` modules list

### Key Adaptation: Auth
- **Before:** `jwt.claim(Claims.sub)` to get clientId
- **After:** Inject `TenantContext` and use `tenantContext.getClientId()`

### Files to Modify
- `quarkus-srv/pom.xml` — add module, repo, depManagement
- `miot-cli/pom.xml` — add miot-tracking dependency
- `miot-cli/src/main/resources/application.properties` — add Pulsar + feature flag config

### Files to Create
- `miot-tracking/pom.xml`
- `miot-tracking/src/main/java/com/microboxlabs/miot/tracking/TrackingComponent.java`
- `miot-tracking/src/main/java/com/microboxlabs/miot/tracking/api/AssetTrackingResource.java`
- `miot-tracking/src/main/java/com/microboxlabs/miot/tracking/service/AssetTrackingService.java`
- `miot-tracking/src/main/java/com/microboxlabs/miot/tracking/service/impl/PulsarAssetTrackingService.java`

---

## Phase 2: miot-task-events (Alfresco Task Events Module)

Another simple "HTTP → Pulsar" bridge. Only publishes to v2 topic.

### Module Structure
```
miot-task-events/
├── pom.xml
└── src/main/java/com/microboxlabs/miot/taskevents/
    ├── TaskEventsComponent.java                # IMiotComponent impl
    ├── api/
    │   └── AlfrescoTaskResource.java           # POST /api/v1/tasks/events
    └── service/
        ├── AlfrescoTaskService.java            # Interface
        └── impl/
            └── PulsarAlfrescoTaskService.java  # Only v2 topic
```

### Steps
1. Add `task-monitoring-model` to parent depManagement
2. Create `miot-task-events` Maven module
3. Implement `TaskEventsComponent` (IMiotComponent, feature flag `miot.component.task-events.enabled`)
4. Port `AlfrescoTaskService` interface + `PulsarAlfrescoTaskService` impl (v2 topic only)
5. Port `AlfrescoTaskResource` — adapt auth to TenantContext
6. Add task-events Pulsar topic config to `application.properties`
7. Update `miot-cli/pom.xml` to depend on miot-task-events
8. Update parent `pom.xml` modules list

---

## Phase 3: miot-stream (HLS Streaming Module)

The complex module with Redis, storage backends, and database tables.

### Module Structure
```
miot-stream/
├── pom.xml
└── src/main/java/com/microboxlabs/miot/stream/
    ├── StreamComponent.java                    # IMiotComponent impl
    ├── api/
    │   ├── StreamFrameResource.java            # POST /api/v1/stream/frames
    │   ├── StreamPlaybackResource.java         # GET playlist, segments, devices
    │   └── DeferredTransmissionResource.java   # GET archives
    ├── model/
    │   └── Location.java
    ├── service/
    │   ├── EventPublisher.java                 # Interface
    │   ├── StorageService.java                 # Interface
    │   ├── SymlinkService.java                 # Interface
    │   ├── DeviceHeartbeatService.java         # Interface
    │   ├── HlsTokenService.java               # Interface
    │   ├── DeferredTransmissionService.java    # Interface
    │   ├── RedisPlaylistService.java           # Concrete
    │   └── StorageServiceProducer.java         # CDI producer
    └── service/impl/
        ├── PulsarStreamEventPublisher.java
        ├── FilesystemStorageService.java
        ├── GcsStorageService.java
        ├── FilesystemSymlinkService.java
        ├── PostgresSymlinkService.java
        ├── RedisDeviceHeartbeatService.java
        ├── RedisHlsTokenService.java
        └── PostgresDeferredTransmissionService.java
└── src/main/resources/db/migration/stream/
    └── V4.0.0__create_stream_schema.sql
```

### Database Migration
```sql
CREATE SCHEMA IF NOT EXISTS miot_stream;

CREATE TABLE miot_stream.stream_index_mappings ( ... );
CREATE TABLE miot_stream.stream_shared_devices ( ... );
CREATE TABLE miot_stream.deferred_transmissions ( ... );
```

### Additional Config
- Redis connection, HLS token, playlist, storage, GCS settings
- Auth bypass for HLS playback paths (token-based, not JWT)
- FlywayMigrator update for stream migration location
