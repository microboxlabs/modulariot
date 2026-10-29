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
    private final Map<Integer, String> owners = new HashMap<>();
    private boolean configured = true;
    private int nextId = 10_000;

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

    /** As when the GPS database is not configured: nothing is created. */
    public FakeGeofences unconfigured() {
        configured = false;
        return this;
    }

    /** The tenant's geofences, created ones included. */
    public List<Geofence> of(String tenantCode) {
        return all.stream().filter(o -> o.tenantCode().equals(tenantCode)).map(Owned::geofence).toList();
    }

    public String shape(int id) {
        return shapes.get(id);
    }

    @Override
    public List<Geofence> matching(String tenantCode, String code, String name, int limit) {
        List<Geofence> mine = of(tenantCode);
        List<Geofence> out = new ArrayList<>(mine.stream().filter(g -> code != null && code.equals(g.code())).toList());
        mine.stream().filter(g -> name != null && name.equalsIgnoreCase(g.name()) && !out.contains(g)).forEach(out::add);
        return out.stream().limit(limit).toList();
    }

    @Override
    public Optional<Geofence> create(String tenantCode, String code, String name, String area, String properties) {
        if (tenantCode == null || tenantCode.isBlank()) {
            throw new IllegalArgumentException("a geofence needs the tenant's client id");
        }
        if (!configured) {
            return Optional.empty();
        }
        Optional<Geofence> existing = matching(tenantCode, code, null, 1).stream().findFirst();
        if (existing.isPresent()) {
            return existing;
        }
        int id = nextId++;
        add(tenantCode, id, code, name);
        shapes.put(id, area);
        try {
            var metadata = new com.fasterxml.jackson.databind.ObjectMapper().readTree(properties);
            if ("miot-trips".equals(metadata.path("created_by").asText())) owners.put(id, metadata.path("location_id").asText());
        } catch (java.io.IOException e) {
            throw new IllegalArgumentException("invalid geofence properties", e);
        }
        return find(tenantCode, id);
    }

    @Override
    public Optional<Geofence> place(String tenantCode, String locationId, String name, String area, String properties) {
        if (!configured) return Optional.empty();
        Optional<Geofence> existing = matching(tenantCode, locationId, null, 1).stream().findFirst();
        if (existing.isEmpty()) return create(tenantCode, locationId, name, area, properties);
        if (!locationId.equals(owners.get(existing.get().id()))) {
            throw new IllegalArgumentException("the geofence is managed outside this location");
        }
        shapes.put(existing.get().id(), area);
        return existing;
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
