package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
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
        List<Trace> traces = fixture.traces();
        SymptomSpec template = SeedTemplates.get("night-stop-unauthorized").spec();

        CaseImpact production = CaseImpact.of(traces.stream().map(Trace::expected).toList());
        CaseImpact catalog = CaseImpact.of(traces.stream()
                .map(t -> EvalTraces.replay(template, EvalTraces.source("gps_signal"), t.signals().stream()
                        .map(sig -> ZoneTemplatesParityTest.asBuilt(sig, true)).toList())).toList());
        System.out.println("night-stop impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new CaseImpact(41, Map.of(1, 25, 2, 1, 3, 1, 4, 14), 41), production);
        // Replayed without the operators' closes: on the 14 trips where an operator's treatment expired,
        // production opens nothing more for the trip, and the template reopens on every stop. With the closes
        // replayed the template gives production's transitions on every trip (ZoneTemplatesParityTest).
        assertEquals(new CaseImpact(420, Map.of(1, 381, 2, 10, 3, 3, 4, 26), 420), catalog);
    }
}
