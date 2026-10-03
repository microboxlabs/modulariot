package com.microboxlabs.miot.symptoms.evaluator;

import java.util.Optional;
import java.util.UUID;

/** Episodes by organization, vehicle and symptom. */
public interface EpisodeStore {

    Optional<Episode> find(String tenantCode, String assetId, UUID definitionId);

    void save(String tenantCode, Episode episode);

    void delete(String tenantCode, String assetId, UUID definitionId);
}
