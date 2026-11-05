package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import java.util.function.Predicate;

/** Process-local episodes, for tests and for one replica without Redis. */
public class InMemoryEpisodeRepository implements EpisodeRepository {

    private record Key(String tenantCode, String assetId) {
    }

    private record Snapshot(Map<UUID, Episode> episodes, Map<String, Instant> watermarks) {
    }

    private final Map<Key, Snapshot> data = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> tenants = new ConcurrentHashMap<>();

    @Override
    public Set<String> tenantsWithEpisodes(String assetId) {
        return Set.copyOf(tenants.getOrDefault(assetId, Set.of()));
    }

    @Override
    public AssetEpisodes load(String tenantCode, String assetId) {
        Snapshot s = data.getOrDefault(new Key(tenantCode, assetId), new Snapshot(Map.of(), Map.of()));
        return new AssetEpisodes(tenantCode, assetId, s.episodes(), s.watermarks());
    }

    @Override
    public void save(AssetEpisodes changes) {
        data.compute(new Key(changes.tenantCode(), changes.assetId()), (k, old) -> {
            Map<UUID, Episode> episodes = new HashMap<>(old == null ? Map.of() : old.episodes());
            Map<String, Instant> watermarks = new HashMap<>(old == null ? Map.of() : old.watermarks());
            episodes.putAll(changes.saved());
            changes.deleted().forEach(episodes::remove);
            watermarks.putAll(changes.marked());
            index(changes.tenantCode(), changes.assetId(), !episodes.isEmpty());
            return new Snapshot(episodes, watermarks);
        });
    }

    @Override
    public void forget(String tenantCode, String assetId, UUID definitionId) {
        forgetMatching(tenantCode, assetId, definitionId, e -> true);
    }

    @Override
    public void forgetStale(String tenantCode, String assetId, UUID definitionId,
            SymptomState state, Instant openedAt) {
        forgetMatching(tenantCode, assetId, definitionId, e -> (e.state() == null || e.state() == state)
                && (e.openedAt() == null || !e.openedAt().isAfter(openedAt)));
    }

    private void forgetMatching(String tenantCode, String assetId, UUID definitionId,
            Predicate<Episode> matches) {
        data.computeIfPresent(new Key(tenantCode, assetId), (k, old) -> {
            Map<UUID, Episode> episodes = new HashMap<>(old.episodes());
            episodes.computeIfPresent(definitionId, (id, e) -> matches.test(e) ? null : e);
            index(tenantCode, assetId, !episodes.isEmpty());
            return new Snapshot(episodes, old.watermarks());
        });
    }

    private void index(String tenantCode, String assetId, boolean hasEpisodes) {
        Set<String> onAsset = tenants.computeIfAbsent(assetId, k -> ConcurrentHashMap.newKeySet());
        if (hasEpisodes) {
            onAsset.add(tenantCode);
        } else {
            onAsset.remove(tenantCode);
        }
    }
}
