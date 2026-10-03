package com.microboxlabs.miot.symptoms.evaluator;

import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local episodes, for tests and for a single evaluator replica before the database store exists. */
public class InMemoryEpisodeStore implements EpisodeStore {

    private record Key(String tenantCode, String assetId, UUID definitionId) {
    }

    private record Stream(String tenantCode, String assetId, String sourceKey) {
    }

    private final Map<Key, Episode> episodes = new ConcurrentHashMap<>();
    private final Map<Stream, Instant> watermarks = new ConcurrentHashMap<>();

    @Override
    public Optional<Episode> find(String tenantCode, String assetId, UUID definitionId) {
        return Optional.ofNullable(episodes.get(new Key(tenantCode, assetId, definitionId)));
    }

    @Override
    public void save(String tenantCode, Episode episode) {
        episodes.put(new Key(tenantCode, episode.assetId(), episode.definitionId()), episode);
    }

    @Override
    public void delete(String tenantCode, String assetId, UUID definitionId) {
        episodes.remove(new Key(tenantCode, assetId, definitionId));
    }

    @Override
    public Optional<Instant> watermark(String tenantCode, String assetId, String sourceKey) {
        return Optional.ofNullable(watermarks.get(new Stream(tenantCode, assetId, sourceKey)));
    }

    @Override
    public void setWatermark(String tenantCode, String assetId, String sourceKey, Instant at) {
        watermarks.put(new Stream(tenantCode, assetId, sourceKey), at);
    }

    public int size() {
        return episodes.size();
    }
}
