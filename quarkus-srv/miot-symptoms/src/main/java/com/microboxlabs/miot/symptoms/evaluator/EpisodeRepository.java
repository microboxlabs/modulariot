package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import io.smallrye.mutiny.Uni;
import java.time.Instant;

/** Loads one organization's episodes for one vehicle before a signal, and writes back what changed after it. */
public interface EpisodeRepository {

    /** Organizations with unfinished episodes on the vehicle, even after their signal access ends. */
    java.util.Set<String> tenantsWithEpisodes(String assetId);

    AssetEpisodes load(String tenantCode, String assetId);

    /**
     * Starts reading what {@link #tenantsWithEpisodes} answers; the supplier waits for it. A store over the network
     * sends the read now, so the signal's other reads go out with it.
     */
    default java.util.function.Supplier<java.util.Set<String>> readTenantsWithEpisodes(String assetId) {
        java.util.Set<String> tenants = tenantsWithEpisodes(assetId);
        return () -> tenants;
    }

    void save(AssetEpisodes changes);

    /** Recheck under the database case locks, before any transition from this snapshot is written. */
    default Uni<Void> validate(AssetEpisodes snapshot) {
        return Uni.createFrom().item(() -> {
            snapshot.requireRevision(load(snapshot.tenantCode(), snapshot.assetId()).closeRevision());
            return (Void) null;
        });
    }


    /** Drops one symptom's episode for the vehicle, as when an operator closes its case. */
    void forget(String tenantCode, String assetId, java.util.UUID definitionId);

    /**
     * Atomically records an operator close and invalidates snapshots loaded before it. A null marker drops
     * the episode; otherwise the marker replaces it. Saving an invalidated snapshot must fail so its caller
     * can reload the operator's decision.
     */
    void operatorClose(String tenantCode, String assetId, java.util.UUID definitionId, Episode marker);
    /** A delayed close preserves newer cases and operator markers, and invalidates in-flight episode saves. */
    default void forgetStale(String tenantCode, String assetId, java.util.UUID definitionId,
            SymptomState state, Instant openedAt) {
        Episode e = load(tenantCode, assetId).find(tenantCode, assetId, definitionId).orElse(null);
        if (e == null || (e.closedOnTrip() == null && (e.state() == null || e.state() == state)
                && (e.openedAt() == null || !e.openedAt().isAfter(openedAt)))) {
            forget(tenantCode, assetId, definitionId);
        }
    }
}
