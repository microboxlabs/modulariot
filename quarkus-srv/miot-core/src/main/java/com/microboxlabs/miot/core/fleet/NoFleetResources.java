package com.microboxlabs.miot.core.fleet;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

/**
 * Used when the fleet module is not in the build: a resource cannot be checked, so an assignment is refused, and
 * lookups find nothing.
 */
@ApplicationScoped
@DefaultBean
public class NoFleetResources implements FleetResources {

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        throw new IllegalStateException("the fleet component is not enabled in this build");
    }

    @Override
    public Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id) {
        return Optional.empty();
    }

    @Override
    public Optional<Driver> driver(String tenantCode, UUID id) {
        return Optional.empty();
    }

    @Override
    public Optional<Carrier> carrier(String tenantCode, UUID id) {
        return Optional.empty();
    }
}
