package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.TemplateService;
import com.microboxlabs.miot.symptoms.evaluator.evals.SpeedTraces.Trace;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

/**
 * What the catalog's speeding template would do on the same real trips, next to production. The template's
 * rules differ on purpose, so this pins the difference: when the template changes, update the numbers here
 * and say why in the change.
 */
class SpeedCatalogImpactTest {

    /** Cases opened, and cases by the highest level they reached. */
    record Impact(int cases, Map<Integer, Integer> byTopLevel, int openedAtLevel1) {
    }

    static Impact impact(List<List<String>> runs) {
        int cases = 0;
        int openedAt1 = 0;
        Map<Integer, Integer> byTop = new TreeMap<>();
        for (List<String> run : runs) {
            int top = 0;
            boolean open = false;
            for (String t : run) {
                int level = Integer.parseInt(t.substring(t.indexOf('>') + 1));
                if (t.startsWith("OPENED")) {
                    cases++;
                    open = true;
                    top = level;
                    openedAt1 += level == 1 ? 1 : 0;
                } else if (t.startsWith("CLOSED")) {
                    byTop.merge(top, 1, Integer::sum);
                    open = false;
                } else {
                    top = Math.max(top, level);
                }
            }
            if (open) {
                byTop.merge(top, 1, Integer::sum);
            }
        }
        return new Impact(cases, byTop, openedAt1);
    }

    @Test
    void theTemplateOpensMoreCasesThanProductionOnTheSameTrips() {
        List<Trace> traces = SpeedTraces.traces("production-traces.json");
        SymptomSpec template = new TemplateService().get("speeding").spec();

        Impact production = impact(traces.stream().map(Trace::expected).toList());
        Impact catalog = impact(traces.stream().map(t -> SpeedTraces.replay(template, t.signals())).toList());
        System.out.println("speed impact on " + traces.size() + " trips: production " + production
                + ", catalog template " + catalog);

        assertEquals(new Impact(99, Map.of(2, 45, 3, 49, 4, 5), 0), production);
        assertEquals(new Impact(484, Map.of(1, 222, 2, 76, 3, 177, 4, 9), 278), catalog);
    }
}
