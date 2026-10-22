package com.microboxlabs.miot.symptoms.evaluator;

/** Loads one organization's episodes for one vehicle before a signal, and writes back what changed after it. */
public interface EpisodeRepository {

    AssetEpisodes load(String tenantCode, String assetId);

    void save(AssetEpisodes changes);

    /** Drops one symptom's episode for the vehicle, as when an operator closes its case. */
    void forget(String tenantCode, String assetId, java.util.UUID definitionId);
}
