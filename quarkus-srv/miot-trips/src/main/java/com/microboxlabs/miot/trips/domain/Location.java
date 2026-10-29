package com.microboxlabs.miot.trips.domain;

import java.time.OffsetDateTime;

/**
 * A named place trips and mandates point at: plant, port, distribution center, customer or zone. {@code geofenceId}
 * is the GPS geofence it maps to, or null. {@code placement} is where it is and how that was found; never null.
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
        String updatedBy,
        Placement placement) {

    public static final String RESOLVED = "resolved";
    public static final String NEEDS_REVIEW = "needs_review";
    public static final String REJECTED = "rejected";

    /**
     * The site as declared (address, country, district) and its point. {@code districtCode} is the Peruvian ubigeo
     * or the Chilean commune code; {@code source} is geofence, plus_code, coordinates or manual.
     */
    public record Placement(
            String address,
            String country,
            String districtCode,
            String districtName,
            String plusCode,
            Double latitude,
            Double longitude,
            String source,
            String status,
            String note) {

        public static final Placement NONE = new Placement(null, null, null, null, null, null, null, null, null,
                null);

        public Placement withResult(String plusCode, Double latitude, Double longitude, String source, String status,
                String note) {
            return new Placement(address, country, districtCode, districtName, plusCode, latitude, longitude, source,
                    status, note);
        }
    }

    public Location {
        placement = placement == null ? Placement.NONE : placement;
    }

    public Location(String id, String tenantCode, String name, String type, String externalCode, String geomGeojson,
            Integer geofenceId, OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt,
            String updatedBy) {
        this(id, tenantCode, name, type, externalCode, geomGeojson, geofenceId, createdAt, createdBy, updatedAt,
                updatedBy, null);
    }

    public Location(String id, String tenantCode, String name, String type, String externalCode, String geomGeojson,
            OffsetDateTime createdAt, String createdBy, OffsetDateTime updatedAt, String updatedBy) {
        this(id, tenantCode, name, type, externalCode, geomGeojson, null, createdAt, createdBy, updatedAt, updatedBy);
    }

    public Location withGeofence(Integer id, String actor) {
        return new Location(this.id, tenantCode, name, type, externalCode, geomGeojson, id, createdAt, createdBy,
                null, actor, placement);
    }

    public Location withPlacement(Placement p, Integer geofence, String actor) {
        return new Location(id, tenantCode, name, type, externalCode, geomGeojson, geofence, createdAt, createdBy,
                null, actor, p);
    }
}
