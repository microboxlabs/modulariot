package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.IngestHealth.Heartbeat;
import com.microboxlabs.miot.symptoms.lostsignal.LossStore.Schedule;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.vertx.mutiny.redis.client.Request;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class LossTickerTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final String TENANT = "tenant-a";

    private final TestClock clock = new TestClock(T0);
    private final InMemoryLossStore store = new InMemoryLossStore(clock);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final TripChecks trips = new TestEngine(clock).trips(meters);
    /** Without the ingest guard, which has its own test, and without waiting for backfill. */
    private final LostSignalDetector detector = new LostSignalDetector(true, store, LossSettings.defaults(),
            new LostSignalDetector.TickerSettings(Duration.ofMinutes(1), Duration.ofDays(1), Duration.ofSeconds(15),
                    500, new IngestHealth(Duration.ZERO, Duration.ZERO), Duration.ZERO),
            trips, meters, clock);

    private static Map<String, Object> signal(boolean onTrip) {
        return Map.of("sender", "S1", "trips", onTrip ? Map.of(TENANT, Map.of("active", true, "id", "T-1")) : Map.of(),
                "frame", Map.of("gps", Map.of("speed", 80.0), "sensors", Map.of("engine_status", true)));
    }

    /** A frame taken at {@code at} seconds that arrives 5 s later, with the clock moved to its arrival. */
    private void frame(int at, boolean onTrip) {
        clock.set(T0.plusSeconds(at + 5));
        detector.frame("V1", T0.plusSeconds(at), T0.plusSeconds(at + 5), signal(onTrip));
    }

    private double checks(String outcome) {
        return meters.counter("miot.symptoms.lost_signal.checks", "outcome", outcome).count();
    }

    @Test
    void aVehicleOnATripGetsADeadlineAtArrivalPlusTheExpectedSilence() {
        frame(0, true);

        // A new moving vehicle: 2 min default gap + 1 min default delay.
        assertEquals(T0.plusSeconds(5 + 180), store.deadline("V1"));
        assertEquals(new Watch(Map.of(TENANT, Map.of("active", true, "id", "T-1")), 180, "S1"),
                store.vehicle("V1").watch());
        frame(30, false);
        assertNull(store.deadline("V1"), "off the trip: no deadline");
    }

    @Test
    void theTickerChecksOnlyExpiredDeadlinesAndRechecksALostVehicle() {
        frame(0, true);
        clock.set(T0.plusSeconds(100));
        assertEquals(0, detector.tick());

        clock.set(T0.plusSeconds(190));
        assertEquals(1, detector.tick());
        assertEquals(1, checks("lost"));
        assertEquals(new CheckState(T0, T0.plusSeconds(190), Map.of()), store.vehicle("V1").check());
        assertEquals(T0.plusSeconds(250), store.deadline("V1"), "checked again in a minute");

        clock.set(T0.plusSeconds(250));
        detector.tick();
        assertEquals(1, checks("still_lost"));
    }

    @Test
    void aFrameAfterTheLossIsCheckedOnTheNextTickAsAReturn() {
        frame(0, true);
        clock.set(T0.plusSeconds(190));
        detector.tick();

        frame(400, true);
        assertEquals(T0.plusSeconds(405), store.deadline("V1"), "now: the return is checked next");
        detector.tick();

        assertEquals(1, checks("returned"));
        assertFalse(store.vehicle("V1").check().lost());
        // The 400 s gap is in the moving profile now: 400 s bucket 450 × 1.5 + 60 s delay.
        assertEquals(735, store.vehicle("V1").watch().expectedS());
        assertEquals(T0.plusSeconds(405 + 735), store.deadline("V1"));
    }

    @Test
    void aLateFrameLeavesTheDeadline() {
        frame(0, true);
        frame(60, true);
        Instant deadline = store.deadline("V1");

        clock.set(T0.plusSeconds(300));
        detector.frame("V1", T0.plusSeconds(30), T0.plusSeconds(300), signal(true));

        assertEquals(deadline, store.deadline("V1"));
    }

    @Test
    void aVehicleSilentPastTheMaximumIsNoLongerChecked() {
        frame(0, true);
        clock.set(T0.plusSeconds(190));
        detector.tick();
        clock.set(T0.plusSeconds(86_500));
        detector.tick();

        assertEquals(1, checks("gave_up"));
        assertNull(store.deadline("V1"));
        assertTrue(store.vehicle("V1").check().lost(), "a later frame still returns it");
    }

    @Test
    void onlyTheReplicaHoldingTheLeaseTicks() {
        frame(0, true);
        clock.set(T0.plusSeconds(190));
        assertTrue(store.lease("other", Duration.ofSeconds(15)));
        assertFalse(store.lease("third", Duration.ofSeconds(15)));
        assertTrue(store.lease("other", Duration.ofSeconds(15)), "renewed by its holder");

        assertEquals(0, detector.tick(), "another replica holds the lease");
        clock.advance(16);
        assertEquals(1, detector.tick(), "an expired lease moves");
    }

    @Test
    void aCheckDoesNotOverwriteADeadlineAFrameMovedMeanwhile() {
        frame(0, true);
        clock.set(T0.plusSeconds(190));
        LossStore.Vehicle read = store.vehicle("V1");
        frame(185, true);
        Instant moved = store.deadline("V1");

        assertFalse(store.checked("V1", read.deadline(), new CheckState(T0, T0.plusSeconds(190), Map.of()),
                T0.plusSeconds(250)), "the frame moved the deadline");
        assertEquals(moved, store.deadline("V1"));
        assertNull(store.vehicle("V1").check());
        assertFalse(store.checked("V1", read.deadline(), CheckState.NONE, null), "nor drops it");
        assertEquals(moved, store.deadline("V1"));
    }

    @Test
    void aLostVehicleThatLeavesItsTripIsCheckedOnceMoreAndCleared() {
        frame(0, true);
        clock.set(T0.plusSeconds(190));
        detector.tick();
        assertTrue(store.vehicle("V1").check().lost());

        frame(400, false);
        assertTrue(store.vehicle("V1").watch().trips().isEmpty(), "the watch keeps only its sender");
        assertEquals(T0.plusSeconds(405), store.deadline("V1"), "one more check to clear the loss");
        detector.tick();

        assertEquals(1, checks("no_trip"));
        assertNull(store.vehicle("V1").check());
        assertNull(store.deadline("V1"));
    }

    @Test
    void aLongBatchStopsOnceAnotherReplicaTookTheLease() {
        frame(0, true);
        LostSignalDetector.TickerSettings settings = new LostSignalDetector.TickerSettings(Duration.ofMinutes(1),
                Duration.ofDays(1), Duration.ofSeconds(15), 500, new IngestHealth(Duration.ZERO, Duration.ZERO),
                Duration.ZERO);
        LossTicker slow = new LossTicker(store, (asset, now) -> {
            clock.advance(16);
            assertTrue(store.lease("other", Duration.ofSeconds(15)));
        }, settings.ingest(), "mine", settings.leaseTtl(), settings.batch(), meters, clock);
        store.save("V2", store.vehicle("V1").profile(), null, null,
                Schedule.at(T0, store.vehicle("V1").watch()), null, null);
        clock.set(T0.plusSeconds(190));

        assertEquals(1, slow.tick(), "the second vehicle waits for the lease holder");
        assertEquals(1, meters.counter("miot.symptoms.lost_signal.lease_lost").count());
    }

    @Test
    void theTickerPausesWhileOurIngestIsBehind() {
        IngestHealth health = new IngestHealth(Duration.ofMinutes(2), Duration.ofMinutes(2));
        Instant now = T0.plusSeconds(600);

        assertEquals(Optional.of("stale"), health.pause(List.of(), now));
        assertEquals(Optional.of("stale"), health.pause(List.of(new Heartbeat("a", now.minusSeconds(200),
                Duration.ZERO)), now));
        assertEquals(Optional.of("lag"), health.pause(List.of(new Heartbeat("a", now.minusSeconds(1),
                Duration.ofMinutes(5))), now));
        assertEquals(Optional.empty(), health.pause(List.of(new Heartbeat("a", now.minusSeconds(1),
                Duration.ofSeconds(3)), new Heartbeat("gone", now.minusSeconds(900), Duration.ofHours(1))), now));
        assertEquals(Optional.empty(), new IngestHealth(Duration.ZERO, Duration.ZERO).pause(List.of(), now));

        LostSignalDetector guarded = new LostSignalDetector(true, store, LossSettings.defaults(),
                LostSignalDetector.TickerSettings.defaults(), trips, meters, clock);
        clock.set(T0.plusSeconds(5));
        guarded.frame("V1", T0, T0.plusSeconds(5), signal(true));
        clock.set(T0.plusSeconds(600));
        assertEquals(0, guarded.tick(), "no signal read for 10 min");
        assertEquals(1, meters.counter("miot.symptoms.lost_signal.paused", "reason", "stale").count());
    }

    @Test
    void redisWritesTheFrameInOneBatch() {
        VehicleProfile v = VehicleProfile.first(new Frame("V1", "S1", T0, T0, null, null, 0.0, true));
        Watch w = new Watch(Map.of(TENANT, Map.of("active", true)), 180, "S1");

        assertEquals(List.of("HSET", "EXPIRE", "SET", "ZADD", "EXPIRE"), commands(RedisLossStore.saveRequests("V1",
                v, "S1", SenderProfile.empty(), Schedule.at(T0, w), null, Duration.ofDays(7))));
        assertEquals(List.of("HSET", "EXPIRE", "HSET", "EXPIRE", "GEOADD", "EXPIRE"), commands(RedisLossStore
                .cellRequests("V1", "S1", new LossStore.Cells("1:2", null, null, -33.0, -71.0), T0)));
        assertEquals("symptoms:geo:5890752", RedisLossStore.geoKey(T0));
        assertEquals(List.of("HSET", "HDEL", "ZREM", "EXPIRE"), commands(RedisLossStore.saveRequests("V1", v, null,
                null, Schedule.DROP, null, Duration.ofDays(7))));
        assertEquals(List.of("HSET", "HSETNX", "HSET", "EXPIRE"), commands(RedisLossStore.saveRequests("V1", v, null,
                null, Schedule.KEEP, new LossStore.Mark(T0, T0, true), Duration.ofDays(7))));
        assertEquals(List.of("HSET", "EXPIRE", "ZADD", "EXPIRE"), commands(RedisLossStore.saveRequests("V1",
                v, null, null, Schedule.clear(T0, new Watch(Map.of(), 180, "S1")), null, Duration.ofDays(7))));
        assertEquals(List.of("EVAL"), commands(List.of(RedisLossStore.checkedRequest("V1", T0, CheckState.NONE, T0,
                Duration.ofDays(7)))));
        assertEquals(Optional.of(new Heartbeat("a", T0, Duration.ofMillis(1500))),
                RedisLossStore.heartbeat("a", T0.toEpochMilli() + ":1500"));
        assertEquals(Optional.empty(), RedisLossStore.heartbeat("a", "garbage"));
    }

    private static List<String> commands(List<Request> requests) {
        return requests.stream().map(r -> r.command().toString().toUpperCase(Locale.ROOT)).toList();
    }
}
