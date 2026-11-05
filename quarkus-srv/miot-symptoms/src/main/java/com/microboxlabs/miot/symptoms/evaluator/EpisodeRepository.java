package com.microboxlabs.miot.symptoms.evaluator;

/** Loads one organization's episodes for one vehicle before a signal, and writes back what changed after it. */
public interface EpisodeRepository {

    /** Organizations with unfinished episodes on the vehicle, even after their signal access ends. */
    java.util.Set<String> tenantsWithEpisodes(String assetId);

    AssetEpisodes load(String tenantCode, String assetId);

    void save(AssetEpisodes changes);

    /** Drops one symptom's episode for the vehicle, as when an operator closes its case. */
    void forget(String tenantCode, String assetId, java.util.UUID definitionId);

    /**
     * Atomically records an operator close and invalidates snapshots loaded before it. A null marker drops
     * the episode; otherwise the marker replaces it. Saving an invalidated snapshot must fail so its caller
     * can reload the operator's decision.
     */
    void operatorClose(String tenantCode, String assetId, java.util.UUID definitionId, Episode marker);
}
