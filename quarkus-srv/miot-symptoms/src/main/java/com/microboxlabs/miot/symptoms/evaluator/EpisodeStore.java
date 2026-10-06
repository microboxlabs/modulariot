package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

/** Episodes by organization, vehicle and symptom, and the newest signal applied per vehicle and source. */
public interface EpisodeStore {

    Optional<Episode> find(String tenantCode, String assetId, UUID definitionId);

    void save(String tenantCode, Episode episode);

    void delete(String tenantCode, String assetId, UUID definitionId);

    /** The time of the newest signal of {@code sourceKey} applied for the vehicle; kept when episodes are not. */
    Optional<Instant> watermark(String tenantCode, String assetId, String sourceKey);

    void setWatermark(String tenantCode, String assetId, String sourceKey, Instant at);
}
