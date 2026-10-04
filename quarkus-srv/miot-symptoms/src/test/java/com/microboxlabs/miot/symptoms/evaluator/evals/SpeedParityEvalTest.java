package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.SpeedTraces.KnownGap;
import com.microboxlabs.miot.symptoms.evaluator.evals.SpeedTraces.Trace;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Real trips replayed through the evaluator with production's speed rule written as a spec
 * ({@code evals/speed/production-rule.json}). Each trace's expected transitions are what
 * production did with those signals; see {@code evals/speed/README.md}.
 */
class SpeedParityEvalTest {

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        SymptomSpec spec = SpeedTraces.spec("production-rule.json");
        List<Trace> traces = SpeedTraces.traces("production-traces.json");
        Map<String, KnownGap> gaps = SpeedTraces.knownGaps("known-gaps.json");
        List<String> unexpected = new ArrayList<>();
        int transitions = 0;
        for (Trace t : traces) {
            List<String> got = SpeedTraces.replay(spec, t.signals());
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
        System.out.printf("speed parity: %d trips, %d transitions, %d identical, %d known gaps%n", traces.size(),
                transitions, traces.size() - gaps.size() - unexpected.size(), gaps.size());

        assertEquals(59, traces.size());
        assertEquals(List.of(), unexpected, "trips that no longer match production");
    }
}
