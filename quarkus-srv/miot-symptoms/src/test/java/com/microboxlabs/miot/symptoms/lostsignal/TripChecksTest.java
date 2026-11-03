package com.microboxlabs.miot.symptoms.lostsignal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.event.OperationalEvent;
import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SourceField;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.events.SymptomCaseData;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
import io.micrometer.core.instrument.simple.SimpleMeterRegistry;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

class TripChecksTest {

    private static final Instant T0 = Instant.parse("2026-01-01T00:00:00Z");
    private static final String TENANT = "tenant-a";

    private final TestClock clock = new TestClock(T0);
    private final InMemoryLossStore store = new InMemoryLossStore(clock);
    private final SimpleMeterRegistry meters = new SimpleMeterRegistry();
    private final TestEngine engine = new TestEngine(clock);
    private final LostSignalDetector detector = new LostSignalDetector(true, store, LossSettings.defaults(),
            new LostSignalDetector.TickerSettings(Duration.ofMinutes(1), Duration.ofDays(1), Duration.ofSeconds(15),
                    500, new IngestHealth(Duration.ZERO, Duration.ZERO), Duration.ofMinutes(1)),
            engine.trips(meters), meters, clock);

    private static Map<String, Object> signal() {
        return Map.of("sender", "S1",
                "trips", Map.of(TENANT, Map.of("active", true, "double_driver", false, "id", "T-1",
                        "driver", Map.of("id", "D-1", "registered", true))),
                "frame", Map.of("gps", Map.of("speed", 80.0, "latitude", -33.0, "longitude", -71.0),
                        "sensors", Map.of("engine_status", true)));
    }

    private void frame(int at, int arrived) {
        clock.set(T0.plusSeconds(arrived));
        detector.frame("V1", T0.plusSeconds(at), T0.plusSeconds(arrived), signal());
    }

    /** Ticks every 5 s up to {@code until} seconds. */
    private void tickUntil(int until) {
        while (clock.instant().isBefore(T0.plusSeconds(until))) {
            clock.advance(5);
            detector.tick();
        }
    }

    private UUID template(SymptomState state) {
        return engine.publish(TENANT, "signal-loss", SeedTemplates.get("signal-loss").spec(), state);
    }

    @Test
    void theTemplateOpensWhenTheSilencePassesTheExpectedAndRisesAtL() {
        UUID id = template(SymptomState.ACTIVE);
        frame(0, 5);

        tickUntil(190);
        assertEquals(List.of(Transition.Kind.OPENED), engine.recorded.stream().map(Transition::kind).toList(),
                "a new moving vehicle: 2 min gap + 1 min delay");
        assertEquals(1, engine.recorded.get(0).level());
        assertEquals(id, engine.recorded.get(0).definitionId());

        tickUntil(1830);
        assertEquals(2, engine.recorded.get(1).level(), "L: 30 min of silence");
        SymptomCaseData rose = (SymptomCaseData) engine.fired.get(1).data();
        assertEquals("T-1", rose.tripId());
        assertEquals("D-1", rose.driverId());
        assertEquals(80.0, rose.speedKmh());
        assertEquals(-33.0, rose.latitude());
    }

    @Test
    @SuppressWarnings("unchecked")
    void eachChangeKeepsTheCheckItWasFoundOnWithoutTheTrip() {
        template(SymptomState.ACTIVE);
        frame(0, 5);
        tickUntil(1830);

        assertEquals(2, engine.contexts.size());
        Map<String, Object> check = (Map<String, Object>) engine.contexts.get(1).get("check");
        assertFalse(check.containsKey("trip"), "the trip holds the driver; the case has its own trip");
        Map<String, Object> loss = (Map<String, Object>) check.get("loss");
        assertTrue((double) loss.get("silence_s") >= 1800);
        assertEquals(false, loss.get("low_coverage_zone"));
        assertEquals(T0.toString(), ((Map<String, Object>) loss.get("last")).get("at"), "the last frame before it");
    }

