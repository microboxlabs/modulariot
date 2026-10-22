package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.HashMap;
import java.util.HashSet;
import java.util.Map;
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
    private final Map<UUID, Episode> episodes;
    private final Map<String, Instant> watermarks;
    private final Set<UUID> saved = new HashSet<>();
    private final Set<UUID> deleted = new HashSet<>();
    private final Set<String> marked = new HashSet<>();

    public AssetEpisodes(String tenantCode, String assetId, Map<UUID, Episode> episodes,
            Map<String, Instant> watermarks) {
        this.tenantCode = tenantCode;
        this.assetId = assetId;
        this.episodes = new HashMap<>(episodes);
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
