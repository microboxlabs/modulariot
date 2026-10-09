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
 * What the catalog's night-stop template would do on the same real trips, next to production. When the
 * template changes, update the numbers here and say why in the change.
 */
class NightStopCatalogImpactTest {

    @Test
    void theTemplateOnTheSameTripsAsProduction() {
        Fixture fixture = EvalTraces.fixture("night-stop-unauthorized", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<Trace> traces = fixture.traces();
        SymptomSpec template = new TemplateService().get("night-stop-unauthorized").spec();

        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, source, t.signals())).toList());
        System.out.println("night-stop impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new CaseImpact(41, Map.of(1, 25, 2, 1, 3, 1, 4, 14), 41), production);
        assertEquals(new CaseImpact(30, Map.of(1, 7, 3, 1, 4, 22), 30), catalog);
    }
}
