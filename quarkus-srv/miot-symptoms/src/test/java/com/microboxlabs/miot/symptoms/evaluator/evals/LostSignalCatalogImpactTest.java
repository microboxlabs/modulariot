package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Lifecycle;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * What the catalog's signal-loss template would do on the same real trips, next to production. When the
 * template changes, update the numbers here and say why in the change.
 *
 * <p>The template reads the lost-signal detector's {@code check.loss.*}; the traces have production's minutes
 * of silence and its lost flag. Each check is read as the detector would write it: {@code silence_s} from the
 * minutes, {@code ratio} 2 where production saw the vehicle lost and 0.5 where it did not.
 */
class LostSignalCatalogImpactTest {

    @Test
    void theTemplateOnTheSameTripsAsProduction() {
        Fixture fixture = EvalTraces.fixture("lost-signal", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<Trace> traces = fixture.traces();
        SymptomSpec template = SeedTemplates.get("signal-loss").spec();
        SymptomSpec operatorOnly = new SymptomSpec(template.source(), template.activation(), template.measure(),
                template.levels(), new Lifecycle(template.lifecycle().open(), "case.closed_by_operator",
                        template.lifecycle().levelDown()), template.recurrence(), template.family(), template.state());

        List<List<String>> previousRuns = new ArrayList<>();
        List<List<String>> catalogRuns = new ArrayList<>();
        for (Trace trace : traces) {
            List<Signal> checks = trace.signals().stream().map(LostSignalCatalogImpactTest::asDetectorCheck).toList();
            List<String> previous = EvalTraces.replay(operatorOnly, source, checks);
            List<String> current = EvalTraces.replay(template, source, checks);
            assertEquals(higherLevelChanges(previous), higherLevelChanges(current),
                    "each trip reaches the same higher levels at the same checks");
            assertTrue(current.stream().filter(t -> t.startsWith("CLOSED")).allMatch(t -> t.endsWith(">1")),
                    "only level-1 cases close before a later loss can open another case on the same trip");
            previousRuns.add(previous);
            catalogRuns.add(current);
        }

        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(catalogRuns);
        System.out.println("lost-signal impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new CaseImpact(211, Map.of(1, 191, 2, 3, 3, 3, 4, 14), 207), production);
        assertEquals(new CaseImpact(59, Map.of(1, 23, 2, 21, 3, 2, 4, 13), 51), CaseImpact.of(previousRuns));
        // A case that never left level 1 closes when the signal returns, so each such loss is its own case. A case
        // that reached level 2 or more is closed only by an operator: a trip's later losses stay in it, at the
        // highest level any of them reached. 10 cases open above level 1: their first lost check already had
        // 30 min of silence (L).
        assertEquals(new CaseImpact(111, Map.of(1, 75, 2, 21, 3, 2, 4, 13), 101), catalog);
    }

    /** Compare time and level: a later loss may now open at level 2 instead of raising an earlier level-1 case. */
    private static List<String> higherLevelChanges(List<String> run) {
        return run.stream().filter(t -> !t.endsWith(">1"))
                .map(t -> t.substring(t.indexOf('@'), t.indexOf(':')) + t.substring(t.indexOf('>'))).toList();
    }

    @SuppressWarnings("unchecked")
    private static Signal asDetectorCheck(Signal s) {
        Map<String, Object> check = new LinkedHashMap<>((Map<String, Object>) s.root().get("check"));
        double minutes = ((Number) check.get("signal_lost_minutes")).doubleValue();
        boolean lost = Boolean.TRUE.equals(check.get("signal_lost"));
        check.put("loss", Map.of("silence_s", minutes * 60, "expected_s", 300.0, "ratio", lost ? 2.0 : 0.5,
                "returned", false, "backfill", false, "low_coverage_zone", false, "cohort_outage", false,
                "nearby_reporting", 0.0));
        return new Signal(s.at(), Map.of("check", check));
    }
}
