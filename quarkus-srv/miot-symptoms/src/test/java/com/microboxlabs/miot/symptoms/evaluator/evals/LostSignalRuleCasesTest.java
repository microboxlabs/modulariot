package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Production's lost-signal rule, one behaviour per case: one check every 5 minutes with the minutes since the
 * last signal and whether that is more than the area's normal gap. Expected transitions are what production does.
 */
class LostSignalRuleCasesTest {

    private static final SymptomSpec PRODUCTION = EvalTraces.spec("lost-signal", "production-rule.json");
    private static final Fixture FIXTURE = EvalTraces.fixture("lost-signal", "production-traces.json");
    private static final DataSource CHECK = EvalTraces.source(FIXTURE);

    private static Signal check(int at, boolean onTrip, double minutes, boolean lost) {
        return new Signal(at, EvalTraces.root(Map.of("check.trip.active", onTrip, "check.signal_lost_minutes",
                minutes, "check.signal_lost", lost)));
    }

    /** A vehicle silent since minute 0, checked every 5 minutes, lost from the given minute on. */
    private static List<Signal> silent(int lostFrom, int until) {
        List<Signal> out = new ArrayList<>();
        for (int m = 5; m <= until; m += 5) {
            out.add(check(m * 60, true, m, m >= lostFrom));
        }
        return out;
    }

    private static List<String> run(List<Signal> signals) {
        return EvalTraces.replay(PRODUCTION, CHECK, signals);
    }

    private static String opened(int at, int level) {
        return EvalTraces.transition("OPENED", at, 0, level);
    }

    private static String changed(int at, int from, int to) {
        return EvalTraces.transition("LEVEL_CHANGED", at, from, to);
    }

    private static String closed(int at, int level) {
        return EvalTraces.transition("CLOSED", at, level, level);
    }

    @Test
    void aCaseOpensWhenTheSilenceExceedsTheAreasNormalGapAndRisesAt90_120And180Minutes() {
        assertEquals(List.of(opened(900, 1), changed(5400, 1, 2), changed(7200, 2, 3), changed(10800, 3, 4)),
                run(silent(15, 180)));
    }

    @Test
    void aSignalClosesTheCase() {
        List<Signal> s = new ArrayList<>(silent(15, 30));
        s.add(check(2100, true, 0, false));
        assertEquals(List.of(opened(900, 1), closed(2100, 1)), run(s));
    }

    @Test
    void aLongSilenceThatIsNormalForTheAreaOrOffATripOpensNothing() {
        assertEquals(List.of(), run(List.of(check(300, true, 45, false), check(600, true, 50, false))));
        assertEquals(List.of(), run(List.of(check(300, false, 45, true))));
    }
}
