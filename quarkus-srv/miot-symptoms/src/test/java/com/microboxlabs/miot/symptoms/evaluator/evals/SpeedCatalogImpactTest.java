package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.TemplateService;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * What the catalog's speeding template would do on the same real trips, next to production. The template's
 * rules differ on purpose, so this pins the difference: when the template changes, update the numbers here
 * and say why in the change.
 */
class SpeedCatalogImpactTest {

    @Test
    void theTemplateOpensMoreCasesThanProductionOnTheSameTrips() {
        Fixture fixture = EvalTraces.fixture("speed", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<Trace> traces = fixture.traces();
        SymptomSpec template = new TemplateService().get("speeding").spec();

        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, source, t.signals())).toList());
        System.out.println("speed impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new CaseImpact(99, Map.of(2, 45, 3, 49, 4, 5), 0), production);
        assertEquals(new CaseImpact(484, Map.of(1, 222, 2, 76, 3, 177, 4, 9), 278), catalog);
    }
}
