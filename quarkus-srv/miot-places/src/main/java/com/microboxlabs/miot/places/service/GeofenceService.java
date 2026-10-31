package com.microboxlabs.miot.places.service;

import com.microboxlabs.miot.places.store.GeofenceStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;

/** The organization's geofences. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.places.enabled", stringValue = "true")
public class GeofenceService {

    public static final int DEFAULT_PAGE_SIZE = 500;
    public static final int MAX_PAGE_SIZE = 2000;

    private final GeofenceStore store;

    @Inject
    public GeofenceService(GeofenceStore store) {
        this.store = store;
    }

    /** By name or code when {@code q} is set; {@code size} defaults to {@value #DEFAULT_PAGE_SIZE}. */
    public List<GeofenceStore.Geofence> list(String tenantCode, String q, Integer size) {
        int s = size == null ? DEFAULT_PAGE_SIZE : size;
        if (s < 1 || s > MAX_PAGE_SIZE) {
            throw new IllegalArgumentException("size must be between 1 and " + MAX_PAGE_SIZE);
        }
        return store.list(tenantCode, q == null || q.isBlank() ? null : q.trim(), s);
    }
}
