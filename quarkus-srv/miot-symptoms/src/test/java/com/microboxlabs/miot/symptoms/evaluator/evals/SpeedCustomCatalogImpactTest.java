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
 * The catalog's speeding-custom-limit template on the same real trips as production. Since 2.0.0 the template is the GPS
 * database's rule, so on every trip it gives the transitions of {@code production-rule.json}: production's,
 * except on the known gaps that {@link SpeedCustomParityEvalTest} lists.
 */
class SpeedCustomCatalogImpactTest {

    @Test
    void theTemplateGivesTheProductionRulesTransitionsOnEveryTrip() {
        Fixture fixture = EvalTraces.fixture("speed-custom", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<Trace> traces = fixture.traces();
        SymptomSpec template = SeedTemplates.get("speeding-custom-limit").spec();
        SymptomSpec rule = EvalTraces.spec("speed-custom", "production-rule.json");

        for (Trace t : traces) {
            assertEquals(EvalTraces.replay(rule, source, t.signals()), EvalTraces.replay(template, source, t.signals()),
                    t.id());
        }
        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, source, t.signals())).toList());
        System.out.println("speed-custom impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);
        assertEquals(new CaseImpact(8, Map.of(2, 1, 3, 7), 0), production);
    }
}
