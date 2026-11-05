package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.ConcurrentModificationException;
import java.util.Map;
import java.util.Set;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Interleavings between a loaded evaluator snapshot and an operator close, without timing-dependent threads. */
class EpisodeRepositoryConcurrencyTest {

    @Test
    void anOperatorMarkerRejectsStaleWritesAndDeletesInMemory() {
        InMemoryEpisodeRepository repository = new InMemoryEpisodeRepository();
        assertMarkerProtectsSnapshots(repository, repository, "memory-close");
    }

    @Test
    void anOperatorCloseWithoutATripRejectsStaleReopeningInMemory() {
        InMemoryEpisodeRepository repository = new InMemoryEpisodeRepository();
        assertUnmarkedCloseProtectsSnapshot(repository, repository, "memory-forget");
    }

    /** Also run against independent Redis repository objects sharing the same native server. */
    static void assertMarkerProtectsSnapshots(EpisodeRepository evaluator, EpisodeRepository closer, String asset) {
        String tenant = "tenant-a";
        UUID id = UUID.randomUUID();
        UUID other = UUID.randomUUID();
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        Episode open = new Episode(id, "1.0.0", asset, at, at, null, Map.of(), at, at, 2, 10);
        Episode unaffected = Episode.start(other, "1.0.0", asset);
        AssetEpisodes initial = evaluator.load(tenant, asset);
        initial.save(tenant, open);
        initial.save(tenant, unaffected);
        initial.setWatermark(tenant, asset, "gps_signal", at);
        evaluator.save(initial);

        AssetEpisodes staleWrite = evaluator.load(tenant, asset);
        staleWrite.save(tenant, open);
        staleWrite.setWatermark(tenant, asset, "gps_signal", at.plusSeconds(60));
        AssetEpisodes staleDelete = evaluator.load(tenant, asset);
        staleDelete.delete(tenant, asset, id);
        staleDelete.delete(tenant, asset, other);
        Episode marker = Episode.closedOnTrip(id, asset, "trip-2", at.plusSeconds(30));
        closer.operatorClose(tenant, asset, id, marker);

        assertThrows(ConcurrentModificationException.class, () -> evaluator.save(staleWrite));
        assertThrows(ConcurrentModificationException.class, () -> evaluator.save(staleDelete));
        AssetEpisodes after = evaluator.load(tenant, asset);
        assertEquals(marker, after.find(tenant, asset, id).orElseThrow());
        assertEquals(unaffected, after.find(tenant, asset, other).orElseThrow());
        assertEquals(at, after.watermark(tenant, asset, "gps_signal").orElseThrow());
        assertEquals(Set.of(tenant), evaluator.tenantsWithEpisodes(asset));

        // Redelivery can use the newly loaded snapshot and advance its watermark without losing the marker.
        after.setWatermark(tenant, asset, "gps_signal", at.plusSeconds(60));
        evaluator.save(after);
        assertEquals(marker, closer.load(tenant, asset).find(tenant, asset, id).orElseThrow());
        assertEquals(at.plusSeconds(60), closer.load(tenant, asset)
                .watermark(tenant, asset, "gps_signal").orElseThrow());
    }

    static void assertUnmarkedCloseProtectsSnapshot(EpisodeRepository evaluator, EpisodeRepository closer,
            String asset) {
        String tenant = "tenant-a";
        UUID id = UUID.randomUUID();
        AssetEpisodes stale = evaluator.load(tenant, asset);
        stale.save(tenant, Episode.start(id, "1.0.0", asset));
        closer.forget(tenant, asset, id);

        assertThrows(ConcurrentModificationException.class, () -> evaluator.save(stale));
        assertTrue(evaluator.load(tenant, asset).find(tenant, asset, id).isEmpty());
        assertTrue(evaluator.tenantsWithEpisodes(asset).isEmpty());
    }
}
