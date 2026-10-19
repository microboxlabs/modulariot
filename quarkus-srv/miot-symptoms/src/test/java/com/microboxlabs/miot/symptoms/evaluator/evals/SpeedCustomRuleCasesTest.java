package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Production's rule for speeding over the organization's own limit (90 km/h here), one behaviour per case.
 * It differs from the road-limit rule in timing: a case opens after 9 s, code black needs 6 s over 21, and
 * there is no signals-per-minute check. {@code gap…} cases pin what a spec cannot express.
 */
class SpeedCustomRuleCasesTest {

    private static final SymptomSpec PRODUCTION = EvalTraces.spec("speed-custom", "production-rule.json");
    private static final DataSource GPS = EvalTraces.source("gps_signal");

    /** Pairs of (seconds, speed) on a road whose own limit is 90. */
    private static List<String> run(int... secondsAndSpeeds) {
        List<Signal> signals = new ArrayList<>();
        for (int i = 0; i < secondsAndSpeeds.length; i += 2) {
            signals.add(new Signal(secondsAndSpeeds[i], EvalTraces.root(Map.of("signal.trip.active", true,
                    "signal.vehicle.weight_category", "HEAVY", "signal.gps.speed_kmh", (double) secondsAndSpeeds[i + 1],
                    "signal.road.maxspeed_custom", 90.0))));
        }
        return EvalTraces.replay(PRODUCTION, GPS, signals);
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
    void aCaseOpensAfter9sAtLeast5Over() {
        assertEquals(List.of(opened(10, 2)), run(0, 96, 5, 96, 10, 96));
    }

    @Test
    void thereIsNoSignalsPerMinuteCheck() {
        assertEquals(List.of(opened(30, 3), changed(36, 3, 4)), run(0, 91, 30, 114, 36, 114));
    }

    @Test
    void codeBlackNeeds6sOver21AndClosesAfter120sUnder() {
        assertEquals(List.of(opened(10, 3), changed(20, 3, 4), closed(150, 4)),
                run(0, 96, 10, 115, 20, 115, 30, 80, 100, 80, 150, 80));
    }

    @Test
    void gapProductionStartsTheCodeBlackClockWhenTheCaseOpens() {
        List<String> production = List.of(opened(10, 3), changed(16, 3, 4));
        List<String> evaluator = List.of(opened(10, 4));
        assertEquals(evaluator, run(0, 115, 5, 115, 10, 115, 16, 115));
        assertNotEquals(production, evaluator);
    }

    @Test
    void gapProductionKeepsCodeBlackThroughADipOfAnyLength() {
        // Code black at 30; under the limit at 60; over again at 200. Unlike the road-limit rule, a pause
        // between signals over the limit never restarts the clock here.
        List<String> production = List.of(opened(10, 2), changed(20, 2, 3), changed(30, 3, 4));
        List<String> evaluator = List.of(opened(10, 2), changed(20, 2, 3), changed(30, 3, 4), changed(200, 4, 3),
                changed(206, 3, 4));
        assertEquals(evaluator, run(0, 96, 10, 96, 20, 115, 30, 115, 60, 80, 200, 115, 206, 115));
        assertNotEquals(production, evaluator);
    }
}
