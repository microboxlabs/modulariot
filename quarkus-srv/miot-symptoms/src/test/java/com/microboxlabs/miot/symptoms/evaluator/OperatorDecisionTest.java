package com.microboxlabs.miot.symptoms.evaluator;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.OperatorWhenSpecTest;
import com.microboxlabs.miot.symptoms.catalog.service.Specs;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator.Result;
import com.microboxlabs.miot.symptoms.evaluator.Transition.Kind;
import java.time.Instant;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** Whether an opening or a level change sends its case to the operators ({@code operator}, {@code operatorWhen}). */
class OperatorDecisionTest {

    private static final String TENANT = "tenant-a";
    private static final Instant T0 = Instant.parse("2026-10-03T03:00:00Z");
    private static final String NOT_OTR_OTE = "signal.trip.type != \"otr\" && signal.trip.type != \"ote\"";
    private static final UUID SPEEDING = UUID.randomUUID();

    /** Speeding (levels 3 and 4 have an operator), with {@code when} on both operator levels. */
    private static CompiledSymptom symptom(String when) {
        SymptomSpec base = Specs.speeding();
        List<SymptomSpec.Level> levels = new ArrayList<>();
        for (SymptomSpec.Level l : base.levels()) {
            levels.add(new SymptomSpec.Level(l.icu(), l.applies(), l.when(), l.response().withOperatorWhen(when),
                    l.ignore()));
        }
        return CompiledSymptom.compile(SPEEDING, "1.0.0", SymptomState.ACTIVE, Specs.withLevels(base, levels),
                OperatorWhenSpecTest.source());
    }

    /** A heavy truck on a trip of {@code type} (none when null) at {@code speed} on a 90 km/h road. */
    private static Map<String, Object> signal(double speed, String type) {
        Map<String, Object> trip = new LinkedHashMap<>();
        trip.put("active", true);
        if (type != null) {
            trip.put("type", type);
        }
        return Map.of("signal", Map.of("trip", trip, "vehicle", Map.of("weight_category", "HEAVY"),
                "frame", Map.of("gps", Map.of("speed", speed)), "road", Map.of("maxspeed_osm", 90.0)));
    }

    private static Result run(SignalEvaluator evaluator, String asset, int seconds, double speed, String type,
            CompiledSymptom s) {
        return evaluator.evaluate(TENANT, asset, T0.plusSeconds(seconds), signal(speed, type), List.of(s));
    }

    @Test
    void anOperatorLevelWhoseConditionHoldsGoesToTheOperators() {
        Result r = run(new SignalEvaluator(new InMemoryEpisodeStore()), "truck-1", 0, 105, "v",
                symptom(NOT_OTR_OTE));

        Transition opened = r.transitions().get(0);
        assertEquals(Kind.OPENED, opened.kind());
        assertEquals(3, opened.level());
        assertEquals(Boolean.TRUE, opened.operator());
        assertTrue(r.errors().isEmpty());
    }

    @Test
    void aFalseConditionStillRecordsTheCaseWithoutOperators() {
        Result r = run(new SignalEvaluator(new InMemoryEpisodeStore()), "truck-1", 0, 105, "otr",
                symptom(NOT_OTR_OTE));

        assertEquals(List.of(Kind.OPENED), r.transitions().stream().map(Transition::kind).toList());
        assertEquals(Boolean.FALSE, r.transitions().get(0).operator());
        assertTrue(r.errors().isEmpty());
    }

    @Test
    void aMissingValueMeansNoOperatorWithoutFailingTheEvaluation() {
        Result r = run(new SignalEvaluator(new InMemoryEpisodeStore()), "truck-1", 0, 105, null,
                symptom(NOT_OTR_OTE));

        assertEquals(List.of(Kind.OPENED), r.transitions().stream().map(Transition::kind).toList(),
                "the case is recorded");
        assertEquals(Boolean.FALSE, r.transitions().get(0).operator());
        assertTrue(r.errors().isEmpty());
    }

