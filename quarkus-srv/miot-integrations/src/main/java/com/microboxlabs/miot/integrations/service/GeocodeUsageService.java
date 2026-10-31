package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository.UsageRow;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import org.jboss.logging.Logger;

/**
 * Records each location resolution for charging. Only a provider call carries a cost and counts against the
 * organization's quota: a cached result, the internal source, a Plus Code or a geofence do not.
 */
@ApplicationScoped
public class GeocodeUsageService {

    private static final Logger LOG = Logger.getLogger(GeocodeUsageService.class);

    /** {@code providerCalled}: the provider answered during this resolution. {@code organization} may be null. */
    public record Resolution(String organization, String tenantId, String userId, String source, String result,
            String provider, boolean cacheHit, boolean providerCalled, BigDecimal costUsd) {
    }

    private final GeocodeUsageRepository usage;
    private final GeocodingPlanService plans;
    private final GeocodingMetrics metrics;

    @Inject
    public GeocodeUsageService(GeocodeUsageRepository usage, GeocodingPlanService plans, GeocodingMetrics metrics) {
        this.usage = usage;
        this.plans = plans;
        this.metrics = metrics;
    }

    public void recordResolution(Resolution r) {
        if (r == null || r.tenantId() == null || r.tenantId().isBlank() || r.result() == null) {
            throw new IllegalArgumentException("tenantId and result are required");
        }
        boolean called = r.providerCalled() && !r.cacheHit();
        usage.insert(new UsageRow(r.organization(), r.tenantId(), r.userId(), r.source(), r.result(), r.provider(),
                r.cacheHit(), called, called ? r.costUsd() : null));
        metrics.resolution(r.source(), r.result());
        if (called) {
            try {
                plans.afterProviderCall(r.organization(), r.tenantId());
            } catch (RuntimeException e) {
                LOG.warnf("Geocoding quota of %s not checked: %s", r.organization(), e.getMessage());
            }
        }
    }
}
