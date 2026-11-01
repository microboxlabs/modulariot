package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.ArrivalProfiles.Arrival;
import io.vertx.mutiny.redis.client.Request;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class ArrivalProfilesTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final LossSettings SETTINGS = LossSettings.defaults();

    private final ArrivalProfiles profiles = new ArrivalProfiles(new InMemoryLossStore(), SETTINGS);

    private static Frame frame(String asset, String sender, int at, int arrived, double speed, Boolean engine) {
        return new Frame(asset, sender, T0.plusSeconds(at), T0.plusSeconds(arrived), -20.0, -69.0, speed, engine);
    }

    @Test
    void aLateFrameNeverMovesTheNewestFrameBack() {
        profiles.observe(frame("V1", "S1", 0, 1, 50, true));
        profiles.observe(frame("V1", "S1", 60, 61, 50, true));
        Arrival late = profiles.observe(frame("V1", "S1", 30, 300, 50, true));
        Arrival replay = profiles.observe(frame("V1", "S1", 60, 301, 50, true));

        assertTrue(late.late());
        assertFalse(late.replay());
        assertTrue(replay.replay());
        assertEquals(T0.plusSeconds(60), replay.vehicle().at());
        assertEquals(T0.plusSeconds(61), replay.vehicle().arrival(), "the newest frame's arrival");
        assertEquals(T0.plusSeconds(301), replay.vehicle().seen());
        assertEquals(1, replay.vehicle().gaps().get(Motion.MOVING).count(), "only the gap between newest frames");
    }

    @Test
    void gapsAreKeptByTheMotionOfTheFrameBeforeThem() {
        profiles.observe(frame("V1", "S1", 0, 1, 50, true));
        profiles.observe(frame("V1", "S1", 30, 31, 0, true));
        profiles.observe(frame("V1", "S1", 330, 331, 0, false));
        Arrival a = profiles.observe(frame("V1", "S1", 2130, 2131, 0, false));

        assertEquals(30, a.vehicle().gaps().get(Motion.MOVING).ewma());
        assertEquals(300, a.vehicle().gaps().get(Motion.STOPPED).ewma());
        assertEquals(1800, a.vehicle().gaps().get(Motion.ENGINE_OFF).ewma());
        assertEquals(Motion.ENGINE_OFF, a.vehicle().motion());
        assertEquals(new VehicleProfile.Last(T0.plusSeconds(2130), -20.0, -69.0, 0.0, false), a.vehicle().last());
    }

    @Test
    void theExpectedSilenceIsTheVehiclesGapPlusTheSendersDelay() {
        Arrival a = null;
        for (int i = 0; i <= 40; i++) {
            a = profiles.observe(frame("V1", "S1", i * 30, i * 30 + 5, 80, true));
        }
        // p95 of 30 s gaps is the 30 s bucket, times 1.5 is 45 s, under the 60 s floor; 5 s delays fall in their bucket.
        assertEquals(Duration.ofSeconds(60).plusSeconds(5), a.expected());
    }

    @Test
    void aSlowReporterExpectsItsOwnGap() {
        Arrival a = null;
        for (int i = 0; i <= 25; i++) {
            a = profiles.observe(frame("V2", "S1", i * 600, i * 600 + 2, 80, true));
        }
        assertEquals(Duration.ofSeconds(900 + 2), a.expected());
    }

    @Test
    void aNewVehicleUsesTheMotionsDefaultUntilItHasEnoughGaps() {
        Arrival moving = profiles.observe(frame("V3", null, 0, 0, 80, true));
        assertEquals(Duration.ofMinutes(2).plus(SETTINGS.defaultDelay()), moving.expected());
        Arrival off = profiles.observe(frame("V3", null, 30, 30, 0, false));
        assertEquals(Duration.ofHours(1).plus(SETTINGS.defaultDelay()), off.expected());
    }

    @Test
    void aBatchForwardingSenderGetsItsOwnDelayUpToTheCap() {
        Arrival a = null;
        for (int i = 0; i <= 30; i++) {
            a = profiles.observe(frame("V4", "BATCH", i * 30, i * 30 + 1500, 80, true));
        }
        assertEquals(Duration.ofSeconds(1800), a.sender().deliveryDelay(SETTINGS));
        for (int i = 0; i <= 30; i++) {
            a = profiles.observe(frame("V5", "SLOW", i * 30, i * 30 + 20000, 80, true));
        }
        assertEquals(SETTINGS.maxDelay(), a.sender().deliveryDelay(SETTINGS));
    }

    @Test
    void sketchesFadeOldValuesAndErrLong() {
        Sketch s = Sketch.empty();
        for (int i = 0; i < 100; i++) {
            s = s.add(25, 0.01);
        }
        assertEquals(30, s.quantile(0.95), "the bucket's upper bound");
        for (int i = 0; i < 1000; i++) {
            s = s.add(500, 0.01);
        }
        assertEquals(600, s.quantile(0.5));
        assertTrue(s.ewma() > 499 && s.ewma() < 501);
        assertEquals(86_400, Sketch.empty().add(86_400, 0.1).add(86_400, 0.1).quantile(0.95),
                "above the last bound: the longest value seen, not a fixed guess");
    }

    @Test
    void aSmallWeightKeepsFadingAtTheSendersMemory() {
        Sketch s = Sketch.empty().add(5, 1.0 / 5000);
        for (int i = 0; i < 20_000; i++) {
            s = s.add(60, 1.0 / 5000);
        }
        assertTrue(s.weights()[Sketch.bucket(5)] < 0.05, "the first value faded");
    }

    @Test
    void theDefaultDelayIsCappedToo() {
        LossSettings capped = new LossSettings(SETTINGS.profileTtl(), SETTINGS.vehicleMemory(),
                SETTINGS.senderMemory(), SETTINGS.minSamples(), SETTINGS.gapQuantile(), SETTINGS.gapMargin(),
                SETTINGS.defaultGap(), SETTINGS.minGap(), SETTINGS.delayQuantile(), SETTINGS.defaultDelay(),
                Duration.ofSeconds(20));
        assertEquals(Duration.ofSeconds(20), SenderProfile.empty().deliveryDelay(capped));
    }

    @Test
    void aFrameFromTheFutureIsReadAtItsArrival() {
        profiles.observe(frame("V1", "S1", 0, 1, 50, true));
        Arrival future = profiles.observe(frame("V1", "S1", 86_400, 61, 50, true));
        Arrival next = profiles.observe(frame("V1", "S1", 90, 91, 50, true));

        assertEquals(T0.plusSeconds(61), future.vehicle().at());
        assertFalse(next.late(), "normal frames are not stuck behind it");
        assertEquals(T0.plusSeconds(90), next.vehicle().at());
    }

    @Test
    void aReplayStillCountsForTheSender() {
        profiles.observe(frame("V1", "S1", 0, 1, 50, true));
        Arrival other = profiles.observe(frame("V1", "S2", 0, 40, 50, true));

        assertTrue(other.replay());
        assertEquals(1, other.sender().delay().count(), "the second sender's delay is sampled");
    }

    @Test
    void aFailingStoreMakesTheDetectorSkipFramesForAWhile() {
        LossStore down = new LossStore() {
            @Override
            public Profiles load(String assetId, String sender) {
                throw new IllegalStateException("Redis down");
            }

            @Override
            public void save(String assetId, VehicleProfile vehicle, String sender, SenderProfile senderProfile) {
                // never reached: load fails first
            }
        };
        io.micrometer.core.instrument.simple.SimpleMeterRegistry meters =
                new io.micrometer.core.instrument.simple.SimpleMeterRegistry();
        LostSignalDetector detector = new LostSignalDetector(true, new ArrivalProfiles(down, SETTINGS), meters);
        Map<String, Object> signal = Map.of("sender", "S1", "frame", Map.of("gps", Map.of("speed", 50.0)));

        detector.frame("V1", T0, T0, signal);
        detector.frame("V1", T0.plusSeconds(30), T0.plusSeconds(30), signal);

        assertEquals(1, meters.counter("miot.symptoms.lost_signal.failed").count());
        assertEquals(1, meters.counter("miot.symptoms.lost_signal.skipped").count(), "no wait on a stalled store");
    }

    @Test
    void aVehicleBackAfterTheProfileTtlStartsOver() {
        profiles.observe(frame("V1", "S1", 0, 1, 50, true));
        profiles.observe(frame("V1", "S1", 30, 31, 50, true));
        int later = (int) SETTINGS.profileTtl().toSeconds() + 3600;
        Arrival back = profiles.observe(frame("V1", "S1", later, later + 1, 50, true));

        assertTrue(back.vehicle().gaps().isEmpty(), "no gap across the absence");
    }

    @Test
    void profilesRoundTripThroughRedisJsonWithOneTtlPerKey() {
        profiles.observe(frame("V1", "S1", 0, 1, 50, true));
        Arrival a = profiles.observe(frame("V1", "S1", 60, 70, 0, null));

        String json = RedisLossStore.write(a.vehicle());
        assertEquals(a.vehicle(), RedisLossStore.JSON.convertValue(
                RedisLossStore.JSON.convertValue(a.vehicle(), Map.class), VehicleProfile.class));
        assertTrue(json.contains("\"at\":1767225660000"), "times in epoch ms");
        List<Request> writes = RedisLossStore.saveRequests("V1", a.vehicle(), "S1", a.sender(),
                Duration.ofDays(7));
        assertEquals(List.of("HSET", "EXPIRE", "SET"),
                writes.stream().map(r -> r.command().toString().toUpperCase(java.util.Locale.ROOT)).toList());
        assertEquals(2, RedisLossStore.saveRequests("V1", a.vehicle(), null, a.sender(), Duration.ofDays(7))
                .size());
    }

    @Test
    void theFrameIsReadFromTheSignal() {
        Map<String, Object> signal = Map.of("sender", "S1", "frame", Map.of("gps",
                Map.of("speed", 72.0, "latitude", -20.5, "longitude", -69.5), "sensors", Map.of("engine_status", true)));

        Frame f = Frame.of(signal, "V1", T0, T0.plusSeconds(9));

        assertEquals(new Frame("V1", "S1", T0, T0.plusSeconds(9), -20.5, -69.5, 72.0, true), f);
        assertEquals(Motion.MOVING, f.motion());
        assertEquals(9, f.delaySeconds());
    }
}
