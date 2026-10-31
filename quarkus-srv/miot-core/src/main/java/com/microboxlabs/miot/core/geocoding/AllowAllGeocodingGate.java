package com.microboxlabs.miot.core.geocoding;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;

/** Used when no geocoding plan is deployed: every provider call may go out. */
@DefaultBean
@ApplicationScoped
public class AllowAllGeocodingGate implements GeocodingGate {

    @Override
    public Refusal checkProviderCall(String organization, String tenantCode) {
        return null;
    }
}
