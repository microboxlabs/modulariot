package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.domain.TowerSettings;
import java.util.Optional;

/** One settings row per organization. */
public interface TowerSettingsStore {

    Optional<TowerSettings> find(String tenantCode);

    /** Inserts or replaces the organization's row and returns it as stored. */
    TowerSettings save(TowerSettings settings);
}