    @Test
    void aReturnClosesACaseThatNeverLeftLevelOne() {
        template(SymptomState.ACTIVE);
        frame(0, 5);
        tickUntil(300);

        frame(200, 600);
        frame(590, 601);
        tickUntil(610);

        assertEquals(List.of("symptom.case.opened", "symptom.case.closed"), engine.types(),
                "closed on the return check, so no signal_returned");
        Transition closed = engine.recorded.get(1);
        assertEquals(Transition.Kind.CLOSED, closed.kind());
        assertEquals(1, closed.level());
        assertEquals(T0.plusSeconds(601), closed.at(), "the return check, after the backfill");
    }

    @Test
    void aReturnIsReportedToACaseAboveLevelOneWhichStaysOpen() {
        template(SymptomState.ACTIVE);
        frame(0, 5);
        tickUntil(1830);

        // The buffered frames arrive in order once the network is back: the first one is backfill.
        frame(1700, 2100);
        frame(2090, 2101);
        tickUntil(2110);

        assertEquals(List.of("symptom.case.opened", "symptom.case.level_changed", "symptom.case.signal_returned"),
                engine.types());
        OperationalEvent back = engine.fired.get(2);
        assertFalse(back.test());
        SymptomCaseData data = (SymptomCaseData) back.data();
        assertEquals(T0.plusSeconds(2100), data.signalReturnedAt());
        assertTrue(data.backfill());
        assertEquals(2, data.level());
        assertEquals(-1, data.symptomId());
        assertEquals(1, engine.audits.list(TENANT, null, null, -1L, null, null, 10).size(), "on the case's audit");
        assertTrue(engine.recorded.stream().noneMatch(t -> t.kind() == Transition.Kind.CLOSED), "the operator closes it");
    }

    @Test
    void aReturnReachesACaseWhoseSymptomWasSwitchedOffWithTheStateItOpenedWith() {
        UUID id = template(SymptomState.ACTIVE);
        frame(0, 5);
        tickUntil(300);
        engine.catalog.setState(TENANT, "owner@example.com", id, SymptomState.OFF);

        frame(200, 600);
        frame(590, 601);
        tickUntil(610);

        assertEquals(List.of("symptom.case.opened", "symptom.case.signal_returned"), engine.types());
        assertFalse(engine.fired.get(1).test(), "still the ACTIVE case it was");
        assertEquals(1, engine.audits.list(TENANT, null, null, -1L, null, null, 10).size());
    }

    @Test
    void aReturnWithoutBackfillWaitsTheGraceForLateFrames() {
        template(SymptomState.TEST);
        frame(0, 5);
        tickUntil(1830);

        frame(1900, 1901);
        tickUntil(1920);
        assertEquals(List.of("symptom.case.opened", "symptom.case.level_changed"), engine.types(),
                "waiting for backfill");
        clock.set(T0.plusSeconds(1930));
        detector.frame("V1", T0.plusSeconds(250), T0.plusSeconds(1930), signal());
        tickUntil(1965);

        assertEquals(List.of("symptom.case.opened", "symptom.case.level_changed", "symptom.case.signal_returned"),
                engine.types());
        SymptomCaseData data = (SymptomCaseData) engine.fired.get(2).data();
        assertEquals(T0.plusSeconds(1901), data.signalReturnedAt(), "the first frame after the loss");
        assertTrue(data.backfill(), "a late frame from inside the silence");
        assertTrue(engine.fired.get(2).test());
    }

    @Test
    void aSlowSenderDoesNotMakeBackfill() {
        TripChecks.Return none = new TripChecks.Return(T0, false);
        CheckState lost = new CheckState(T0, T0, Map.of());
        ArrivalProfiles profiles = new ArrivalProfiles(new InMemoryLossStore(), LossSettings.defaults());
        Frame first = new Frame("V9", "S9", T0.plusSeconds(60), T0.plusSeconds(150), null, null, 0.0, true);
        ArrivalProfiles.Arrival a = profiles.observe(first);

        assertEquals(new LossStore.Mark(T0, T0.plusSeconds(150), false),
                LostSignalDetector.mark(a, lost, first, LossSettings.defaults()));
        assertEquals(null, LostSignalDetector.mark(a, CheckState.NONE, first, LossSettings.defaults()));
        assertFalse(none.backfill());
    }

