package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.db.Transactions;
import com.microboxlabs.miot.core.gps.PlacesTestGpsDatabase;
import com.microboxlabs.miot.places.store.InMemoryPlaceStore;
import org.junit.jupiter.api.Test;

class PlacesSyncActivationTest {

    @Test
    void syncNeedsBothComponentAndSyncOptIn() {
        var gps = PlacesTestGpsDatabase.configuredWithoutPool();
        assertFalse(new StreamHubPlaceSync(gps, true, false).copies());
        assertFalse(new StreamHubPlaceSync(gps, false, true).copies());
        assertTrue(new StreamHubPlaceSync(gps, true, true).copies());
        assertFalse(new StreamHubPlaceSync(PlacesTestGpsDatabase.notConfigured(), true, true).copies());
    }

    @Test
    void disabledRetryDoesNotEnterTheService() {
        int[] calls = {0};
        PlaceService service = new PlaceService(new InMemoryPlaceStore(), Transactions.none()) {
            @Override
            public int retryPending(int limit) {
                calls[0]++;
                return 0;
            }
        };
        new PlaceSyncRetry(service, false, true).retry();
        new PlaceSyncRetry(service, true, false).retry();
        assertEquals(0, calls[0]);
        new PlaceSyncRetry(service, true, true).retry();
        assertEquals(1, calls[0]);
    }
}
