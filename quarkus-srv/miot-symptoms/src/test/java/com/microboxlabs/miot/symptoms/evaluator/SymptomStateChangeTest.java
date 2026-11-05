package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A symptom that moves between TEST and ACTIVE closes the case of the old state before it opens a new one. */
class SymptomStateChangeTest {

    private static final String TENANT = "tenant-a";
    private static final String TRUCK = "truck-1";
    private static final Instant T0 = Instant.parse("2026-11-05T12:00:00Z");
    private static final UUID SPEEDING = UUID.randomUUID();

    private InMemoryEpisodeStore store;
    private SignalEvaluator evaluator;
    private CompiledSymptom inTest;
    private final List<Transition> written = new ArrayList<>();

    @BeforeEach
    void setUp() {
        store = new InMemoryEpisodeStore();
        evaluator = new SignalEvaluator(store);
        // Speeding with a note rule that holds on every frame of an open case.
        SymptomSpec s = Specs.speeding();
        SymptomSpec noting = new SymptomSpec(s.source(), s.activation(), s.measure(), s.levels(),
                new SymptomSpec.Lifecycle("case.condition_s >= 0", "case.normal_s >= 120", false, "true"), null);
        inTest = CompiledSymptom.compile(SPEEDING, "1.0.0", SymptomState.TEST, noting, Specs.gpsSignal());
    }

    private static Map<String, Object> signal(double speed) {
        return Map.of("signal", Map.of(
                "trip", Map.of("active", true),
                "vehicle", Map.of("weight_category", "HEAVY"),
                "frame", Map.of("gps", Map.of("speed", speed)),
                "road", Map.of("maxspeed_osm", 90.0)));
    }

    private Result at(int seconds, double speed, CompiledSymptom s) {
        Result r = evaluator.evaluate(TENANT, TRUCK, T0.plusSeconds(seconds), signal(speed), List.of(s));
        written.addAll(r.transitions());
        return r;
    }

    private static List<String> kinds(Result r) {
        return r.transitions().stream().map(t -> t.kind() + ":" + t.state()).toList();
    }

    @Test
    void testToActiveClosesTheTestCaseAndTheNextFrameOpensAnActiveOne() {
        assertEquals(List.of("OPENED:TEST"), kinds(at(0, 96, inTest)));
        assertEquals(SymptomState.TEST, store.find(TENANT, TRUCK, SPEEDING).orElseThrow().state());

        CompiledSymptom active = inTest.withState(SymptomState.ACTIVE);
        Result switched = at(5, 102, active);

        assertEquals(List.of("CLOSED:TEST"), kinds(switched), "no level change or note in the new state");
        Transition closed = switched.transitions().get(0);
        assertEquals(Transition.STATE_CHANGE_REASON, closed.detail().get("reason"));
        assertEquals("TEST", closed.detail().get("from"));
        assertEquals("ACTIVE", closed.detail().get("to"));
        assertEquals(2, closed.level());
        assertTrue(store.find(TENANT, TRUCK, SPEEDING).isEmpty(), "the episode is dropped");

        assertEquals(List.of("OPENED:ACTIVE"), kinds(at(10, 96, active)));
        assertEquals(SymptomState.ACTIVE, store.find(TENANT, TRUCK, SPEEDING).orElseThrow().state());
    }

    @Test
    void activeToTestClosesTheActiveCase() {
        CompiledSymptom active = inTest.withState(SymptomState.ACTIVE);
        at(0, 96, active);

        assertEquals(List.of("CLOSED:ACTIVE"), kinds(at(5, 96, inTest)));
        assertEquals(List.of("OPENED:TEST"), kinds(at(10, 96, inTest)));
    }

    @Test
    void noTransitionIsWrittenInAStateOtherThanItsCase() {
        CompiledSymptom active = inTest.withState(SymptomState.ACTIVE);
        CompiledSymptom[] steps = {inTest, inTest, active, active, active, inTest, inTest, active};
        double[] speeds = {96, 102, 115, 96, 102, 115, 96, 80};
        for (int i = 0; i < steps.length; i++) {
            at(i * 5, speeds[i], steps[i]);
        }

        Map<Boolean, SymptomState> openCase = new HashMap<>();
        for (Transition t : written) {
            if (t.kind() == Kind.OPENED) {
                assertTrue(openCase.get(true) == null, "a case opens only after the previous one closed: " + written);
                openCase.put(true, t.state());
            } else {
                assertEquals(openCase.get(true), t.state(), t.kind() + " in the state of its case: " + written);
                if (t.kind() == Kind.CLOSED) {
                    openCase.remove(true);
                }
            }
        }
        assertTrue(written.stream().anyMatch(t -> t.kind() == Kind.NOTED), "the note rule did run: " + written);
    }

    @Test
    void anEpisodeWrittenBeforeTheStateWasKeptTakesTheSymptomsState() {
        Instant opened = T0.minusSeconds(60);
        store.save(TENANT, new Episode(SPEEDING, "1.0.0", TRUCK, opened, opened, null, Map.of(), opened, opened, 2, 6));

        Result r = at(0, 96, inTest);

        assertEquals(List.of("NOTED:TEST"), kinds(r));
        assertEquals(SymptomState.TEST, store.find(TENANT, TRUCK, SPEEDING).orElseThrow().state());
        assertEquals(List.of("CLOSED:TEST"), kinds(at(5, 96, inTest.withState(SymptomState.ACTIVE))));
    }

    @Test
    void theEndOfAHoldClosesACaseOfTheOldState() {
        at(0, 96, inTest);

        List<Transition> closed = evaluator.finishHold(TENANT, TRUCK, T0.plusSeconds(30),
                List.of(inTest.withState(SymptomState.ACTIVE)));

        assertEquals(List.of(Kind.CLOSED), closed.stream().map(Transition::kind).toList());
        assertEquals(SymptomState.TEST, closed.get(0).state());
        assertTrue(store.find(TENANT, TRUCK, SPEEDING).isEmpty());
    }

    @Test
    void anEpisodeKeepsItsStateInRedisAndOneWrittenBeforeStillLoads() {
        Episode e = new Episode(SPEEDING, "1.0.0", TRUCK, T0, T0, null, Map.of(), T0, T0, 2, 10, SymptomState.TEST);
        assertEquals(e, RedisEpisodes.read(RedisEpisodes.write(e)));

        String before = RedisEpisodes.write(new Episode(SPEEDING, "1.0.0", TRUCK, T0, T0, null, Map.of(), T0, T0, 2,
                10));
        assertTrue(before.contains("\"state\":null"), before);
        Episode legacy = RedisEpisodes.read(before.replace(",\"state\":null", ""));
        assertEquals(null, legacy.state());
        assertTrue(legacy.open());
    }
}
