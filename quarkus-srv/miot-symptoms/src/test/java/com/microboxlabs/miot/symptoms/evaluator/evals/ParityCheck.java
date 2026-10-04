package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.KnownGap;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/**
 * Replays a symptom's real trips ({@code evals/<symptom>/production-traces.json}) with production's rule written
 * as a spec ({@code production-rule.json}). A trip must give production's transitions, unless
 * {@code known-gaps.json} lists it: then it must still differ from production and give the pinned result.
 */
final class ParityCheck {

    private ParityCheck() {
    }

    static void assertParity(String symptom, int trips) {
        SymptomSpec spec = EvalTraces.spec(symptom, "production-rule.json");
        Fixture fixture = EvalTraces.fixture(symptom, "production-traces.json");
        DataSource source = EvalTraces.source(fixture.source());
        Map<String, KnownGap> gaps = EvalTraces.knownGaps(symptom, "known-gaps.json");
        List<String> unexpected = new ArrayList<>();
        int transitions = 0;
        for (Trace t : fixture.traces()) {
            List<String> got = EvalTraces.replay(spec, source, t.signals());
            transitions += t.expected().size();
            KnownGap gap = gaps.get(t.id());
            if (gap == null) {
                if (!got.equals(t.expected())) {
                    unexpected.add(t.id() + "\n  production " + t.expected() + "\n  evaluator  " + got);
                }
            } else {
                assertNotEquals(t.expected(), got, t.id() + " now matches production: remove it from known-gaps.json");
                assertEquals(gap.evaluator(), got, t.id() + " (" + gap.reason() + "): the evaluator's result changed");
            }
        }
        System.out.printf("%s parity: %d trips, %d transitions, %d identical, %d known gaps%n", symptom,
                fixture.traces().size(), transitions, fixture.traces().size() - gaps.size() - unexpected.size(),
                gaps.size());

        assertEquals(trips, fixture.traces().size());
        assertEquals(List.of(), unexpected, "trips that no longer match production");
    }
}
