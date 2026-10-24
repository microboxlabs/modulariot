package com.microboxlabs.miot.core.fleet;

import java.util.UUID;

/** The fleet's trucks, trailers and drivers, for modules that reference them by id. Implemented by the fleet module. */
public interface FleetResources {

    /** Whether {@code resourceType} (truck, trailer, driver) {@code id} exists for the tenant. */
    boolean exists(String tenantCode, String resourceType, UUID id);
}
