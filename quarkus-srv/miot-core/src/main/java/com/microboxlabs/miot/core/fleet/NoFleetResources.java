package com.microboxlabs.miot.core.fleet;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;
import java.util.UUID;

/**
 * Used when the fleet module is not in the build: an assignment cannot be checked, so it fails (500), and
 * lookups find nothing.
 */
@ApplicationScoped
@DefaultBean
public class NoFleetResources implements FleetResources {

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        throw new UnsupportedOperationException("the fleet component is not enabled in this build");
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

    @Override
    public Optional<Match> byPlate(String tenantCode, String resourceType, String plate) {
        return Optional.empty();
    }

    @Override
    public Optional<Match> driverByDocument(String tenantCode, String document) {
        return Optional.empty();
    }
}
