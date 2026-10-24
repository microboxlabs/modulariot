package com.microboxlabs.miot.core.fleet;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.UUID;

/** Used when the fleet module is not in the build: a resource cannot be checked, so the request fails (500). */
@ApplicationScoped
@DefaultBean
public class NoFleetResources implements FleetResources {

    @Override
    public boolean exists(String tenantCode, String resourceType, UUID id) {
        throw new UnsupportedOperationException("the fleet component is not enabled in this build");
    }
}
