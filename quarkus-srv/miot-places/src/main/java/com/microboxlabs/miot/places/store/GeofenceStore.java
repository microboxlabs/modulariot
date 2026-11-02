package com.microboxlabs.miot.places.store;

import java.util.List;

/** The tenant's geofences in the GPS database; the tenant code is the GPS client id. */
public interface GeofenceStore {

    /**
     * {@code code} is the client's own id for the geofence; {@code category} null where the GPS database has no
     * category column; {@code shapeGeojson} its area as GeoJSON and
     * {@code propertiesJson} its free-form properties (category, address, radius_meters, ...), both as JSON text.
     */
    record Geofence(int id, String code, String name, String polygonType, String category, String shapeGeojson,
            String propertiesJson) {
    }

    /**
     * By name or code when {@code q} is set, at most {@code limit}, starting at {@code offset}.
     *
     * @throws GeofencesUnavailableException when the GPS database is not configured
     */
    List<Geofence> list(String tenantCode, String q, int limit, long offset);
}
