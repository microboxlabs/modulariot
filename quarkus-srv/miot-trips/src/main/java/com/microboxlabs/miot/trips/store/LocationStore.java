package com.microboxlabs.miot.trips.store;

import com.microboxlabs.miot.trips.domain.Location;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/** Locations. Every call is tenant-scoped. */
public interface LocationStore {

    Location insert(Location location);

    /** Inserts unless the tenant already has a current location with that external code; empty then. */
    Optional<Location> insertIfAbsent(Location location);

    /** The current location with that external code, compared as stored. */
    Optional<Location> byCode(String tenantCode, String externalCode);

    Optional<Location> find(String tenantCode, UUID id);

    default List<Location> list(String tenantCode, String q, String type, int page, int size) {
        return list(tenantCode, q, type, null, page, size);
    }

    /** {@code status} filters by resolution status; null lists every location. */
    List<Location> list(String tenantCode, String q, String type, String status, int page, int size);

    /** Updates descriptive fields without replacing the independently managed geofence link. */
    Optional<Location> update(Location location);

    Optional<Location> setGeofence(String tenantCode, UUID id, Integer geofenceId, String actor);

    /** Replaces the placement; the geofence link changes only when {@code geofenceId} is not null. */
    Optional<Location> setPlacement(String tenantCode, UUID id, Location.Placement placement, Integer geofenceId,
            String actor);
}
