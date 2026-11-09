package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import com.microboxlabs.miot.symptoms.signal.TripCheck;
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

    /** One check every 5 minutes with these net driving minutes, on a trip. */
    private static List<String> run(boolean doubleDriver, double... minutes) {
        return run(true, doubleDriver, minutes);
    }

    private static List<String> run(boolean onTrip, boolean doubleDriver, double... minutes) {
        List<Signal> signals = new ArrayList<>();
        for (int i = 0; i < minutes.length; i++) {
            signals.add(new Signal(i * 300, EvalTraces.root(Map.of("check.trip.active", onTrip,
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
    void twoDriversOrNoTripOpenNothing() {
        assertEquals(List.of(), run(true, 300, 330, 360));
        assertEquals(List.of(), run(false, false, 300, 330, 360));
    }

    @Test
    void theTripEndingClosesTheCase() {
        List<Signal> signals = List.of(
                new Signal(0, EvalTraces.root(Map.of("check.trip.active", true, "check.trip.double_driver", false,
                        "check.driving_minutes", 300.0))),
                new Signal(300, EvalTraces.root(Map.of("check.trip.active", false, "check.trip.double_driver", false,
                        "check.driving_minutes", 300.0))));
        assertEquals(List.of(opened(0, 2), closed(300, 2)), EvalTraces.replay(PRODUCTION, CHECK, signals));
    }

    private static final String INSIDE = "check.?geo.?authorized_zone.orValue(false)";

    /**
     * Production's rule with the authorized zone as level 1: levels 2 to 4 only outside the zone, and level 1 for
     * every frame inside it.
     */
    private static SymptomSpec quietInsideZones() {
        List<SymptomSpec.Level> levels = new ArrayList<>();
        for (SymptomSpec.Level l : PRODUCTION.levels()) {
            String when = l.icu() == 1 ? "(" + l.when() + ") || " + INSIDE : "(" + l.when() + ") && !" + INSIDE;
            levels.add(new SymptomSpec.Level(l.icu(), l.applies(), when, l.response()));
        }
        return new SymptomSpec(PRODUCTION.source(), PRODUCTION.activation(), PRODUCTION.measure(), levels,
                PRODUCTION.lifecycle(), PRODUCTION.recurrence());
    }

    private static Signal zoned(int at, double minutes, Boolean inside) {
        Map<String, Object> flat = new java.util.HashMap<>(Map.of("check.trip.active", true,
                "check.trip.double_driver", false, "check.driving_minutes", minutes));
        if (inside != null) {
            flat.put("check.geo.authorized_zone", inside);
        }
        return new Signal(at, EvalTraces.root(flat));
    }

    @Test
    void enteringAnAuthorizedZoneDropsTheCaseToLevelOneAndLeavingItRaisesItAgain() {
        List<Signal> signals = List.of(zoned(0, 340, false), zoned(300, 345, true), zoned(600, 350, true),
                zoned(900, 355, null), zoned(1200, 362, true), zoned(1500, 365, false));
        assertEquals(List.of(opened(0, 3), changed(300, 3, 1), changed(900, 1, 3), changed(1200, 3, 1),
                changed(1500, 1, 4)), EvalTraces.replay(quietInsideZones(), CHECK, signals));
    }

    @Test
    void theZoneExpressionCompilesAndReadsFalseOnLostSignalChecks() {
        SymptomSpec spec = new SymptomSpec("trip_check", "check.driving_minutes >= 0 && !" + INSIDE, null,
                List.of(new SymptomSpec.Level(1, true, INSIDE + " == false", null)), PRODUCTION.lifecycle(), null);
        List<Signal> lost = new ArrayList<>();
        List<Map<String, Object>> samples = TripCheck.samples();
        for (int i = 0; i < samples.size(); i++) {
            lost.add(new Signal(i * 300, samples.get(i)));
        }
        assertEquals(List.of(opened(0, 1)), EvalTraces.replay(spec, CHECK, lost), "no geo: outside");
        assertEquals(List.of(opened(0, 1)), EvalTraces.replay(spec, CHECK,
                List.of(zoned(0, 10, false), zoned(300, 10, null))));
        assertEquals(List.of(), EvalTraces.replay(spec, CHECK, List.of(zoned(0, 10, true))));
    }
}
