package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.SpeedTraces.Trace;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.TreeMap;
import org.junit.jupiter.api.Test;

/**
 * Real trips replayed through the evaluator with production's speed rule written as a spec
 * ({@code evals/speed/production-rule.json}). Each trace's expected transitions are what
 * production did with those signals; see {@code evals/speed/README.md}.
 */
class SpeedParityEvalTest {

    private static final String BLACK_CLOCK = "code black: production counts the 60 s from the case opening, "
            + "the evaluator from the first signal over 21";
    private static final String SPARSE = "production opens a case only with at least one signal per minute";

    /** Traces production handles differently for a reason a spec cannot express. They must keep differing. */
    private static final Map<String, String> KNOWN_GAPS = Map.of(
            "v01", BLACK_CLOCK,
            "v03", SPARSE,
            "v06", BLACK_CLOCK,
            "v08", BLACK_CLOCK,
            "v10", BLACK_CLOCK,
            "v40", BLACK_CLOCK,
            "v45", BLACK_CLOCK);

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        SymptomSpec spec = SpeedTraces.spec("production-rule.json");
        List<Trace> traces = SpeedTraces.traces("production-traces.json");
        List<String> unexpected = new ArrayList<>();
        Map<String, String> gapsStillOpen = new TreeMap<>();
        int transitions = 0;
        for (Trace t : traces) {
            List<String> got = SpeedTraces.replay(spec, t.signals());
            transitions += t.expected().size();
            boolean same = got.equals(t.expected());
            if (KNOWN_GAPS.containsKey(t.id())) {
                if (!same) {
                    gapsStillOpen.put(t.id(), KNOWN_GAPS.get(t.id()));
                }
            } else if (!same) {
                unexpected.add(t.id() + "\n  production " + t.expected() + "\n  evaluator  " + got);
            }
        }
        System.out.printf("speed parity: %d trips, %d transitions, %d identical, %d known gaps%n", traces.size(),
                transitions, traces.size() - gapsStillOpen.size() - unexpected.size(), gapsStillOpen.size());

        assertEquals(59, traces.size());
        assertEquals(List.of(), unexpected, "trips that no longer match production");
        assertEquals(new TreeMap<>(KNOWN_GAPS), gapsStillOpen,
                "a known gap now matches production: remove it from KNOWN_GAPS");
    }
}
