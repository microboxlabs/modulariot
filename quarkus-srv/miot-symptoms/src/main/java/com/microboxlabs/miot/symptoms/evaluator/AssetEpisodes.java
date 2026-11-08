package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
import java.util.List;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;

/**
 * One organization's episodes and watermarks for one vehicle, loaded before a
 * signal is evaluated and written back after it. Remembers what changed, so
 * only that is written.
 */
public class AssetEpisodes implements EpisodeStore {

    private final String tenantCode;
    private final String assetId;
    private final long closeRevision;
    private final Map<UUID, Episode> episodes;
    private final Map<UUID, Episode> loaded;
    private final Map<String, Instant> watermarks;
    private final Set<UUID> saved = new HashSet<>();
    private final Set<UUID> deleted = new HashSet<>();
    private final Set<String> marked = new HashSet<>();

    public AssetEpisodes(String tenantCode, String assetId, Map<UUID, Episode> episodes,
            Map<String, Instant> watermarks) {
        this(tenantCode, assetId, episodes, watermarks, 0);
    }

    AssetEpisodes(String tenantCode, String assetId, Map<UUID, Episode> episodes,
            Map<String, Instant> watermarks, long closeRevision) {
        this.tenantCode = tenantCode;
        this.assetId = assetId;
        this.closeRevision = closeRevision;
        this.episodes = new HashMap<>(episodes);
        this.loaded = new HashMap<>(episodes);
        this.watermarks = new HashMap<>(watermarks);
    }

    public static AssetEpisodes empty(String tenantCode, String assetId) {
        return new AssetEpisodes(tenantCode, assetId, Map.of(), Map.of());
    }

    @Override
    public Optional<Episode> find(String tenant, String asset, UUID definitionId) {
        return mine(tenant, asset) ? Optional.ofNullable(episodes.get(definitionId)) : Optional.empty();
    }

    @Override
    public void save(String tenant, Episode episode) {
        if (mine(tenant, episode.assetId())) {
            episodes.put(episode.definitionId(), episode);
            saved.add(episode.definitionId());
            deleted.remove(episode.definitionId());
        }
    }

    @Override
    public void delete(String tenant, String asset, UUID definitionId) {
        if (mine(tenant, asset) && episodes.remove(definitionId) != null) {
            deleted.add(definitionId);
        }
        saved.remove(definitionId);
    }

    /** The symptom's episode as it was loaded, before any change to this snapshot. */
    public Optional<Episode> loaded(UUID definitionId) {
        return Optional.ofNullable(loaded.get(definitionId));
    }

    /** Recovers legacy case metadata once from its opening, never from the vehicle's next trip. */
    public void restoreCases(TransitionLog log) {
        for (Episode e : List.copyOf(loaded.values())) {
            if (e.open() && e.tripId() == null && e.lastContext() == null) {
                TransitionLog.Opening opening = log.opening(tenantCode, e);
                Episode restored = e.withCaseFrame(opening.tripId(), opening.context());
                loaded.put(e.definitionId(), restored);
                save(tenantCode, restored);
            }
        }
    }

    /** Keeps the latest applied context on each open case's own trip in the existing episode write. */
    public void keepContext(String trip, Map<String, Object> context, Instant at, List<CompiledSymptom> symptoms) {
        if (trip == null) {
            return;
        }
        for (CompiledSymptom s : symptoms) {
            Episode e = episodes.get(s.definitionId());
            if (e != null && e.open() && at.equals(e.lastSignalAt()) && trip.equals(e.tripId())) {
                save(tenantCode, e.withCaseFrame(trip, context));
            }
        }
    }

    @Override
    public Optional<Instant> watermark(String tenant, String asset, String sourceKey) {
        return mine(tenant, asset) ? Optional.ofNullable(watermarks.get(sourceKey)) : Optional.empty();
    }

    @Override
    public void setWatermark(String tenant, String asset, String sourceKey, Instant at) {
        if (mine(tenant, asset)) {
            watermarks.put(sourceKey, at);
            marked.add(sourceKey);
        }
    }

    public String tenantCode() {
        return tenantCode;
    }

    public String assetId() {
        return assetId;
    }

    /** The operator-close revision captured with this snapshot. */
    long closeRevision() {
        return closeRevision;
    }

    boolean hasEpisodes() {
        return !episodes.isEmpty();
    }

    /** Episodes saved since loading, by symptom. */
    public Map<UUID, Episode> saved() {
        Map<UUID, Episode> out = new HashMap<>();
        saved.forEach(id -> out.put(id, episodes.get(id)));
        return out;
    }

    public Set<UUID> deleted() {
        return Set.copyOf(deleted);
    }

    /** Watermarks set since loading, by source. */
    public Map<String, Instant> marked() {
        Map<String, Instant> out = new HashMap<>();
        marked.forEach(k -> out.put(k, watermarks.get(k)));
        return out;
    }

    private boolean mine(String tenant, String asset) {
        return tenantCode.equals(tenant) && assetId.equals(asset);
    }
}
