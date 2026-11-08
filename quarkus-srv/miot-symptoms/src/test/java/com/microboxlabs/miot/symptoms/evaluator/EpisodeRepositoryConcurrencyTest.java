package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
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
    void aTripCloseRejectsAnEpisodeWhoseOpeningHasNotBeenSavedYet() {
        InMemoryEpisodeRepository repository = new InMemoryEpisodeRepository();
        assertTripCloseProtectsSnapshot(repository, repository, "memory-trip-end");
    }

    static void assertTripCloseProtectsSnapshot(EpisodeRepository evaluator, EpisodeRepository closer, String asset) {
        String tenant = "tenant-a";
        UUID id = UUID.randomUUID();
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        AssetEpisodes pending = evaluator.load(tenant, asset);
        pending.save(tenant, new Episode(id, "1.0.0", asset, at, at, null, Map.of(), at, at, 2, 10,
                SymptomState.ACTIVE));

        closer.forgetStale(tenant, asset, id, SymptomState.ACTIVE, at);

        assertThrows(ConcurrentModificationException.class, () -> evaluator.save(pending));
        assertTrue(evaluator.load(tenant, asset).find(tenant, asset, id).isEmpty());
    }

    @Test
    void anOperatorCloseWithoutATripRejectsStaleReopeningInMemory() {
        InMemoryEpisodeRepository repository = new InMemoryEpisodeRepository();
        assertUnmarkedCloseProtectsSnapshot(repository, repository, "memory-forget");
    }

    @Test
    void legacyRecoveryDoesNotOverwriteAnotherProducersConcurrentUpdate() {
        String tenant = "tenant-demo";
        String asset = "vehicle-demo";
        UUID gps = UUID.randomUUID();
        UUID lost = UUID.randomUUID();
        Instant at = Instant.parse("2026-10-22T03:00:00Z");
        InMemoryEpisodeRepository repository = new InMemoryEpisodeRepository();
        AssetEpisodes initial = repository.load(tenant, asset);
        initial.save(tenant, new Episode(gps, "1.0.0", asset, at, at, null, Map.of(), at, at, 1, 10,
                SymptomState.ACTIVE));
        initial.save(tenant, new Episode(lost, "1.0.0", asset, at, at, null, Map.of(), at, at, 1, 30,
                SymptomState.ACTIVE));
        repository.save(initial);
        AssetEpisodes gpsSnapshot = repository.load(tenant, asset);

        Episode advanced = new Episode(lost, "1.0.0", asset, at, at, null, Map.of(4, at.plusSeconds(30)),
                at.plusSeconds(60), at, 4, 125, SymptomState.ACTIVE);
        AssetEpisodes detector = repository.load(tenant, asset);
        detector.save(tenant, advanced);
        repository.save(detector);

        var lookups = new java.util.ArrayList<UUID>();
        TransitionLog log = new InMemoryTransitionLog() {
            @Override
            public Opening opening(String code, Episode episode) {
                lookups.add(episode.definitionId());
                return new Opening("T-1", Map.of());
            }
        };
        CompiledSymptom symptom = CompiledSymptom.compile(gps, "1.0.0", SymptomState.ACTIVE,
                com.microboxlabs.miot.symptoms.catalog.service.Specs.speeding(),
                com.microboxlabs.miot.symptoms.catalog.service.Specs.gpsSignal());
        gpsSnapshot.restoreCases(log, java.util.List.of(symptom));
        assertEquals(java.util.List.of(gps), lookups, "only this producer's cases are recovered");
        assertTrue(gpsSnapshot.saved().isEmpty(), "metadata recovery alone never writes rule state");
        repository.save(gpsSnapshot);
        assertEquals(advanced, repository.load(tenant, asset).find(tenant, asset, lost).orElseThrow());
        assertEquals(null, repository.load(tenant, asset).find(tenant, asset, gps).orElseThrow().tripId(),
                "a replay/no-op leaves even its own concurrent state alone");

        new SignalEvaluator(gpsSnapshot).evaluate(tenant, asset, at.plusSeconds(60),
                Map.of("signal", Map.of("trip", Map.of("active", true, "id", "T-1"),
                        "vehicle", Map.of("weight_category", "HEAVY"),
                        "frame", Map.of("gps", Map.of("speed", 110.0)),
                        "road", Map.of("maxspeed_osm", 90.0))), java.util.List.of(symptom));
        repository.save(gpsSnapshot);
        AssetEpisodes after = repository.load(tenant, asset);
        assertEquals(advanced, after.find(tenant, asset, lost).orElseThrow(),
                "GPS keeps the detector's maximum, level, and timers");
        assertEquals("T-1", after.find(tenant, asset, gps).orElseThrow().tripId());
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
