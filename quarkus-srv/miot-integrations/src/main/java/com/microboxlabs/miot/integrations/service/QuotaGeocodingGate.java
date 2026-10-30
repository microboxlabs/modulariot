package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.core.geocoding.GeocodingGate;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/** Applies the geocoding plan's monthly quota to provider calls. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class QuotaGeocodingGate implements GeocodingGate {

    private final GeocodingPlanService service;

    @Inject
    public QuotaGeocodingGate(GeocodingPlanService service) {
        this.service = service;
    }

    @Override
    public Refusal checkProviderCall(String organization, String tenantCode) {
        return service.checkProviderCall(organization);
    }
}
