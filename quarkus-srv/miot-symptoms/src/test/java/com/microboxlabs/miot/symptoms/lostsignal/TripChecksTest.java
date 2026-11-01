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
    void aReturnIsReportedToTheOpenCaseWhichStaysOpen() {
        template(SymptomState.ACTIVE);
        frame(0, 5);
        tickUntil(300);

        // The buffered frames arrive in order once the network is back: the first one is backfill.
        frame(200, 600);
        frame(590, 601);
        tickUntil(610);

        assertEquals(List.of("symptom.case.opened", "symptom.case.signal_returned"), engine.types());
        OperationalEvent back = engine.fired.get(1);
        assertFalse(back.test());
        SymptomCaseData data = (SymptomCaseData) back.data();
        assertEquals(T0.plusSeconds(600), data.signalReturnedAt());
        assertTrue(data.backfill());
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
        tickUntil(300);

        frame(400, 401);
        tickUntil(420);
        assertEquals(List.of("symptom.case.opened"), engine.types(), "waiting for backfill");
        clock.set(T0.plusSeconds(430));
        detector.frame("V1", T0.plusSeconds(250), T0.plusSeconds(430), signal());
        tickUntil(465);

        assertEquals(List.of("symptom.case.opened", "symptom.case.signal_returned"), engine.types());
        SymptomCaseData data = (SymptomCaseData) engine.fired.get(1).data();
        assertEquals(T0.plusSeconds(401), data.signalReturnedAt(), "the first frame after the loss");
        assertTrue(data.backfill(), "a late frame from inside the silence");
        assertTrue(engine.fired.get(1).test());
    }

    @Test
    void aSlowSenderDoesNotMakeBackfill() {
        TripChecks.Return none = new TripChecks.Return(T0, false);
        CheckState lost = new CheckState(T0, T0, Map.of());
        ArrivalProfiles profiles = new ArrivalProfiles(new InMemoryLossStore(), LossSettings.defaults());
        Frame first = new Frame("V9", "S9", T0.plusSeconds(60), T0.plusSeconds(150), null, null, 0.0, true);
        ArrivalProfiles.Arrival a = profiles.record(first);

        assertEquals(new LossStore.Mark(T0, T0.plusSeconds(150), false),
                LostSignalDetector.mark(a, lost, first, LossSettings.defaults()));
        assertEquals(null, LostSignalDetector.mark(a, CheckState.NONE, first, LossSettings.defaults()));
        assertFalse(none.backfill());
    }

    @Test
    void theCheckDocumentHasTheSourcesShape() {
        VehicleProfile p = VehicleProfile.first(new Frame("V1", "S1", T0, T0.plusSeconds(5), -33.0, -71.0, 80.0,
                true));
        LossStore.Vehicle v = new LossStore.Vehicle(p, new Watch(Map.of(), 180, "S1"), CheckState.NONE);

        Map<String, Object> check = TripChecks.document(v, Map.of("active", true), T0.plusSeconds(360), null,
                new TripChecks.Area(true, false, 3));

        assertEquals(6.0, check.get("signal_lost_minutes"));
        assertEquals(Map.of("silence_s", 360.0, "expected_s", 180.0, "ratio", 2.0, "sender", "S1",
                "returned", false, "backfill", false, "low_coverage_zone", true, "cohort_outage", false,
                "nearby_reporting", 3.0, "last", Map.of("at", "2026-01-01T00:00:00Z", "lat", -33.0, "lon", -71.0, "speed", 80.0,
                        "engine", true)), check.get("loss"));
        DataSource source = engine.sources.get(TENANT, "trip_check");
        List<String> paths = source.fields().stream().map(SourceField::path).toList();
        for (String path : List.of("check.loss.silence_s", "check.loss.expected_s", "check.loss.ratio",
                "check.loss.last.speed", "check.loss.last.engine", "check.loss.returned", "check.loss.backfill",
                "check.loss.low_coverage_zone", "check.loss.cohort_outage", "check.loss.nearby_reporting",
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
