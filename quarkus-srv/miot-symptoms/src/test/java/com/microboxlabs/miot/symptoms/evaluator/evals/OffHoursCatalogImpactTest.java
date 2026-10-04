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
 * What the catalog's off-hours driving template would do on the same real trips, next to production. When
 * the template changes, update the numbers here and say why in the change.
 */
class OffHoursCatalogImpactTest {

    @Test
    void theTemplateOnTheSameTripsAsProduction() {
        Fixture fixture = EvalTraces.fixture("off-hours-driving", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<Trace> traces = fixture.traces();
        SymptomSpec template = new TemplateService().get("off-hours-driving").spec();

        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, source, t.signals())).toList());
        System.out.println("off-hours impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new CaseImpact(11, Map.of(1, 2, 2, 5, 3, 3, 4, 1), 7), production);
        assertEquals(new CaseImpact(7, Map.of(1, 1, 2, 3, 3, 1, 4, 2), 7), catalog);
    }
}