    @Test
    void withoutADecisionTheShareIsAbsent() {
        VehicleProfile p = VehicleProfile.first(new Frame("V1", "S1", T0, T0, null, null, 0.0, true));
        LossStore.Vehicle v = new LossStore.Vehicle(p, new Watch(Map.of(), 180, "S1"), CheckState.NONE);

        Map<?, ?> loss = (Map<?, ?>) TripChecks.document(v, Map.of(), T0.plusSeconds(360), null, TripChecks.Area.NONE)
                .get("loss");

        assertFalse(loss.containsKey("coverage_share"));
        assertEquals("none", loss.get("coverage_source"));
        assertEquals(false, loss.get("low_coverage_zone"));
    }

    @Test
    void theReturnSampleHasTheSameEmptyAreaAsAReturnCheck() {
        Map<?, ?> check = (Map<?, ?>) TripCheck.samples().get(1).get(TripCheck.ROOT);
        Map<?, ?> loss = (Map<?, ?>) check.get("loss");

        assertEquals(true, loss.get("returned"));
        assertEquals(false, loss.get("low_coverage_zone"));
        assertFalse(loss.containsKey("coverage_share"));
        assertEquals("none", loss.get("coverage_source"));
        assertEquals(false, loss.get("cohort_outage"));
        assertEquals(0.0, loss.get("nearby_reporting"));
    }

    @Test
    void theCheckDocumentHasTheSourcesShape() {
        VehicleProfile p = VehicleProfile.first(new Frame("V1", "S1", T0, T0.plusSeconds(5), -33.0, -71.0, 80.0,
                true));
        LossStore.Vehicle v = new LossStore.Vehicle(p, new Watch(Map.of(), 180, "S1"), CheckState.NONE);

        Map<String, Object> check = TripChecks.document(v, Map.of("active", true), T0.plusSeconds(360), null,
                new TripChecks.Area(new ShadowMap.Level(true, 0.4, ShadowMap.Source.SENDER), false, 3));

        assertEquals(6.0, check.get("signal_lost_minutes"));
        assertEquals(Map.ofEntries(Map.entry("silence_s", 360.0), Map.entry("expected_s", 180.0),
                Map.entry("ratio", 2.0), Map.entry("sender", "S1"), Map.entry("returned", false),
                Map.entry("backfill", false), Map.entry("low_coverage_zone", true), Map.entry("coverage_share", 0.4),
                Map.entry("coverage_source", "sender"), Map.entry("cohort_outage", false),
                Map.entry("nearby_reporting", 3.0), Map.entry("last", Map.of("at", "2026-01-01T00:00:00Z",
                        "lat", -33.0, "lon", -71.0, "speed", 80.0, "engine", true))), check.get("loss"));
        DataSource source = engine.sources.get(TENANT, "trip_check");
        List<String> paths = source.fields().stream().map(SourceField::path).toList();
        for (String path : List.of("check.loss.silence_s", "check.loss.expected_s", "check.loss.ratio",
                "check.loss.last.speed", "check.loss.last.engine", "check.loss.returned", "check.loss.backfill",
                "check.loss.low_coverage_zone", "check.loss.coverage_share", "check.loss.coverage_source",
                "check.loss.cohort_outage", "check.loss.nearby_reporting",
                "check.trip.active", "check.trip.double_driver", "check.trip.driver.id", "check.signal_lost_minutes",
                "check.driving_minutes")) {
            assertTrue(paths.contains(path), path);
        }
        assertFalse(paths.contains("check.loss.last.at"));
        assertFalse(source.fields().stream().filter(f -> f.path().equals("check.driving_minutes")).findFirst()
                .orElseThrow().engineSupported(), "nothing computes it yet");
        assertEquals(2, source.samples().size());
    }
}
