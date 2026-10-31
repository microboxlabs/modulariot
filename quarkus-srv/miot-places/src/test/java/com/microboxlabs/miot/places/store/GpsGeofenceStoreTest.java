package com.microboxlabs.miot.places.store;

import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.gps.PlacesTestGpsDatabase;
import org.junit.jupiter.api.Test;

/** Without a GPS database there is nothing to read: the store says so instead of answering empty. */
class GpsGeofenceStoreTest {

    @Test
    void anUnconfiguredGpsDatabaseIsUnavailable() {
        GpsGeofenceStore store = new GpsGeofenceStore(PlacesTestGpsDatabase.notConfigured());
        assertThrows(GeofencesUnavailableException.class, () -> store.list("acme-client", null, 10));
    }
}
