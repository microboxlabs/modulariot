package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local settings store for unit tests. Not a CDI bean: the running service uses {@link PgTowerSettingsStore}. */
public class InMemoryTowerSettingsStore implements TowerSettingsStore {

    private final Map<String, TowerSettings> rows = new ConcurrentHashMap<>();

    @Override
    public Optional<TowerSettings> find(String tenantCode) {
        return Optional.ofNullable(rows.get(tenantCode));
    }

    @Override
    public TowerSettings save(TowerSettings settings) {
        rows.put(settings.tenantCode(), settings);
        return settings;
    }
}
