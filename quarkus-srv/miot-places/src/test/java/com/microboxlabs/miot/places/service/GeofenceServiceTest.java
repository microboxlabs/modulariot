package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.places.store.GeofenceStore;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** The page size defaults and is bounded; a blank search is no search. */
class GeofenceServiceTest {

    private record Call(String tenantCode, String q, int limit, long offset) {
    }

    private final List<Call> calls = new ArrayList<>();
    private final GeofenceService service = new GeofenceService((tenantCode, q, limit, offset) -> {
        calls.add(new Call(tenantCode, q, limit, offset));
        return List.of();
    });

    @Test
    void readsTheTenantsGeofencesWithTheDefaultPageSize() {
        service.list("acme-client", null, null, null);
        assertEquals(new Call("acme-client", null, GeofenceService.DEFAULT_PAGE_SIZE, 0), calls.get(0));
    }

    @Test
    void trimsTheSearchAndDropsABlankOne() {
        service.list("acme-client", "  arica ", 10, null);
        service.list("acme-client", "   ", 10, null);
        assertEquals("arica", calls.get(0).q());
        assertNull(calls.get(1).q());
    }

    @Test
    void theSizeMustBeWithinTheBounds() {
        service.list("acme-client", null, 1, null);
        service.list("acme-client", null, GeofenceService.MAX_PAGE_SIZE, null);
        assertEquals(List.of(1, GeofenceService.MAX_PAGE_SIZE), calls.stream().map(Call::limit).toList());

        assertThrows(IllegalArgumentException.class, () -> service.list("acme-client", null, 0, null));
        assertThrows(IllegalArgumentException.class,
                () -> service.list("acme-client", null, GeofenceService.MAX_PAGE_SIZE + 1, null));
        assertEquals(2, calls.size());
    }

    @Test
    void returnsWhatTheStoreReads() {
        GeofenceStore.Geofence arica = new GeofenceStore.Geofence(7, "ARI", "Arica", "polygonal", null, null, null);
        GeofenceService reading = new GeofenceService((tenantCode, q, limit, offset) -> List.of(arica));
        List<GeofenceStore.Geofence> out = reading.list("acme-client", null, null, null);
        assertTrue(out.size() == 1 && out.get(0) == arica);
    }

    @Test
    void laterPagesKeepTheTenantAndUseANonOverflowingOffset() {
        service.list("acme-client", " ARI ", 2000, 1);
        service.list("acme-client", null, 2000, Integer.MAX_VALUE);
        assertEquals(new Call("acme-client", "ARI", 2000, 2000), calls.get(0));
        assertEquals(4294967294000L, calls.get(1).offset());
    }

    @Test
    void negativePagesNeverReadTheStore() {
        assertThrows(IllegalArgumentException.class, () -> service.list("acme-client", null, 10, -1));
        assertTrue(calls.isEmpty());
    }
}
