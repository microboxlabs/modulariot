package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.lostsignal.TestClock;
import com.microboxlabs.miot.symptoms.signal.ReferenceCache.Share;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import io.micrometer.prometheus.PrometheusConfig;
import io.micrometer.prometheus.PrometheusMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
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
    void everyFutureFrameIsIgnoredWithoutRegisteringTags() {
        online.seen("v1", "gps-a", T0.plus(Duration.ofHours(3)), 0, List.of("op-a"));
        online.seen("v2", "gps-a", T0.plusSeconds(60), 0, List.of("op-a"));
        online.seen("v3", "gps-a", T0.plusNanos(1), 0, List.of("op-a"));
        assertEquals(0, online.counts().total());
        assertNull(meters.find(OnlineVehicles.ONLINE).gauge());
        assertNull(meters.find(OnlineVehicles.SENDERS).gauge());
    }

    @Test
    void aFutureFrameDoesNotReplaceAnAcceptedFrame() {
        online.seen("v1", "gps-a", T0, 0, List.of("op-a"));
        online.seen("v1", "gps-b", T0.plusSeconds(1), 30, List.of("op-b"));
        assertEquals(1, online.counts().online().get("op-a"));
        assertTrue(online.counts().moving().isEmpty());
        assertNull(meters.find(OnlineVehicles.ONLINE).tag("tenant", "op-b").gauge());
        assertNull(meters.find(OnlineVehicles.SENDERS).tag("sender", "gps-b").gauge());
    }

    @Test
    void anOlderFrameDoesNotReplaceTheLastOne() {
        online.seen("v1", "gps-a", T0, 50, List.of("op-a"));
        online.seen("v1", "gps-a", T0.minusSeconds(30), 0, List.of("op-a"));
        assertEquals(1, online.counts().moving().get("op-a"));
    }

    @Test
    void anOlderFrameDoesNotRegisterUnusedTags() {
        online.seen("v1", "gps-a", T0, 50, List.of("op-a"));
        online.seen("v1", "gps-b", T0.minusSeconds(1), 0, List.of("op-b"));
        assertNull(meters.find(OnlineVehicles.ONLINE).tag("tenant", "op-b").gauge());
        assertNull(meters.find(OnlineVehicles.MOVING).tag("tenant", "op-b").gauge());
        assertNull(meters.find(OnlineVehicles.SENDERS).tag("sender", "gps-b").gauge());
        assertEquals(1, online.counts().senders().get("gps-a"));
    }

    @Test
    void movingIsTheLastSpeedAboveTheThreshold() {
        online.seen("v1", "gps-a", T0.minusSeconds(10), 40, List.of("op-a"));
        online.seen("v2", "gps-a", T0, 5, List.of("op-a"));
        online.seen("v3", "gps-a", T0, 6, List.of("op-a"));
        assertEquals(2, online.counts().moving().get("op-a"));

        clock.advance(1);
        online.seen("v1", "gps-a", clock.instant(), 0, List.of("op-a"));
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
        clock.advance(1);
        online.seen("v1", "gps-b", clock.instant(), 0, List.of("op-a"));
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
    void pruningWithoutScrapesReleasesExpiredVehiclesAndKeepsOnlyTagGauges() throws Exception {
        for (int i = 0; i < 10_000; i++) {
            online.seen("v" + i, "gps-a", T0, 30, List.of("op-a", "op-b"));
        }
        assertEquals(10_000, online.counts().total());
        assertEquals(6, meters.getMeters().size()); // total, sender, and two gauges per tenant
        assertTrue(meters.getMeters().stream().flatMap(m -> m.getId().getTags().stream())
                .allMatch(t -> t.getKey().equals("tenant") || t.getKey().equals("sender")));

        clock.set(T0.plus(Duration.ofMinutes(15))); // the window's boundary is excluded
        online.prune();
        var field = OnlineVehicles.class.getDeclaredField("vehicles");
        field.setAccessible(true);
        assertTrue(((Map<?, ?>) field.get(online)).isEmpty());
        assertEquals(6, meters.getMeters().size());
        meters.getMeters().forEach(m -> assertEquals(0, ((Gauge) m).value()));
    }

    @Test
    void prometheusExportsAllFourDashboardNamesTogether() {
        var prometheus = new PrometheusMeterRegistry(PrometheusConfig.DEFAULT);
        try {
            var tracked = new OnlineVehicles(Duration.ofMinutes(15), 5, clock, prometheus);
            tracked.seen("v1", "gps-a", T0, 30, List.of("op-a", "op-b"));
            String scrape = prometheus.scrape().replace(",}", "}");
            assertTrue(scrape.contains("miot_symptoms_vehicles_online_total 1.0"));
            assertTrue(scrape.contains("miot_symptoms_vehicles_online{tenant=\"op-a\"} 1.0"));
            assertTrue(scrape.contains("miot_symptoms_vehicles_online{tenant=\"op-b\"} 1.0"));
            assertTrue(scrape.contains("miot_symptoms_vehicles_moving{tenant=\"op-a\"} 1.0"));
            assertTrue(scrape.contains("miot_symptoms_vehicles_online_senders{sender=\"gps-a\"} 1.0"));
        } finally {
            prometheus.close();
        }
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
