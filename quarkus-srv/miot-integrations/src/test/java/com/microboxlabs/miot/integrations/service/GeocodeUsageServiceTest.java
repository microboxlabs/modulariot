package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.geocoding.GeocodingEvents;
import com.microboxlabs.miot.integrations.geocoding.GeocodingMetrics;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository.UsageRow;
import com.microboxlabs.miot.integrations.service.GeocodeUsageService.Resolution;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.math.BigDecimal;
import java.time.Clock;
import java.util.ArrayList;
import java.util.List;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class GeocodeUsageServiceTest {

    static final class Usage extends GeocodeUsageRepository {
        final List<UsageRow> rows = new ArrayList<>();

        Usage() {
            super(null);
        }

        @Override
        public void insert(UsageRow r) {
            rows.add(r);
        }
    }

    private final Usage usage = new Usage();
    private final GeocodingPlanServiceTest.Plans plans = new GeocodingPlanServiceTest.Plans();
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final GeocodeUsageService service = new GeocodeUsageService(usage,
            new GeocodingPlanService(plans, new GeocodingEvents(e -> CompletableFuture.completedFuture(null)),
                    GeocodingMetrics.NONE, Clock.systemUTC()),
            new GeocodingMetrics(meters));
    private static final BigDecimal PRICE = new BigDecimal("0.005");

    @Test
    void aProviderCallCarriesItsCostAndCounts() {
        service.recordResolution(new Resolution("acme", "client-a", "ana", "provider", "resolved", "mapbox", false, true,
                PRICE));

        assertEquals(new UsageRow("acme", "client-a", "ana", "provider", "resolved", "mapbox", false, true, PRICE),
                usage.rows.get(0));
        assertEquals(1, plans.subscriptionReads, "the quota is checked after a provider call");
    }

    @Test
    void aCacheHitCostsNothingAndDoesNotCount() {
        service.recordResolution(new Resolution("acme", "client-a", null, "provider", "resolved", "mapbox", true, false,
                PRICE));

        assertNull(usage.rows.get(0).costUsd());
        assertTrue(usage.rows.get(0).cacheHit());
        assertFalse(usage.rows.get(0).providerCalled());
        assertEquals(0, plans.subscriptionReads);
    }

    @Test
    void sourcesWithoutAProviderCallCostNothing() {
        service.recordResolution(new Resolution("acme", "client-a", null, "plus_code", "resolved", null, false, false, PRICE));

        assertNull(usage.rows.get(0).costUsd());
        assertFalse(usage.rows.get(0).providerCalled());
    }

    @Test
    void resolutionsAreCountedBySourceAndResult() {
        service.recordResolution(new Resolution("acme", "client-a", null, "plus_code", "resolved", null, false, false, null));
        service.recordResolution(new Resolution("acme", "client-a", null, null, "needs_review", null, false, false, null));

        assertEquals(1.0, meters.get("geocoding.resolutions").tags("source", "plus_code", "result", "resolved")
                .counter().count());
        assertEquals(1.0, meters.get("geocoding.resolutions").tags("source", "none", "result", "needs_review")
                .counter().count());
    }

    @Test
    void aFailingQuotaCheckDoesNotFailTheRecord() {
        plans.failing = true;

        service.recordResolution(new Resolution("acme", "client-a", null, "provider", "resolved", "mapbox", false, true,
                PRICE));

        assertEquals(1, usage.rows.size());
    }

    @Test
    void theTenantIsRequired() {
        Resolution invalid = new Resolution("acme", " ", null, null, "needs_review", null, false, false, null);
        assertThrows(IllegalArgumentException.class, () -> service.recordResolution(invalid));
    }
}
