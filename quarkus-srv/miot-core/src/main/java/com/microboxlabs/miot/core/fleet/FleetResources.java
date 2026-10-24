package com.microboxlabs.miot.core.fleet;

import java.util.Optional;
import java.util.UUID;

/**
 * The fleet's carriers, trucks, trailers and drivers, for modules that reference them by id. Implemented by the
 * fleet module. Reads take no row locks.
 */
public interface FleetResources {

    /** A truck or trailer. */
    record Vehicle(String licensePlate, UUID carrierId) {
    }

    /** {@code phone} is the mobile phone when there is one. */
    record Driver(String rut, String fullName, String phone) {
    }

    record Carrier(UUID id, String legalName, String phone) {
    }

    /** Whether {@code resourceType} (truck, trailer, driver) {@code id} exists for the tenant. */
    boolean exists(String tenantCode, String resourceType, UUID id);

    /** {@code resourceType} is truck or trailer. */
    Optional<Vehicle> vehicle(String tenantCode, String resourceType, UUID id);

    Optional<Driver> driver(String tenantCode, UUID id);

    Optional<Carrier> carrier(String tenantCode, UUID id);
}
