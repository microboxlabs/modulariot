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

    /** The areas of these geofences as GeoJSON, by id; missing ids are left out. */
    Map<Integer, String> shapes(Collection<Integer> ids);
}
