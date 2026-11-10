package com.microboxlabs.miot.symptoms.evaluator;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import java.time.Instant;
import java.util.ConcurrentModificationException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;

/** Process-local episodes, for tests and for one replica without Redis. */
public class InMemoryEpisodeRepository implements EpisodeRepository {

    private record Key(String tenantCode, String assetId) {
    }

    private record Snapshot(Map<UUID, Episode> episodes, Map<String, Instant> watermarks, long closeRevision) {
    }

    private final Map<Key, Snapshot> data = new ConcurrentHashMap<>();
    private final Map<String, Set<String>> tenants = new ConcurrentHashMap<>();

    @Override
    public Set<String> tenantsWithEpisodes(String assetId) {
        return Set.copyOf(tenants.getOrDefault(assetId, Set.of()));
    }

    @Override
    public AssetEpisodes load(String tenantCode, String assetId) {
        Snapshot s = data.getOrDefault(new Key(tenantCode, assetId), new Snapshot(Map.of(), Map.of(), 0));
        return new AssetEpisodes(tenantCode, assetId, s.episodes(), s.watermarks(), s.closeRevision());
    }

    @Override
    public void save(AssetEpisodes changes) {
        data.compute(new Key(changes.tenantCode(), changes.assetId()), (k, old) -> {
            long revision = old == null ? 0 : old.closeRevision();
            if (revision != changes.closeRevision()) {
                throw new ConcurrentModificationException("An operator closed a case after the episodes were loaded");
            }
            Map<UUID, Episode> episodes = new HashMap<>(old == null ? Map.of() : old.episodes());
            Map<String, Instant> watermarks = new HashMap<>(old == null ? Map.of() : old.watermarks());
            episodes.putAll(changes.saved());
            changes.deleted().forEach(episodes::remove);
            watermarks.putAll(changes.marked());
            index(changes.tenantCode(), changes.assetId(), !episodes.isEmpty());
            return new Snapshot(episodes, watermarks, revision);
        });
    }

    @Override
    public void forget(String tenantCode, String assetId, UUID definitionId) {
        operatorClose(tenantCode, assetId, definitionId, null);
    }

    @Override
    public void operatorClose(String tenantCode, String assetId, UUID definitionId, Episode marker) {
        data.compute(new Key(tenantCode, assetId), (k, old) -> {
            Map<UUID, Episode> episodes = new HashMap<>(old == null ? Map.of() : old.episodes());
            if (marker == null) {
                episodes.remove(definitionId);
            } else {
                episodes.put(definitionId, marker.continuingCondition(episodes.get(definitionId)));
            }
            index(tenantCode, assetId, !episodes.isEmpty());
            return new Snapshot(episodes, old == null ? Map.of() : old.watermarks(),
                    old == null ? 1 : Math.addExact(old.closeRevision(), 1));
        });
    }

    @Override
    public void forgetStale(String tenantCode, String assetId, UUID definitionId,
            SymptomState state, Instant openedAt) {
        data.compute(new Key(tenantCode, assetId), (k, old) -> {
            Episode e = old == null ? null : old.episodes().get(definitionId);
            if (e != null && (e.closedOnTrip() != null || (e.state() != null && e.state() != state)
                    || (e.openedAt() != null && e.openedAt().isAfter(openedAt)))) {
                return old;
            }
            Map<UUID, Episode> episodes = new HashMap<>(old == null ? Map.of() : old.episodes());
            episodes.remove(definitionId);
            index(tenantCode, assetId, !episodes.isEmpty());
            return new Snapshot(episodes, old == null ? Map.of() : old.watermarks(),
                    old == null ? 1 : Math.addExact(old.closeRevision(), 1));
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
