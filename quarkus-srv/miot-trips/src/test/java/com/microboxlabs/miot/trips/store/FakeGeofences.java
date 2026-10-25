package com.microboxlabs.miot.trips.store;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/** Geofences held in memory, per tenant. */
public class FakeGeofences implements GeofenceDirectory {

    private record Owned(String tenantCode, Geofence geofence) {
    }

    private final List<Owned> all = new ArrayList<>();

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
    public Optional<Geofence> find(String tenantCode, int id) {
        return all.stream().filter(o -> o.tenantCode().equals(tenantCode) && o.geofence().id() == id)
                .map(Owned::geofence).findFirst();
    }
}
