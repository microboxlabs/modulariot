package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.gps.SignalStates.SignalState;
import com.microboxlabs.miot.core.gps.SignalStates.Status;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.vertx.core.buffer.Buffer;
import io.vertx.mutiny.redis.client.Response;
import io.vertx.redis.client.impl.types.BulkType;
import io.vertx.redis.client.impl.types.MultiType;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SignalStateReaderTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final LossSettings SETTINGS = LossSettings.defaults();
    /** No sender history: the default delivery delay. */
    private static final Duration DEFAULT_DELAY = SETTINGS.defaultDelay();

    private final InMemoryLossStore store = new InMemoryLossStore();
    private final ArrivalProfiles profiles = new ArrivalProfiles(store, SETTINGS);
    private final SignalStateReader reader = new SignalStateReader(store, profiles);

    private static Frame frame(String asset, String sender, int at, int arrived, double speed) {
        return new Frame(asset, sender, T0.plusSeconds(at), T0.plusSeconds(arrived), -20.0, -69.0, speed, true);
    }

    private SignalState state(String asset, Instant now) {
        return reader.state(asset, now);
    }

    @Test
    void offlineOnlyOnceTheSilenceSinceTheNewestArrivalPassesTheExpectedOne() {
        profiles.observe(frame("V1", "S1", 0, 10, 50));
        // Moving, no history: the motion's 2 min gap plus the default delivery delay.
        Duration expected = SETTINGS.defaultGap().get(Motion.MOVING).plus(DEFAULT_DELAY);
        Instant deadline = T0.plusSeconds(10).plus(expected);

        SignalState before = state("V1", deadline.minusMillis(1));
        SignalState at = state("V1", deadline);
        SignalState after = state("V1", deadline.plusMillis(1));

        assertEquals(Status.ONLINE, before.status());
        assertNull(before.offlineSince());
        assertEquals(Status.ONLINE, at.status(), "the silence must pass the expected one");
        assertEquals(Status.OFFLINE, after.status());
        assertEquals(T0, after.offlineSince(), "since the newest frame's GPS time, not its arrival");
        assertEquals(expected.toSeconds(), after.expectedS());
        assertEquals(expected.toSeconds(), after.silenceS());
        assertEquals(T0, after.lastFrameAt());
    }

    @Test
    void aVehicleNeverSeenOrWhoseProfileExpiredIsUnknown() {
        profiles.observe(frame("V1", "S1", 0, 10, 50));

        assertEquals(SignalState.UNKNOWN, state("V2", T0));
        assertEquals(SignalState.UNKNOWN, state("V1", T0.plusSeconds(10).plus(SETTINGS.profileTtl()).plusSeconds(1)));
        assertEquals(Status.OFFLINE, state("V1", T0.plus(SETTINGS.profileTtl())).status());
    }

    @Test
    void aLateFrameKeepsTheNewestFrameAndItsArrival() {
        profiles.observe(frame("V1", "S1", 0, 10, 50));
        profiles.observe(frame("V1", "S1", 600, 610, 50));
        Instant now = T0.plusSeconds(2000);
        SignalState lost = state("V1", now);

        profiles.observe(frame("V1", "S1", 300, 1990, 50));
        SignalState afterLate = state("V1", now);

        assertEquals(Status.OFFLINE, lost.status());
        assertEquals(T0.plusSeconds(600), lost.offlineSince());
        assertEquals(Status.OFFLINE, afterLate.status(), "the silence still exceeds the learned threshold");
        assertEquals(T0.plusSeconds(600), afterLate.offlineSince());
    }

    @Test
    void offTripALateFrameCanChangeTheLiveDelayButNeverTheNewestFrame() {
        for (int i = 0; i < SETTINGS.minSamples() - 2; i++) {
            profiles.observe(frame("OTHER", "S1", i * 30, i * 30 + 600, 50));
        }
        profiles.observe(frame("V1", "S1", 600, 610, 50));
        SignalState before = state("V1", T0.plusSeconds(800));
        assertEquals(Status.OFFLINE, before.status());
        assertEquals(T0.plusSeconds(600), before.offlineSince());

        profiles.observe(frame("V1", "S1", 100, 700, 50));
        SignalState after = state("V1", T0.plusSeconds(800));
        assertEquals(Status.ONLINE, after.status(), "the twentieth sample replaces the default sender delay");
        assertEquals(720, after.expectedS());
        assertEquals(before.lastFrameAt(), after.lastFrameAt());
        assertEquals(before.silenceS(), after.silenceS());
        assertEquals(before.offlineSince(), state("V1", T0.plusSeconds(1400)).offlineSince());
    }

    @Test
    void anEmptyTripWatchUsesTheLiveSenderDelayWhileAnActiveWatchKeepsItsThreshold() {
        for (int i = 0; i < SETTINGS.minSamples(); i++) {
            profiles.observe(frame("OTHER", "S1", i * 30, i * 30 + 600, 50));
        }
        ArrivalProfiles.Arrival arrival = profiles.observe(frame("V1", "S1", 0, 600, 50));
        Watch empty = new Watch(Map.of(), 42, "S1");
        store.save("V1", arrival.vehicle(), "S1", arrival.sender(),
                LossStore.Schedule.clear(T0.plusSeconds(600), empty), null, null);

        assertEquals(arrival.sender(), store.seen(List.of("V1")).get("V1").sender());
        assertEquals(720, state("V1", T0.plusSeconds(700)).expectedS());

        Watch active = new Watch(Map.of("org-a", Map.of("trip_id", "T1")), 42, "S1");
        store.save("V1", arrival.vehicle(), "S1", arrival.sender(),
                LossStore.Schedule.at(T0.plusSeconds(642), active), null, null);
        assertNull(store.seen(List.of("V1")).get("V1").sender());
        assertEquals(42, state("V1", T0.plusSeconds(700)).expectedS());
    }

    @Test
    void aNewerFrameBringsTheVehicleBack() {
        profiles.observe(frame("V1", "S1", 0, 10, 50));
        Instant now = T0.plusSeconds(1200);
        assertEquals(Status.OFFLINE, state("V1", now).status());

        profiles.observe(frame("V1", "S1", 1190, 1195, 50));

        assertEquals(Status.ONLINE, state("V1", now).status());
    }

    @Test
    void offATripTheExpectedSilenceUsesTheVehiclesSender() {
        // S1 delivers 10 min late: its delay profile replaces the default after enough frames.
        for (int i = 0; i < SETTINGS.minSamples(); i++) {
            profiles.observe(frame("OTHER", "S1", i * 30, i * 30 + 600, 50));
        }
        profiles.observe(frame("V1", "S1", 0, 600, 50));
        profiles.observe(frame("V2", "S2", 0, 600, 50));

        long v1 = state("V1", T0.plusSeconds(600)).expectedS();
        long v2 = state("V2", T0.plusSeconds(600)).expectedS();

        assertEquals(120 + 600, v1);
        assertEquals(120 + DEFAULT_DELAY.toSeconds(), v2);
    }

    @Test
    void aNewestFrameWithoutASenderUsesTheDefaultDelay() {
        for (int i = 0; i < SETTINGS.minSamples(); i++) {
            profiles.observe(frame("OTHER", "S1", i * 30, i * 30 + 600, 50));
        }
        profiles.observe(frame("V1", "S1", 0, 600, 50));
        profiles.observe(frame("V1", null, 30, 630, 50));

        assertNull(store.seen(List.of("V1")).get("V1").profile().sender());
        assertEquals(120 + DEFAULT_DELAY.toSeconds(), state("V1", T0.plusSeconds(630)).expectedS());
    }

    @Test
    void lateFramesAndReplaysKeepTheNewestFramesSender() {
        profiles.observe(frame("V1", "S1", 60, 70, 50));
        profiles.observe(frame("V1", "S2", 30, 80, 50));
        profiles.observe(frame("V1", "S3", 60, 90, 50));

        assertEquals("S1", store.seen(List.of("V1")).get("V1").profile().sender());
        profiles.observe(frame("V1", "S2", 90, 100, 50));
        assertEquals("S2", store.seen(List.of("V1")).get("V1").profile().sender());
    }

    @Test
    void redisProfilesWrittenWithoutSenderRemainReadableWithTheDefaultDelay() {
        VehicleProfile legacy = new VehicleProfile(T0, T0.plusSeconds(10), T0.plusSeconds(10), Motion.MOVING,
                Map.of(), null);
        String json = RedisLossStore.write(legacy);
        assertFalse(json.contains("sender"));
        LossStore.Seen seen = RedisLossStore.seen(List.of("V1"), List.of(fields(json, null))).get("V1");

        assertEquals(legacy, seen.profile());
        assertNull(seen.profile().sender());
        assertEquals(120 + DEFAULT_DELAY.toSeconds(), reader.state(seen, T0.plusSeconds(10)).expectedS());
    }

    @Test
    void onATripTheStateTurnsOfflineWhenTheDetectorsDeadlinePasses() {
        TestClock clock = new TestClock(T0);
        LostSignalDetector detector = new LostSignalDetector(true, store, SETTINGS,
                LostSignalDetector.TickerSettings.defaults(), null, new SimpleMeterRegistry(), clock);
        Map<String, Object> signal = Map.of("sender", "S1", "frame", Map.of("gps", Map.of("speed", 50.0)),
                "trips", Map.of("org-a", Map.of("active", true, "trip_id", "T1")));
        detector.frame("V1", T0, T0.plusSeconds(10), signal);
        Instant deadline = store.vehicle("V1").deadline();

        assertTrue(store.due(deadline.minusMillis(1), 10).isEmpty());
        assertEquals(Status.ONLINE, detector.state("V1", deadline.minusMillis(1)).status());
        assertEquals(List.of("V1"), store.due(deadline.plusMillis(1), 10));
        assertEquals(Status.OFFLINE, detector.state("V1", deadline.plusMillis(1)).status());
    }

    @Test
    void manyVehiclesAreReadInOneCall() {
        profiles.observe(frame("V1", "S1", 0, 10, 50));
        profiles.observe(frame("V2", "S1", 0, 1190, 50));
        List<Integer> reads = new ArrayList<>();
        LossStore counting = new InMemoryLossStore() {
            @Override
            public Map<String, Seen> seen(java.util.Collection<String> assetIds) {
                reads.add(assetIds.size());
                return store.seen(assetIds);
            }
        };

        Map<String, SignalState> states = new SignalStateReader(counting, profiles)
                .states(List.of("V1", "V2", "V3"), T0.plusSeconds(1200));

        assertEquals(List.of(3), reads);
        assertEquals(List.of("V1", "V2", "V3"), List.copyOf(states.keySet()));
        assertEquals(Status.OFFLINE, states.get("V1").status());
        assertEquals(Status.ONLINE, states.get("V2").status());
        assertEquals(Status.UNKNOWN, states.get("V3").status());
    }

    @Test
    void redisReadsEveryVehicleInOnePipelineAndDropsThoseWithoutAProfile() {
        ArrivalProfiles.Arrival a = profiles.observe(frame("V1", "S1", 0, 10, 50));
        Watch watch = new Watch(Map.of(), 300, "S1");

        List<String> commands = RedisLossStore.seenRequests(List.of("V1", "V2")).stream()
                .map(r -> r.command().toString().toUpperCase(Locale.ROOT)).toList();
        Map<String, LossStore.Seen> seen = RedisLossStore.seen(List.of("V1", "V2"),
                List.of(fields(RedisLossStore.write(a.vehicle()), RedisLossStore.write(watch)), fields(null, null)));

        assertEquals(List.of("HMGET", "HMGET"), commands);
        assertEquals(List.of("V1"), List.copyOf(seen.keySet()));
        assertEquals(a.vehicle(), seen.get("V1").profile());
        assertEquals("S1", seen.get("V1").profile().sender(), "the profile keeps the newest frame's sender");
        assertEquals(watch, seen.get("V1").watch());
    }

    private static Response fields(String profile, String watch) {
        MultiType m = MultiType.create(2, false);
        m.add(profile == null ? null : BulkType.create(Buffer.buffer(profile), false));
        m.add(watch == null ? null : BulkType.create(Buffer.buffer(watch), false));
        return Response.newInstance(m);
    }
}
