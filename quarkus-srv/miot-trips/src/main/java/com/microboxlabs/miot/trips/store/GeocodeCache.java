package com.microboxlabs.miot.trips.store;

import java.time.OffsetDateTime;
import java.util.Optional;

/** Provider results shared by every tenant, by normalized address and country. Holds no tenant data. */
public interface GeocodeCache {

    record Entry(double lat, double lon, String source, String provider, OffsetDateTime resolvedAt) {
    }

    Optional<Entry> find(String addressKey, String country);

    /** Replaces what the key held. */
    void put(String addressKey, String country, Entry entry);
}
