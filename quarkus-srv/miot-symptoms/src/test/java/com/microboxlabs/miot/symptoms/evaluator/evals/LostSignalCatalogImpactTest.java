package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
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

        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, source, t.signals().stream()
                        .map(LostSignalCatalogImpactTest::asDetectorCheck).toList())).toList());
        System.out.println("lost-signal impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new CaseImpact(211, Map.of(1, 191, 2, 3, 3, 3, 4, 14), 207), production);
        // A case that never left level 1 closes when the signal returns, so each such loss is its own case. A case
        // that reached level 2 or more is closed only by an operator: a trip's later losses stay in it, at the
        // highest level any of them reached. 10 cases open above level 1: their first lost check already had
        // 30 min of silence (L).
        assertEquals(new CaseImpact(111, Map.of(1, 75, 2, 21, 3, 2, 4, 13), 101), catalog);
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
