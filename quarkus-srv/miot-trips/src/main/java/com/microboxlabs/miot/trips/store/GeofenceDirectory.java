package com.microboxlabs.miot.trips.store;

import java.util.Collection;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/** The tenant's GPS geofences, read from the GPS database; the tenant code is the GPS client id. */
public interface GeofenceDirectory {

    /** {@code code} is the client's own id for the geofence; {@code name} its descriptive name. */
    record Geofence(int id, String code, String name) {
    }

    /** By name or code, at most {@code limit}; empty when the GPS database is not configured. */
    List<Geofence> search(String tenantCode, String q, int limit);

    Optional<Geofence> find(String tenantCode, int id);

    /**
     * The tenant's geofences whose code equals {@code code}, then those whose name equals {@code name} ignoring
     * case; at most {@code limit}. Either may be null.
     */
    List<Geofence> matching(String tenantCode, String code, String name, int limit);

    /**
     * Creates a geofence of the tenant with that code, or returns the one it already has; {@code area} is a GeoJSON
     * polygon, {@code properties} a JSON object. Empty when the GPS database is not configured.
     */
    Optional<Geofence> create(String tenantCode, String code, String name, String area, String properties);

    /** The areas of these geofences as GeoJSON, by id; missing ids are left out. */
    Map<Integer, String> shapes(Collection<Integer> ids);
}