    @Test
    void aMissingTripMeansNoOperatorWithoutFailingTheEvaluation() {
        List<SignalEvaluator.RuleError> errors = new ArrayList<>();

        assertFalse(SignalEvaluator.operator(symptom(NOT_OTR_OTE), 3,
                Map.of("signal", Map.of()), errors));
        assertTrue(errors.isEmpty());
    }

    @Test
    void anUnchangedLevelKeepsItsDecisionUntilTheNextLevelChange() {
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        CompiledSymptom s = symptom(NOT_OTR_OTE);
        assertEquals(Boolean.FALSE, run(evaluator, "truck-1", 0, 105, "otr", s).transitions().getFirst().operator());
        assertTrue(run(evaluator, "truck-1", 1, 105, "v", s).transitions().isEmpty());
        assertTrue(run(evaluator, "truck-1", 2, 115, "v", s).transitions().isEmpty());
        assertEquals(Boolean.TRUE, run(evaluator, "truck-1", 62, 115, "v", s).transitions().getFirst().operator());
    }

    @Test
    void otherRuleFailuresAreReportedWithoutDroppingTheCase() {
        Result r = run(new SignalEvaluator(new InMemoryEpisodeStore()), "truck-1", 0, 105, "v",
                symptom("1 / 0 > 0"));

        assertEquals(Boolean.FALSE, r.transitions().getFirst().operator());
        assertEquals("levels.3.response.operatorWhen", r.errors().getFirst().section());
    }

    @Test
    void eachLevelChangeDecidesForItsOwnLevelOnItsOwnSignal() {
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        CompiledSymptom s = symptom(NOT_OTR_OTE);

        Transition opened = run(evaluator, "truck-1", 0, 92, "v", s).transitions().get(0);
        Transition rose = run(evaluator, "truck-1", 10, 105, "v", s).transitions().get(0);

        assertEquals(1, opened.level());
        assertEquals(Boolean.FALSE, opened.operator(), "level 1 has no operator");
        assertEquals(Kind.LEVEL_CHANGED, rose.kind());
        assertEquals(3, rose.level());
        assertEquals(Boolean.TRUE, rose.operator());
    }

    @Test
    void withoutAConditionTheFlagAloneDecides() {
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        CompiledSymptom s = symptom(null);

        assertEquals(Boolean.TRUE, run(evaluator, "truck-1", 0, 105, "otr", s).transitions().get(0).operator());
        assertEquals(Boolean.FALSE, run(evaluator, "truck-2", 0, 92, "otr", s).transitions().get(0).operator());
    }

    @Test
    void closesAreNotDecided() {
        SignalEvaluator evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
        CompiledSymptom s = symptom(NOT_OTR_OTE);
        run(evaluator, "truck-1", 0, 105, "v", s);
        run(evaluator, "truck-1", 300, 50, "v", s);

        Transition closed = run(evaluator, "truck-1", 600, 50, "v", s).transitions().stream()
                .filter(t -> t.kind() == Kind.CLOSED).findFirst().orElseThrow();
        assertNull(closed.operator());
    }

    @Test
    void rulesCompiledWithoutASpecLeaveTheDecisionToTheCaseStore() {
        CompiledSymptom s = symptom(NOT_OTR_OTE);
        CompiledSymptom bare = new CompiledSymptom(s.definitionId(), s.version(), s.state(), s.sourceKey(),
                s.activation(), s.measure(), s.levels(), s.open(), s.close(), s.note(), s.levelDown(),
                s.opensOnEvents(), s.lifecycleOnEvents(), s.reads(), s.speedLimitSource());

        Result r = run(new SignalEvaluator(new InMemoryEpisodeStore()), "truck-1", 0, 105, "otr", bare);
        assertNull(r.transitions().get(0).operator());
        assertFalse(s.reads().isEmpty());
        assertTrue(s.reads("signal.trip.type"), "the condition's fields count as read");
    }
}
