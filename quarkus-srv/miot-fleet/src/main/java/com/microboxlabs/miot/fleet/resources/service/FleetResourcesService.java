package com.microboxlabs.miot.fleet.resources.service;

import com.microboxlabs.miot.core.fleet.FleetResources;
import com.microboxlabs.miot.fleet.resources.store.ResourceStore;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Optional;
import java.util.UUID;

/** {@link FleetResources} for other modules: lockless reads of the current rows. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.fleet.enabled", stringValue = "true")
public class FleetResourcesService implements FleetResources {

    private static final String RESOURCE_TYPE = "resourceType";

    private final ResourceStore store;

    @Inject
    public FleetResourcesService(ResourceStore store) {
        this.store = store;
    }

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        return store.isCurrent(tenantCode, Check.oneOf(resourceType, RESOURCE_TYPE, "truck", "trailer", "driver"),
                id);
    }

    @Override
    public Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id) {
        return store.vehicle(tenantCode, Check.oneOf(resourceType, RESOURCE_TYPE, "truck", "trailer"), id);
    }

    @Override
    public Optional<Driver> driver(String tenantCode, UUID id) {
        return store.driverSummary(tenantCode, id);
    }

    @Override
    public Optional<Carrier> carrier(String tenantCode, UUID id) {
        return store.carrierSummary(tenantCode, id);
    }
}
