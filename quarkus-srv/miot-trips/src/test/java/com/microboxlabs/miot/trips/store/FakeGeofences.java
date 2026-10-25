package com.microboxlabs.miot.trips.store;

import java.util.ArrayList;
import java.util.Collection;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/** Geofences held in memory, per tenant. */
public class FakeGeofences implements GeofenceDirectory {

    private record Owned(String tenantCode, Geofence geofence) {
    }

    private final List<Owned> all = new ArrayList<>();
    private final Map<Integer, String> shapes = new HashMap<>();

    /** A square of side {@code 2 * half} degrees centered on the point. */
    public FakeGeofences square(int id, double lon, double lat, double half) {
        shapes.put(id, String.format(Locale.ROOT,
                "{\"type\":\"Polygon\",\"coordinates\":[[[%f,%f],[%f,%f],[%f,%f],[%f,%f],[%f,%f]]]}",
                lon - half, lat - half, lon + half, lat - half, lon + half, lat + half, lon - half, lat + half,
                lon - half, lat - half));
        return this;
    }

    public FakeGeofences shape(int id, String geojson) {
        shapes.put(id, geojson);
        return this;
    }

    public FakeGeofences add(String tenantCode, int id, String code, String name) {
        all.add(new Owned(tenantCode, new Geofence(id, code, name)));
        return this;
    }

    @Override
    public List<Geofence> search(String tenantCode, String q, int limit) {
        return all.stream().filter(o -> o.tenantCode().equals(tenantCode)).map(Owned::geofence)
                .filter(g -> q == null || g.name().contains(q) || g.code().contains(q)).limit(limit).toList();
    }

    @Override
    public Map<Integer, String> shapes(Collection<Integer> ids) {
        Map<Integer, String> out = new HashMap<>();
        ids.stream().filter(shapes::containsKey).forEach(id -> out.put(id, shapes.get(id)));
        return out;
    }

    @Override
    public Optional<Geofence> find(String tenantCode, int id) {
        return all.stream().filter(o -> o.tenantCode().equals(tenantCode) && o.geofence().id() == id)
                .map(Owned::geofence).findFirst();
    }
}
