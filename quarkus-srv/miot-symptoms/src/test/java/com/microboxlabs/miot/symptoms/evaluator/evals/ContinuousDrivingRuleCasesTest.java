package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Production's continuous-driving rule, one behaviour per case, given net driving minutes (driving minus
 * the rest that pays it back), as the source provides them. Expected transitions are what production does.
 */
class ContinuousDrivingRuleCasesTest {

    private static final SymptomSpec PRODUCTION = EvalTraces.spec("continuous-driving", "production-rule.json");
    private static final DataSource CHECK = EvalTraces.source("trip_check");

    /** One check every 5 minutes with these net driving minutes; one driver unless said otherwise. */
    private static List<String> run(boolean doubleDriver, double... minutes) {
        List<Signal> signals = new ArrayList<>();
        for (int i = 0; i < minutes.length; i++) {
            signals.add(new Signal(i * 300, EvalTraces.root(Map.of("check.trip.active", true,
                    "check.trip.double_driver", doubleDriver, "check.driving_minutes", minutes[i]))));
        }
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
    void aCaseOpensAt4h30OfNetDrivingAndRisesEvery30Minutes() {
        assertEquals(List.of(opened(300, 1), changed(900, 1, 2), changed(1800, 2, 3), changed(2700, 3, 4)),
                run(false, 269.9, 270, 285, 300, 315, 320, 330, 345, 350, 360));
    }

    @Test
    void restLowersTheLevelAndClosesUnder4h30() {
        assertEquals(List.of(opened(0, 4), changed(300, 4, 2), changed(600, 2, 1), closed(900, 1)),
                run(false, 365, 310, 280, 260));
    }

    @Test
    void twoDriversOpenNothing() {
        assertEquals(List.of(), run(true, 300, 330, 360));
    }
}
