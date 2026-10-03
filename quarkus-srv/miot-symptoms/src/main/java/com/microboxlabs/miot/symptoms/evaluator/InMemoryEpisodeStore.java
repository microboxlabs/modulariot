package com.microboxlabs.miot.symptoms.evaluator;

import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local episodes, for tests and for a single evaluator replica before the database store exists. */
public class InMemoryEpisodeStore implements EpisodeStore {

    private record Key(String tenantCode, String assetId, UUID definitionId) {
    }

    private final Map<Key, Episode> episodes = new ConcurrentHashMap<>();

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

    public int size() {
        return episodes.size();
    }
}
