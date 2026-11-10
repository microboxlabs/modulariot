package com.microboxlabs.miot.symptoms.duty;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local duty counters, for tests and for one replica without Redis. */
public class InMemoryDutyStore implements DutyStore {

    private record Key(String tenantCode, String assetId) {
    }

    private final Map<Key, DutyState> states = new ConcurrentHashMap<>();
    private final Map<Key, Long> restarts = new ConcurrentHashMap<>();

    @Override
    public Loaded load(String tenantCode, String assetId) {
        Key k = new Key(tenantCode, assetId);
        return new Loaded(states.get(k), restarts.getOrDefault(k, 0L));
    }

    @Override
    public void save(String tenantCode, String assetId, DutyState state) {
        states.put(new Key(tenantCode, assetId), state);
    }

    @Override
    public void restartDuty(String tenantCode, String assetId) {
        restarts.merge(new Key(tenantCode, assetId), 1L, Long::sum);
    }
}
