package com.microboxlabs.miot.trips.store;

import java.util.HashMap;
import java.util.Map;
import java.util.Optional;

public class InMemoryGeocodeCache implements GeocodeCache {

    public final Map<String, Entry> entries = new HashMap<>();

    @Override
    public Optional<Entry> find(String addressKey, String country) {
        return Optional.ofNullable(entries.get(country + "|" + addressKey));
    }

    @Override
    public void put(String addressKey, String country, Entry entry) {
        entries.put(country + "|" + addressKey, entry);
    }
}
