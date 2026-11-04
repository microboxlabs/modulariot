package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local settings store for unit tests. Not a CDI bean: the running service uses {@link PgTowerSettingsStore}. */
public class InMemoryTowerSettingsStore implements TowerSettingsStore {

    private final Map<String, TowerSettings> rows = new ConcurrentHashMap<>();
    private final Map<String, String> telephony = new ConcurrentHashMap<>();

    @Override
    public Optional<TowerSettings> find(String tenantCode) {
        return Optional.ofNullable(rows.get(tenantCode));
    }

    @Override
    public TowerSettings save(TowerSettings settings) {
        rows.put(settings.tenantCode(), settings);
        return settings;
    }

    @Override
    public Optional<String> telephonyProvider(String tenantCode) {
        return Optional.ofNullable(telephony.get(tenantCode));
    }

    @Override
    public void saveTelephonyProvider(String tenantCode, String provider, String updatedBy) {
        rows.compute(tenantCode, (key, old) -> {
            TowerSettings before = old == null ? TowerSettings.defaults(tenantCode) : old;
            return new TowerSettings(tenantCode, before.operators(), before.shiftHours(), before.capacityPerShift(),
                    updatedBy, java.time.OffsetDateTime.now(java.time.ZoneOffset.UTC));
        });
        if (provider == null) {
            telephony.remove(tenantCode);
        } else {
            telephony.put(tenantCode, provider);
        }
    }
}
