package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.symptoms.lostsignal.TestClock;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Share;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import org.junit.jupiter.api.Test;

class OnlineVehiclesTest {

    private static final Instant T0 = Instant.parse("2026-01-01T12:00:00Z");

    private final TestClock clock = new TestClock(T0);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final OnlineVehicles online = new OnlineVehicles(Duration.ofMinutes(15), 5, clock, meters);

    private double gauge(String name, String tag, String value) {
        clock.advance(10); // past the gauges' cache
        Gauge g = tag == null ? meters.find(name).gauge() : meters.find(name).tag(tag, value).gauge();
        return g == null ? Double.NaN : g.value();
    }

    @Test
    void aVehicleLeavesWhenItsLastFrameIsOlderThanTheWindow() {
        online.seen("v1", "gps-a", T0.minusSeconds(60), 0, List.of("op-a"));
        online.seen("v2", "gps-a", T0, 0, List.of("op-a"));
        assertEquals(2, online.counts().online().get("op-a"));

        clock.set(T0.plus(Duration.ofMinutes(14)).plusSeconds(30));
        assertEquals(1, online.counts().online().get("op-a"));

        clock.set(T0.plus(Duration.ofMinutes(16)));
        assertNull(online.counts().online().get("op-a"));
        assertEquals(0, online.counts().total());
    }

    @Test
    void aFrameOlderThanTheWindowIsNotCounted() {
        online.seen("v1", "gps-a", T0.minus(Duration.ofMinutes(20)), 0, List.of("op-a"));
        assertEquals(0, online.counts().total());
    }

    @Test
    void aFutureFrameBeyondTheToleranceIsIgnored() {
        online.seen("v1", "gps-a", T0.plus(Duration.ofHours(3)), 0, List.of("op-a"));
        online.seen("v2", "gps-a", T0.plusSeconds(60), 0, List.of("op-a"));
        assertEquals(1, online.counts().total());
    }

    @Test
    void anOlderFrameDoesNotReplaceTheLastOne() {
        online.seen("v1", "gps-a", T0, 50, List.of("op-a"));
        online.seen("v1", "gps-a", T0.minusSeconds(30), 0, List.of("op-a"));
        assertEquals(1, online.counts().moving().get("op-a"));
    }

    @Test
    void movingIsTheLastSpeedAboveTheThreshold() {
        online.seen("v1", "gps-a", T0.minusSeconds(10), 40, List.of("op-a"));
        online.seen("v2", "gps-a", T0, 5, List.of("op-a"));
        online.seen("v3", "gps-a", T0, 6, List.of("op-a"));
        assertEquals(2, online.counts().moving().get("op-a"));

        online.seen("v1", "gps-a", T0.plusSeconds(1), 0, List.of("op-a"));
        assertEquals(1, online.counts().moving().get("op-a"));
    }

    @Test
    void aSharedVehicleCountsForEachOperatorAndOnceInTotal() {
        online.seen("v1", "gps-a", T0, 0, List.of("op-a", "op-b"));
        online.seen("v2", "gps-a", T0, 0, List.of("op-b"));
        online.seen("v3", "gps-b", T0, 0, List.of());

        assertEquals(1, gauge(OnlineVehicles.ONLINE, "tenant", "op-a"));
        assertEquals(2, gauge(OnlineVehicles.ONLINE, "tenant", "op-b"));
        assertEquals(1, gauge(OnlineVehicles.ONLINE, "tenant", "none"));
        assertEquals(3, gauge(OnlineVehicles.TOTAL, null, null));
    }

    @Test
    void sendersAreCountedByTheFramesClient() {
        online.seen("v1", "gps-a", T0, 0, List.of("op-a"));
        online.seen("v2", "gps-a", T0, 0, List.of("op-b"));
        online.seen("v3", "gps-b", T0, 0, List.of("op-b"));
        online.seen("v4", null, T0, 0, List.of("op-b"));

        assertEquals(2, gauge(OnlineVehicles.SENDERS, "sender", "gps-a"));
        assertEquals(1, gauge(OnlineVehicles.SENDERS, "sender", "gps-b"));
        assertEquals(1, gauge(OnlineVehicles.SENDERS, "sender", "none"));
    }

    @Test
    void aSenderLastSeenByAnotherVehicleFrameMovesTheVehicle() {
        online.seen("v1", "gps-a", T0, 0, List.of("op-a"));
        online.seen("v1", "gps-b", T0.plusSeconds(1), 0, List.of("op-a"));
        assertEquals(0, gauge(OnlineVehicles.SENDERS, "sender", "gps-a"));
        assertEquals(1, gauge(OnlineVehicles.SENDERS, "sender", "gps-b"));
    }

    @Test
    void aTagWithNoVehiclesReportsZero() {
        online.seen("v1", "gps-a", T0, 30, List.of("op-a"));
        assertEquals(1, gauge(OnlineVehicles.MOVING, "tenant", "op-a"));

        clock.set(T0.plus(Duration.ofMinutes(20)));
        assertEquals(0, gauge(OnlineVehicles.ONLINE, "tenant", "op-a"));
        assertEquals(0, gauge(OnlineVehicles.MOVING, "tenant", "op-a"));
        assertEquals(0, gauge(OnlineVehicles.SENDERS, "sender", "gps-a"));
        assertEquals(0, gauge(OnlineVehicles.TOTAL, null, null));
    }

    @Test
    void sharedWithReadsOnlyTheSharesValidAtTheFrameTime() {
        ReferenceCache refs = new ReferenceCache();
        refs.load(List.of(), List.of(new Share("v1", "op-b", true, null, null),
                new Share("v1", "op-a", true, T0.minusSeconds(60), null),
                new Share("v1", "op-c", true, null, T0.minusSeconds(60)),
                new Share("v2", "op-d", true, null, null)));
        assertEquals(List.of("op-a", "op-b"), refs.sharedWith("v1", T0));
        assertEquals(List.of(), refs.sharedWith("v3", T0));
    }
}
