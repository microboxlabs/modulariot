package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The catalog's speeding template on the same real trips as production. Since 2.0.0 the template is the GPS
 * database's rule, so on every trip it gives the transitions of {@code production-rule.json}: production's,
 * except on the known gaps that {@link SpeedParityEvalTest} lists.
 */
class SpeedCatalogImpactTest {

    @Test
    void theTemplateGivesTheProductionRulesTransitionsOnEveryTrip() {
        Fixture fixture = EvalTraces.fixture("speed", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<Trace> traces = fixture.traces();
        SymptomSpec template = SeedTemplates.get("speeding").spec();
        SymptomSpec rule = EvalTraces.spec("speed", "production-rule.json");

        for (Trace t : traces) {
            assertEquals(EvalTraces.replay(rule, source, t.signals()), EvalTraces.replay(template, source, t.signals()),
                    t.id());
        }
        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, source, t.signals())).toList());
        System.out.println("speed impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);
        assertEquals(new CaseImpact(99, Map.of(2, 45, 3, 49, 4, 5), 0), production);
    }

    @Test
    void withoutRoadLimitsNothingOpensAndNoRuleFails() {
        SymptomSpec template = SeedTemplates.get("speeding").spec();
        DataSource gps = EvalTraces.source("gps_signal");
        List<EvalTraces.Signal> noRoad = java.util.stream.IntStream.range(0, 10)
                .mapToObj(i -> new EvalTraces.Signal(i * 30, EvalTraces.root(Map.of("signal.trip.active", true,
                        "signal.frame.gps.speed", 140.0))))
                .toList();
        assertEquals(List.of(), EvalTraces.replay(template, gps, noRoad));
    }

    @Test
    void whereTheOrganizationHasItsOwnLimitTheRoadLimitIsNotChecked() {
        SymptomSpec template = SeedTemplates.get("speeding").spec();
        DataSource gps = EvalTraces.source("gps_signal");
        List<EvalTraces.Signal> own = java.util.stream.IntStream.range(0, 10)
                .mapToObj(i -> new EvalTraces.Signal(i * 30, EvalTraces.root(Map.of("signal.trip.active", true,
                        "signal.frame.gps.speed", 140.0, "signal.road.maxspeed_osm", 90.0,
                        "signal.road.maxspeed_custom", 80.0))))
                .toList();
        assertEquals(List.of(), EvalTraces.replay(template, gps, own));
        SymptomSpec custom = SeedTemplates.get("speeding-custom-limit").spec();
        assertEquals(List.of(EvalTraces.transition("OPENED", 30, 0, 4)), EvalTraces.replay(custom, gps, own));
    }
}
