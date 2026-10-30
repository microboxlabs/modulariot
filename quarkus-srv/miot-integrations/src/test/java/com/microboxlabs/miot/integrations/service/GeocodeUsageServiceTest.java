package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository;
import com.microboxlabs.miot.integrations.persistence.GeocodeUsageRepository.UsageRow;
import com.microboxlabs.miot.integrations.service.GeocodeUsageService.Resolution;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
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
    private final GeocodeUsageService service = new GeocodeUsageService(usage);
    private static final BigDecimal PRICE = new BigDecimal("0.005");

    @Test
    void aProviderCallCarriesItsCost() {
        service.recordResolution(new Resolution("acme", "ana", "provider", "resolved", "mapbox", false, true, PRICE));

        assertEquals(new UsageRow("acme", "ana", "provider", "resolved", "mapbox", false, PRICE), usage.rows.get(0));
    }

    @Test
    void aCacheHitCostsNothing() {
        service.recordResolution(new Resolution("acme", null, "provider", "resolved", "mapbox", true, false, PRICE));

        assertNull(usage.rows.get(0).costUsd());
        assertEquals(true, usage.rows.get(0).cacheHit());
    }

    @Test
    void sourcesWithoutAProviderCallCostNothing() {
        service.recordResolution(new Resolution("acme", null, "plus_code", "resolved", null, false, false, PRICE));

        assertNull(usage.rows.get(0).costUsd());
    }

    @Test
    void theTenantIsRequired() {
        Resolution invalid = new Resolution(" ", null, null, "needs_review", null, false, false, null);
        assertThrows(IllegalArgumentException.class, () -> service.recordResolution(invalid));
    }
}
