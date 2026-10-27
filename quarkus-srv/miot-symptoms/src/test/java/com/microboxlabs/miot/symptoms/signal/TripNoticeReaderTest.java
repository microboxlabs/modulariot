package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.mutiny.Uni;
import java.time.Instant;
import java.util.ArrayDeque;
import java.util.List;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

class TripNoticeReaderTest {
    private static final Instant NOW = Instant.parse("2026-10-26T10:00:00Z");
    private static final String TENANT = "tenant-a";
    private static final String ASSET = "TEST-1";

    private static ReferenceCache.Trip trip(UUID id, String status) {
        return new ReferenceCache.Trip(id.toString(), TENANT, ASSET, "v", status, NOW.minusSeconds(60), null, false);
    }

    @Test
    void anOldReadCannotRestoreATripAfterALaterDeletion() {
        UUID id = UUID.randomUUID();
        ReferenceCache refs = new ReferenceCache();
        ReferenceCache.Trip old = trip(id, "old");
        refs.applyTrip(id.toString(), old);
        var first = new CompletableFuture<List<ReferenceCache.Trip>>();
        var second = new CompletableFuture<List<ReferenceCache.Trip>>();
        var reads = new ArrayDeque<>(List.of(first, second));
        TripNoticeReader reader = new TripNoticeReader(refs, key -> Uni.createFrom().completionStage(reads.remove()));
        reader.read(id);
        reader.read(id);
        second.complete(List.of());
        first.complete(List.of(old));
        assertTrue(refs.tripsAt(ASSET, NOW, List.of(TENANT)).isEmpty());
    }

    @Test
    void anOldDeletionCannotRemoveALaterReplacement() {
        UUID id = UUID.randomUUID();
        ReferenceCache refs = new ReferenceCache();
        var first = new CompletableFuture<List<ReferenceCache.Trip>>();
        var second = new CompletableFuture<List<ReferenceCache.Trip>>();
        var reads = new ArrayDeque<>(List.of(first, second));
        TripNoticeReader reader = new TripNoticeReader(refs, key -> Uni.createFrom().completionStage(reads.remove()));
        reader.read(id);
        reader.read(id);
        second.complete(List.of(trip(id, "new")));
        first.complete(List.of());
        assertEquals("new", refs.tripsAt(ASSET, NOW, List.of(TENANT)).get(TENANT).status());
    }

    @Test
    void aReloadDiscardsReadsThatStartedBeforeItsSnapshot() {
        UUID id = UUID.randomUUID();
        ReferenceCache refs = new ReferenceCache();
        var read = new CompletableFuture<List<ReferenceCache.Trip>>();
        TripNoticeReader reader = new TripNoticeReader(refs, key -> Uni.createFrom().completionStage(read));
        reader.read(id);
        reader.invalidate();
        refs.beginReload();
        refs.load(List.of(trip(id, "new")), List.of());
        read.complete(List.of(trip(id, "old")));
        assertEquals("new", refs.tripsAt(ASSET, NOW, List.of(TENANT)).get(TENANT).status());
    }
}
