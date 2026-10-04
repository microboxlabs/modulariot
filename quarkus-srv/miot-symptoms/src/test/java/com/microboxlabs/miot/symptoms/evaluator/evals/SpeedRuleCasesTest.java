package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.SpeedTraces.Signal;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/**
 * Production's speed rule, one behaviour per case, on a 90 km/h road. Expected transitions are what
 * production does with the same signals. Cases named {@code gap…} are behaviours the spec cannot express:
 * they pin the evaluator's current result and fail once it matches production.
 */
class SpeedRuleCasesTest {

    private static final SymptomSpec PRODUCTION = SpeedTraces.spec("production-rule.json");

    /** Signals every 30 s from second 0, at these speeds, on a 90 road. */
    private static List<Signal> every30s(double... speeds) {
        List<Signal> out = new ArrayList<>();
        for (int i = 0; i < speeds.length; i++) {
            out.add(new Signal(i * 30, speeds[i], 90));
        }
        return out;
    }

    private static List<String> run(List<Signal> signals) {
        return SpeedTraces.replay(PRODUCTION, signals);
    }

    private static String t(String kind, int at, int level) {
        return SpeedTraces.transition(kind, at, level);
    }

    @Test
    void atTheLimitIsNotOver() {
        assertEquals(List.of(), run(every30s(90, 90, 90, 90, 90)));
    }

    @Test
    void speedIsRoundedBeforeComparing() {
        assertEquals(List.of(), run(every30s(90.4, 90.4, 90.4, 90.4)), "90.4 is 90: not over");
        assertEquals(List.of(t("OPENED", 60, 2)), run(every30s(95.6, 95.6, 95.6)), "95.6 is 96: 6 over");
    }

    @Test
    void aSpikeShorterThanAMinuteOpensNothing() {
        assertEquals(List.of(), run(every30s(110, 80, 110, 80)));
    }

    @Test
    void aCaseOpensAfterAMinuteOverAndAtLeastFiveOver() {
        assertEquals(List.of(t("OPENED", 90, 2)), run(every30s(93, 93, 93, 96)),
                "a minute at 3 over is not enough; it opens at the first signal 5 over");
    }

    @Test
    void theLevelFollowsEachSignalBothWays() {
        assertEquals(List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 1), t("LEVEL_CHANGED", 120, 3)),
                run(every30s(96, 96, 96, 92, 102)));
    }

    @Test
    void theFirstSignalNotOverClosesBelowCodeBlack() {
        assertEquals(List.of(t("OPENED", 60, 3), t("CLOSED", 90, 3)), run(every30s(102, 102, 102, 85)));
    }

    @Test
    void losingTheRoadLimitClosesTheCase() {
        List<Signal> s = new ArrayList<>(every30s(96, 96, 96));
        s.add(new Signal(90, 96, -1));
        assertEquals(List.of(t("OPENED", 60, 2), t("CLOSED", 90, 2)), run(s));
    }

    @Test
    void codeBlackNeedsAMinuteOver21AndClosesAfterTwoMinutesUnder() {
        assertEquals(List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 3), t("LEVEL_CHANGED", 150, 4),
                t("CLOSED", 300, 4)),
                run(every30s(96, 96, 96, 115, 115, 115, 80, 80, 80, 80, 80)));
    }

    @Test
    void aPauseOver90sRestartsTheCodeBlackClock() {
        // Code black at 150; under the limit from 180; over again at 280, 130 s after the last signal over.
        List<Signal> s = new ArrayList<>(every30s(96, 96, 96, 115, 115, 115, 80));
        s.add(new Signal(270, 80, 90));
        s.add(new Signal(280, 115, 90));
        s.add(new Signal(310, 80, 90));
        assertEquals(List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 3), t("LEVEL_CHANGED", 150, 4),
                t("LEVEL_CHANGED", 280, 3), t("CLOSED", 310, 3)), run(s));
    }

    @Test
    void aSignalOlderThanTheLastOneIsIgnored() {
        List<Signal> s = new ArrayList<>(every30s(96, 96, 96));
        s.add(new Signal(45, 130, 90));
        assertEquals(List.of(t("OPENED", 60, 2)), run(s));
    }

    @Test
    void gapProductionNeedsASignalPerMinuteToOpen() {
        List<Signal> s = List.of(new Signal(0, 91, 90), new Signal(289, 114, 90));
        List<String> production = List.of();
        List<String> evaluator = List.of(t("OPENED", 289, 3));
        assertEquals(evaluator, run(s));
        assertNotEquals(production, evaluator);
    }

    @Test
    void gapProductionStartsTheCodeBlackClockWhenTheCaseOpens() {
        List<Signal> s = every30s(115, 115, 115, 115);
        List<String> production = List.of(t("OPENED", 60, 3));
        List<String> evaluator = List.of(t("OPENED", 60, 4));
        assertEquals(evaluator, run(s));
        assertNotEquals(production, evaluator);
    }

    @Test
    void gapProductionKeepsCodeBlackThroughADipShorterThan90s() {
        // Code black at 150; under the limit at 180; over again at 210, 60 s after the last signal over.
        List<Signal> s = every30s(96, 96, 96, 115, 115, 115, 80, 115);
        List<String> production = List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 3), t("LEVEL_CHANGED", 150, 4));
        List<String> evaluator = List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 3), t("LEVEL_CHANGED", 150, 4),
                t("LEVEL_CHANGED", 210, 3));
        assertEquals(evaluator, run(s));
        assertNotEquals(production, evaluator);
    }

    @Test
    void gapProductionClosesAtOnceWhenTheTripEnds() {
        List<Signal> s = new ArrayList<>(every30s(96, 96, 96, 115, 115, 115));
        s.add(new Signal(180, 115, 90, false));
        List<String> production = List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 3), t("LEVEL_CHANGED", 150, 4),
                t("CLOSED", 180, 4));
        List<String> evaluator = List.of(t("OPENED", 60, 2), t("LEVEL_CHANGED", 90, 3), t("LEVEL_CHANGED", 150, 4));
        assertEquals(evaluator, run(s));
        assertNotEquals(production, evaluator);
    }
}
