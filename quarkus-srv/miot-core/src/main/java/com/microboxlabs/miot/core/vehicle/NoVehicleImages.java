package com.microboxlabs.miot.core.vehicle;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.Optional;

/** Used when the integrations module is not in the build: no images. */
@ApplicationScoped
@DefaultBean
public class NoVehicleImages implements VehicleImages {

    @Override
    public Optional<Image> find(String tenantCode, Query query) {
        return Optional.empty();
    }
}
