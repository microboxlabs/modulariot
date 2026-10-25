package com.microboxlabs.miot.fleet.resources.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.fleet.resources.store.ResourceStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;

/** {@link FleetResources} for other modules: lockless reads of the current rows. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetResourcesService implements FleetResources {

    private static final String TRUCK = "truck";
    private static final String TRAILER = "trailer";
    private static final String RESOURCE_TYPE = "resourceType";

    private final ResourceStore store;

    @Inject
    public FleetResourcesService(ResourceStore store) {
        this.store = store;
    }

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        return store.isCurrent(tenantCode, Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER, "driver"),
                id);
    }

    @Override
    public Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id) {
        return store.vehicle(tenantCode, Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER), id);
    }

    @Override
    public Optional<Driver> driver(String tenantCode, UUID id) {
        return store.driverSummary(tenantCode, id);
    }

    @Override
    public Optional<Carrier> carrier(String tenantCode, UUID id) {
        return store.carrierSummary(tenantCode, id);
    }

    @Override
    public List<Carrier> carriers(String tenantCode, String query, int limit) {
        String q = query == null || query.isBlank() ? null : query.trim();
        return store.listActiveCarriers(tenantCode, q, limit).stream()
                .map(c -> new Carrier(UUID.fromString(c.id()), c.legalName(), c.phone(), c.rut()))
                .toList();
    }

    @Override
    public Optional<Match> byPlate(String tenantCode, String resourceType, String plate) {
        String table = Check.oneOf(resourceType, RESOURCE_TYPE, TRUCK, TRAILER);
        return key(plate).flatMap(k -> store.findByKey(tenantCode, table, k));
    }

    @Override
    public Optional<Match> driverByDocument(String tenantCode, String document) {
        return key(document).flatMap(k -> store.findByKey(tenantCode, "driver", k));
    }

    /** A plate or document upper-cased and stripped to letters and digits; empty when nothing is left. */
    static Optional<String> key(String raw) {
        String k = raw == null ? "" : raw.replaceAll("[^A-Za-z0-9]", "").toUpperCase(Locale.ROOT);
        return k.isEmpty() ? Optional.empty() : Optional.of(k);
    }
}
