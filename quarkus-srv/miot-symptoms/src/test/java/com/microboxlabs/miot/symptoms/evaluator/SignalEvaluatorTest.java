package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class SignalEvaluatorTest {

    private static final String TENANT = "tenant-a";
    private static final String TRUCK = "truck-1";
    private static final Instant T0 = Instant.parse("2026-10-03T03:00:00Z");
    private static final UUID SPEEDING = UUID.randomUUID();

    private InMemoryEpisodeStore store;
    private SignalEvaluator evaluator;
    private List<CompiledSymptom> symptoms;

    @BeforeEach
    void setUp() {
        store = new InMemoryEpisodeStore();
        evaluator = new SignalEvaluator(store);
        // Levels: 1 over 0 to 5, 2 from 5, 3 from 11, 4 from 21 held 60 s. Opens at once; closes after 120 s normal.
        symptoms = List.of(CompiledSymptom.compile(SPEEDING, "1.0.0", SymptomState.TEST, Specs.speeding(),
                Specs.gpsSignal()));
    }

    /** A heavy truck on a trip at {@code speed} on a 90 km/h road. */
    private static Map<String, Object> signal(double speed) {
        return signal(speed, true);
    }

    private static Map<String, Object> signal(double speed, boolean onTrip) {
        return Map.of("signal", Map.of(
                "trip", Map.of("active", onTrip),
                "vehicle", Map.of("weight_category", "HEAVY"),
                "gps", Map.of("speed_kmh", speed),
                "road", Map.of("maxspeed_osm", 90.0)));
    }

    private Result at(int seconds, double speed) {
        return evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(seconds), signal(speed), symptoms);
    }

    private static List<String> kinds(Result r) {
        return r.transitions().stream().map(t -> t.kind() + ":" + t.level()).toList();
    }

    @Test
    void aCaseOpensAtTheLevelReachedRisesAndClosesAfterTwoMinutesNormal() {
        assertEquals(List.of(), kinds(at(0, 85)), "under the limit: nothing");
        assertEquals(0, store.size(), "nothing worth keeping");

        assertEquals(List.of("OPENED:2"), kinds(at(5, 96)));
        assertEquals(List.of(), kinds(at(10, 97)), "same level: no change");
        assertEquals(List.of("LEVEL_CHANGED:3"), kinds(at(15, 102)));
        assertEquals(List.of(), kinds(at(20, 95)), "a level never goes down");

        assertEquals(List.of(), kinds(at(25, 80)), "normal starts");
        assertEquals(List.of(), kinds(at(140, 80)), "115 s normal");
        Result closed = at(145, 80);
        assertEquals(List.of("CLOSED:3"), kinds(closed));
        Transition t = closed.transitions().get(0);
        assertEquals(12.0, t.measure(), 1e-9, "the highest measure of the case");
        assertEquals(SymptomState.TEST, t.state());
        assertEquals("1.0.0", t.version());
        assertEquals(0, store.size(), "closed and normal: forgotten");
    }

    @Test
    void codeBlackNeedsTheConditionHeldForAMinute() {
        assertEquals(List.of("OPENED:3"), kinds(at(0, 115)), "25 over, but not held yet");
        assertEquals(List.of(), kinds(at(30, 115)));
        assertEquals(List.of("LEVEL_CHANGED:4"), kinds(at(60, 115)));
    }

    @Test
    void aBriefDipKeepsTheCaseAndRestartsTheHeldTime() {
        at(0, 115);
        at(30, 80);
        assertEquals(List.of(), kinds(at(60, 115)), "back over the limit: same case");
        assertEquals(List.of(), kinds(at(100, 115)), "held 40 s since it came back");
        assertEquals(List.of("LEVEL_CHANGED:4"), kinds(at(120, 115)));
    }

    @Test
    void leavingTheTripIsNormalToo() {
        at(0, 100);
        Result off = evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(10), signal(120, false), symptoms);
        assertEquals(List.of(), kinds(off), "not a candidate: the case waits for 120 s");
        Result later = evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(130), signal(120, false), symptoms);
        assertEquals(List.of("CLOSED:2"), kinds(later));
    }

    @Test
    void signalsOutOfOrderOrRepeatedAreIgnored() {
        at(10, 100);
        assertEquals(List.of(), kinds(at(5, 130)), "older than the last one");
        assertEquals(List.of(), kinds(at(10, 130)), "the same instant again");
        assertEquals(List.of("LEVEL_CHANGED:3"), kinds(at(11, 102)));
    }

    @Test
    void vehiclesAndOrganizationsHaveTheirOwnEpisodes() {
        at(0, 100);
        Result other = evaluator.evaluate(TENANT, "truck-2", T0.plusSeconds(1), signal(100), symptoms);
        Result tenantB = evaluator.evaluate("tenant-b", TRUCK, T0.plusSeconds(1), signal(100), symptoms);
        assertEquals(List.of("OPENED:2"), kinds(other));
        assertEquals(List.of("OPENED:2"), kinds(tenantB));
        assertEquals(3, store.size());
    }

    @Test
    void aStillHeldConditionStartsANewCaseAfterAnAgeClose() {
        SymptomSpec byAge = new SymptomSpec(Specs.speeding().source(), Specs.speeding().activation(),
                Specs.speeding().measure(), Specs.speeding().levels(),
                new SymptomSpec.Lifecycle("caso.condicion_s >= 0", "caso.edad_h >= 1"), null);
        symptoms = List.of(CompiledSymptom.compile(SPEEDING, "2.0.0", SymptomState.ACTIVE, byAge,
                Specs.gpsSignal()));
        assertEquals(List.of("OPENED:2"), kinds(at(0, 100)));
        assertEquals(List.of("CLOSED:2"), kinds(at(3600, 100)));
        assertEquals(List.of("OPENED:2"), kinds(at(3605, 100)), "a new run, a new case");
    }

    @Test
    void aRuleThatFailsReportsAndLeavesTheEpisodeAlone() {
        at(0, 100);
        Map<String, Object> noRoad = Map.of("signal", Map.of(
                "trip", Map.of("active", true),
                "vehicle", Map.of("weight_category", "HEAVY"),
                "gps", Map.of("speed_kmh", 130.0)));
        Result r = evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(5), noRoad, symptoms);
        assertTrue(r.transitions().isEmpty());
        assertEquals(1, r.errors().size());
        assertEquals(SPEEDING, r.errors().get(0).definitionId());
        assertEquals(T0, store.find(TENANT, TRUCK, SPEEDING).orElseThrow().lastSignalAt(), "untouched");
    }

    private static SymptomSpec spec(String activation, SymptomSpec.Measure measure, List<SymptomSpec.Level> levels,
            String open, String close) {
        return new SymptomSpec("gps_signal", activation, measure, levels, new SymptomSpec.Lifecycle(open, close),
                null);
    }

    @Test
    void aFixedLevelSymptomOpensOnTheFirstCandidate() {
        UUID panic = UUID.randomUUID();
        SymptomSpec fixed = spec("signal.trip.active", null,
                List.of(new SymptomSpec.Level(4, true, "true", Specs.response(true, 2))),
                "caso.condicion_s >= 0", "caso.normal_s >= 60");
        List<CompiledSymptom> one = List.of(CompiledSymptom.compile(panic, "0.1.0", SymptomState.ACTIVE, fixed,
                Specs.gpsSignal()));
        Result r = evaluator.evaluate(TENANT, TRUCK, T0, signal(0), one);
        assertEquals(List.of("OPENED:4"), kinds(r));
        assertEquals(0.0, r.transitions().get(0).measure());
    }

    @Test
    void aLevelThatOnlyNeedsTimeWaitsForIt() {
        UUID stopped = UUID.randomUUID();
        SymptomSpec held = spec("signal.trip.active && signal.gps.speed_kmh < 1.0", null,
                List.of(new SymptomSpec.Level(3, true, "sostenido_s >= 1800", Specs.response(true, 15))),
                "caso.condicion_s >= 0", "caso.normal_s >= 0");
        List<CompiledSymptom> one = List.of(CompiledSymptom.compile(stopped, "0.1.0", SymptomState.TEST, held,
                Specs.gpsSignal()));
        assertEquals(List.of(), kinds(evaluator.evaluate(TENANT, TRUCK, T0, signal(0), one)));
        assertEquals(1, store.size(), "the level is waiting");
        assertEquals(List.of(), kinds(evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(1799), signal(0), one)));
        assertEquals(List.of("OPENED:3"),
                kinds(evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(1800), signal(0), one)));
        assertEquals(List.of("CLOSED:3"),
                kinds(evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(1805), signal(40), one)), "moving again");
        assertEquals(List.of(), kinds(evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(1810), signal(0), one)),
                "stopped again: the half hour starts over");
    }

    @Test
    void oneSymptomFailingDoesNotStopTheOthers() {
        SymptomSpec broken = spec("signal.trip.active", new SymptomSpec.Measure("signal.gps.nope * 1", "x", "u"),
                Specs.speeding().levels(), "caso.condicion_s >= 0", "caso.normal_s >= 120");
        UUID other = UUID.randomUUID();
        List<CompiledSymptom> both = List.of(
                CompiledSymptom.compile(other, "0.1.0", SymptomState.TEST, broken, Specs.gpsSignal()),
                symptoms.get(0));
        Result r = evaluator.evaluate(TENANT, TRUCK, T0, signal(100), both);
        assertEquals(List.of("OPENED:2"), kinds(r));
        assertEquals(List.of(other), r.errors().stream().map(SignalEvaluator.RuleError::definitionId).toList());
        assertEquals("measure", r.errors().get(0).section());
    }

    @Test
    void aNewVersionTakesOverTheOpenCase() {
        at(0, 100);
        symptoms = List.of(CompiledSymptom.compile(SPEEDING, "1.1.0", SymptomState.ACTIVE, Specs.speeding(),
                Specs.gpsSignal()));
        Result r = at(5, 102);
        assertEquals(List.of("LEVEL_CHANGED:3"), kinds(r));
        assertEquals("1.1.0", r.transitions().get(0).version());
        assertEquals(SymptomState.ACTIVE, r.transitions().get(0).state());
        assertEquals(2, r.transitions().get(0).previousLevel());
    }

    @Test
    void offVersionsAndVersionsWithoutLifecycleAreNotCompiled() {
        assertThrows(IllegalArgumentException.class, () -> CompiledSymptom.compile(SPEEDING, "1.0.0",
                SymptomState.OFF, Specs.speeding(), Specs.gpsSignal()));
        SymptomSpec noLifecycle = new SymptomSpec("gps_signal", Specs.ACTIVATION, null, List.of(), null, null);
        assertThrows(IllegalArgumentException.class, () -> CompiledSymptom.compile(SPEEDING, "1.0.0",
                SymptomState.TEST, noLifecycle, Specs.gpsSignal()));
    }
}
