package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/**
 * A named place trips and mandates point at: plant, port, distribution center, customer or zone. {@code geofenceId}
 * is the GPS geofence it maps to, or null.
 */
public record Location(
        String id,
        String tenantCode,
        String name,
        String type,
        String externalCode,
        String geomGeojson,
        Integer geofenceId,
        OffsetDateTime createdAt,
        String createdBy,
        OffsetDateTime updatedAt,
        String updatedBy) {

    public Location(String id, String tenantCode, String name, String type, String externalCode, String geomGeojson,
            OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt, String updatedBy) {
        this(id, tenantCode, name, type, externalCode, geomGeojson, null, createdAt, createdBy, updatedAt, updatedBy);
    }

    public Location withGeofence(Integer id, String actor) {
        return new Location(this.id, tenantCode, name, type, externalCode, geomGeojson, id, createdAt, createdBy,
                null, actor);
    }
}
