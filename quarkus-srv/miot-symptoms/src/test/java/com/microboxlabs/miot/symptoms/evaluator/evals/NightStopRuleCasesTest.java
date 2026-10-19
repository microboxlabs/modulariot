package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Production's rule for stopping at night outside an authorized zone, one behaviour per case. Expected
 * transitions are what production does with the same signals. {@code gap…} cases pin what a spec cannot
 * express and fail once the evaluator matches production.
 */
class NightStopRuleCasesTest {

    private static final SymptomSpec PRODUCTION = EvalTraces.spec("night-stop-unauthorized", "production-rule.json");
    private static final DataSource GPS = EvalTraces.source("gps_signal");

    /** A single-driver truck on a trip, stopped outside every authorized zone, at this local hour. */
    private static Map<String, Object> stopped(double hour) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("signal.trip.active", true);
        s.put("signal.trip.double_driver", false);
        s.put("signal.gps.moving", false);
        s.put("signal.geo.authorized_zone", false);
        s.put("signal.local_hour", hour);
        return s;
    }

    private static Signal at(int seconds, Map<String, Object> fields) {
        return new Signal(seconds, EvalTraces.root(fields));
    }

    private static Map<String, Object> with(Map<String, Object> base, String path, Object value) {
        Map<String, Object> s = new LinkedHashMap<>(base);
        s.put(path, value);
        return s;
    }

    /** Stopped from 23:00, one signal every 5 minutes for this many minutes. */
    private static List<Signal> stoppedFor(int minutes) {
        List<Signal> out = new ArrayList<>();
        for (int m = 0; m <= minutes; m += 5) {
            out.add(at(m * 60, stopped(23 + m / 60.0)));
        }
        return out;
    }

    private static List<String> run(List<Signal> signals) {
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
    void theLevelRisesEveryTenMinutesStopped() {
        assertEquals(List.of(opened(0, 1), changed(600, 1, 2), changed(1200, 2, 3), changed(1800, 3, 4)),
                run(stoppedFor(35)));
    }

    @Test
    void movingClosesTheCaseAtOnce() {
        List<Signal> s = new ArrayList<>(stoppedFor(15));
        s.add(at(960, with(stopped(23.3), "signal.gps.moving", true)));
        assertEquals(List.of(opened(0, 1), changed(600, 1, 2), closed(960, 2)), run(s));
    }

    @Test
    void theWindowRunsFrom21To6LocalTime() {
        assertEquals(List.of(), run(List.of(at(0, stopped(20.99)), at(30, stopped(20.999)))), "before 21:00");
        assertEquals(List.of(opened(0, 1)), run(List.of(at(0, stopped(21.0)))), "21:00:00 is inside");
        assertEquals(List.of(opened(0, 1), closed(60, 1)),
                run(List.of(at(0, stopped(5.98)), at(30, stopped(5.9997)), at(60, stopped(6.0)))),
                "05:59:59 is inside, 06:00:00 is not");
    }

    @Test
    void anAuthorizedZoneADoubleDriverOrNoTripOpenNothing() {
        assertEquals(List.of(), run(List.of(at(0, with(stopped(23), "signal.geo.authorized_zone", true)))));
        assertEquals(List.of(), run(List.of(at(0, with(stopped(23), "signal.trip.double_driver", true)))));
        assertEquals(List.of(), run(List.of(at(0, with(stopped(23), "signal.trip.active", false)))));
    }

    @Test
    void stoppingAgainStartsANewCaseFromLevelOne() {
        List<Signal> s = new ArrayList<>(stoppedFor(15));
        s.add(at(960, with(stopped(23.3), "signal.gps.moving", true)));
        s.add(at(1000, stopped(23.3)));
        assertEquals(List.of(opened(0, 1), changed(600, 1, 2), closed(960, 2), opened(1000, 1)), run(s));
    }

    @Test
    void gapProductionStopsAfterAnOperatorHandledTheTrip() {
        // An operator's treatment of the case expired at 300 s: production closes it there and opens no more
        // cases on this trip. The evaluator gets no operator events.
        List<String> production = List.of(opened(0, 1), closed(300, 1));
        List<String> evaluator = List.of(opened(0, 1), changed(600, 1, 2), changed(1200, 2, 3));
        assertEquals(evaluator, run(stoppedFor(25)));
        assertNotEquals(production, evaluator);
    }
}
