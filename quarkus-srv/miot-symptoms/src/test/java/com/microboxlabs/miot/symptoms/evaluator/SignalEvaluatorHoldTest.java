package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.atomic.AtomicBoolean;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** "Ignorar condición": what a hold does to the evaluator's cases. */
class SignalEvaluatorHoldTest {

    private static final String TENANT = "tenant-a";
    private static final String TRUCK = "truck-1";
    private static final Instant T0 = Instant.parse("2026-10-03T03:00:00Z");
    private static final UUID SPEEDING = UUID.randomUUID();

    private final AtomicBoolean held = new AtomicBoolean();
    private InMemoryEpisodeStore store;
    private SignalEvaluator evaluator;
    private List<CompiledSymptom> symptoms;

    @BeforeEach
    void setUp() {
        store = new InMemoryEpisodeStore();
        evaluator = new SignalEvaluator(store, (tenant, asset, definition, openedAt) -> held.get());
        // Levels: 1 over 0 to 5, 2 from 5, 3 from 11, 4 from 21 held 60 s. Opens at once; closes after 120 s normal.
        symptoms = List.of(CompiledSymptom.compile(SPEEDING, "1.0.0", SymptomState.ACTIVE, Specs.speeding(),
                Specs.gpsSignal()));
    }

    private static Map<String, Object> signal(double speed) {
        return Map.of("signal", Map.of(
                "trip", Map.of("active", true),
                "vehicle", Map.of("weight_category", "HEAVY"),
                "frame", Map.of("gps", Map.of("speed", speed)),
                "road", Map.of("maxspeed_osm", 90.0)));
    }

    private List<String> at(int seconds, double speed) {
        Result r = evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(seconds), signal(speed), symptoms);
        return r.transitions().stream().map(t -> t.kind() + ":" + t.level()).toList();
    }

    @Test
    void aHeldCaseKeepsItsLevelAndTheNextLevelCountsFromTheEndOfTheHold() {
        assertEquals(List.of("OPENED:3"), at(0, 115));
        held.set(true);
        assertEquals(List.of(), at(30, 115));
        assertEquals(List.of(), at(60, 115), "held 60 s: code black would be due, the hold keeps level 3");
        assertEquals(List.of(), at(120, 130), "no jump either");
        evaluator.finishHold(TENANT, TRUCK, T0.plusSeconds(150), symptoms);
        held.set(false);
        assertEquals(List.of(), at(150, 115), "back in the tower at level 3");
        assertEquals(List.of(), at(180, 115), "the minute counts from the end of the hold");
        assertEquals(List.of("LEVEL_CHANGED:4"), at(215, 115));
    }

    @Test
    void aHeldCaseStillClosesByItsRule() {
        at(0, 96);
        held.set(true);
        at(10, 80);
        assertEquals(List.of("CLOSED:2"), at(135, 80), "two minutes normal close it, hold or not");
    }

    @Test
    void aHoldKeepsANewCaseBackAndRecordsItOncePerRun() {
        held.set(true);
        assertEquals(List.of("HELD:2"), at(0, 96), "the opening is evidence, not a case");
        assertEquals(List.of(), at(5, 97), "recorded once");
        assertEquals(List.of(), at(10, 103));
        held.set(false);
        assertEquals(List.of("OPENED:1"), at(20, 103), "after the hold the condition still holds: a case opens");
    }

    @Test
    void aNewRunDuringTheHoldIsRecordedAgain() {
        held.set(true);
        assertEquals(List.of("HELD:2"), at(0, 96));
        assertEquals(List.of(), at(10, 80), "normal");
        assertEquals(List.of("HELD:2"), at(20, 96), "a new run");
    }

    @Test
    void returningWithoutAnyHeldSignalRestartsEscalationAtTheReturn() {
        assertEquals(List.of("OPENED:3"), at(0, 115));
        evaluator.finishHold(TENANT, TRUCK, T0.plusSeconds(600), symptoms);
        assertEquals(List.of(), at(610, 115));
        assertEquals(List.of("LEVEL_CHANGED:4"), at(660, 115));
    }

    @Test
    void expiryAppliesTheCloseRuleToTheLatestNormalEvidence() {
        at(0, 96);
        held.set(true);
        at(10, 80);
        List<Transition> closed = evaluator.finishHold(TENANT, TRUCK, T0.plusSeconds(135), symptoms);
        assertEquals(List.of("CLOSED"), closed.stream().map(t -> t.kind().name()).toList());
    }

    @Test
    void finishingAHoldPreservesAnOperatorsTripClose() {
        store.save(TENANT, Episode.closedOnTrip(SPEEDING, TRUCK, "T-1"));
        evaluator.finishHold(TENANT, TRUCK, T0.plusSeconds(600), symptoms);
        assertEquals("T-1", store.find(TENANT, TRUCK, SPEEDING).orElseThrow().closedOnTrip());
    }

    @Test
    void holdExpiryReadsTheRetainedOffTripTimer() {
        var base = Specs.speeding();
        var spec = new SymptomSpec(base.source(), base.activation(), base.measure(), base.levels(),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.off_trip_s >= 1200"), null);
        var symptom = CompiledSymptom.compile(SPEEDING, "1.0.0", SymptomState.ACTIVE, spec, Specs.gpsSignal());
        store.save(TENANT, new Episode(SPEEDING, "1.0.0", TRUCK, null, null, T0, Map.of(), T0, T0, 2, 5, T0));
        var closed = evaluator.finishHold(TENANT, TRUCK, T0.plusSeconds(1200), List.of(symptom));
        assertEquals(List.of(Transition.Kind.CLOSED), closed.stream().map(Transition::kind).toList());
    }

    @Test
    void aLateHeldEventKeepsItsEvidenceWithoutChangingTheOrdinaryEpisode() {
        at(100, 80);
        held.set(true);
        CompiledSymptom s = symptoms.get(0);
        CompiledSymptom event = new CompiledSymptom(s.definitionId(), s.version(), s.state(), s.sourceKey(),
                s.activation(), s.measure(), s.levels(), s.open(), s.close(), s.levelDown(), true);
        Result result = evaluator.evaluateLate(TENANT, TRUCK, T0.plusSeconds(10), signal(96), List.of(event));
        assertEquals(List.of(Transition.Kind.HELD), result.transitions().stream().map(Transition::kind).toList());
        assertEquals(T0.plusSeconds(100), store.watermark(TENANT, TRUCK, s.sourceKey()).orElseThrow());
    }

    @Test
    void testVersionsAreNotHeld() {
        List<CompiledSymptom> test = List.of(CompiledSymptom.compile(SPEEDING, "1.0.0", SymptomState.TEST,
                Specs.speeding(), Specs.gpsSignal()));
        held.set(true);
        Result r = evaluator.evaluate(TENANT, TRUCK, T0, signal(96), test);
        assertEquals(List.of("OPENED"), r.transitions().stream().map(t -> t.kind().name()).toList());
    }
}
