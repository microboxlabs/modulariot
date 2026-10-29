package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository.UsageRow;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.math.BigDecimal;

/**
 * Records each location resolution for charging. Only a provider call carries a cost: a cached result, the internal
 * source, a Plus Code or a geofence do not.
 */
@ApplicationScoped
public class GeocodeUsageService {

    /** {@code providerCalled}: the provider answered during this resolution. */
    public record Resolution(String tenantId, String userId, String source, String result, String provider,
            boolean cacheHit, boolean providerCalled, BigDecimal costUsd) {
    }

    private final GeocodeUsageRepository usage;

    @Inject
    public GeocodeUsageService(GeocodeUsageRepository usage) {
        this.usage = usage;
    }

    public void record(Resolution r) {
        if (r == null || r.tenantId() == null || r.tenantId().isBlank() || r.result() == null) {
            throw new IllegalArgumentException("tenantId and result are required");
        }
        BigDecimal cost = r.providerCalled() && !r.cacheHit() ? r.costUsd() : null;
        usage.insert(new UsageRow(r.tenantId(), r.userId(), r.source(), r.result(), r.provider(), r.cacheHit(),
                cost));
    }
}
