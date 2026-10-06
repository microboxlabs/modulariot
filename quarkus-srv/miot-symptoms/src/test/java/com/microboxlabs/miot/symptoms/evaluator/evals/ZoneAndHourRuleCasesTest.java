package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Production's rules for stops in risk zones (day and night) and for driving in the early morning, one
 * behaviour per case. Expected transitions are what production does with the same signals. {@code gap…} cases
 * pin what a spec cannot express and fail once the evaluator matches production.
 */
class ZoneAndHourRuleCasesTest {

    private static final double S = 1 / 3600.0;

    private static List<String> run(String symptom, List<Signal> signals) {
        SymptomSpec spec = EvalTraces.spec(symptom, "production-rule.json");
        Fixture fixture = EvalTraces.fixture(symptom, "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        return EvalTraces.replay(spec, source, signals);
    }

    /** A single-driver truck on a trip at this local hour; moving or stopped; in a risk zone or not. */
    private static Signal at(int seconds, double hour, boolean moving, boolean riskZone) {
        Map<String, Object> s = new LinkedHashMap<>();
        s.put("signal.trip.active", true);
        s.put("signal.trip.double_driver", false);
        s.put("signal.gps.moving", moving);
        s.put("signal.geo.risk_zone", riskZone);
        s.put("signal.local_hour", hour);
        return new Signal(seconds, EvalTraces.root(s));
    }

    /** One signal every 5 minutes from this hour, for this many minutes. */
    private static List<Signal> every5min(double fromHour, int minutes, boolean moving, boolean riskZone) {
        List<Signal> out = new ArrayList<>();
        for (int m = 0; m <= minutes; m += 5) {
            out.add(at(m * 60, fromHour + m / 60.0, moving, riskZone));
        }
        return out;
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
    void riskZoneStopRisesAt10_25And40Minutes() {
        assertEquals(List.of(opened(0, 1), changed(600, 1, 2), changed(1500, 2, 3), changed(2400, 3, 4)),
                run("risk-zone-stop", every5min(10, 45, false, true)));
    }

    @Test
    void riskZoneStopIsADaytimeRuleAndNeedsTheZone() {
        assertEquals(List.of(), run("risk-zone-stop", List.of(at(0, 6, false, true))), "06:00:00 is outside");
        assertEquals(List.of(opened(0, 1)), run("risk-zone-stop", List.of(at(0, 6 + S, false, true))));
        assertEquals(List.of(opened(0, 1), closed(1, 1)),
                run("risk-zone-stop", List.of(at(0, 21 - S, false, true), at(1, 21, false, true))),
                "20:59:59 is inside, 21:00:00 is not");
        assertEquals(List.of(), run("risk-zone-stop", List.of(at(0, 12, false, false))));
        assertEquals(List.of(opened(0, 1), closed(60, 1)),
                run("risk-zone-stop", List.of(at(0, 12, false, true), at(60, 12, true, true))), "moving closes");
    }

    @Test
    void nightRiskStayRisesAt10_20And30MinutesEvenWithTwoDrivers() {
        assertEquals(List.of(opened(0, 1), changed(600, 1, 2), changed(1200, 2, 3), changed(1800, 3, 4)),
                run("night-risk-stay", every5min(22, 35, false, true)));
        Map<String, Object> twoDrivers = new LinkedHashMap<>();
        twoDrivers.put("signal.trip.active", true);
        twoDrivers.put("signal.trip.double_driver", true);
        twoDrivers.put("signal.gps.moving", false);
        twoDrivers.put("signal.geo.risk_zone", true);
        twoDrivers.put("signal.local_hour", 23.0);
        assertEquals(List.of(opened(0, 1)),
                run("night-risk-stay", List.of(new Signal(0, EvalTraces.root(twoDrivers)))));
    }

    @Test
    void offHoursDrivingLevelFollowsTheClock() {
        assertEquals(List.of(), run("off-hours-driving", List.of(at(0, 1.5, true, false))), "01:30:00 is outside");
        assertEquals(List.of(opened(0, 1)), run("off-hours-driving", List.of(at(0, 1.5 + S, true, false))),
                "01:30:01 is level 1");
        assertEquals(List.of(opened(0, 2), changed(1800, 2, 3)),
                run("off-hours-driving", List.of(at(0, 2.0 + S, true, false), at(1800, 2.5 + S, true, false))),
                "02:00 is level 2; 02:30 is level 3 while under 45 min driving");
        assertEquals(List.of(opened(0, 3), changed(600, 3, 2), closed(1200, 2)),
                run("off-hours-driving", List.of(at(0, 5.5, true, false), at(600, 340 / 60.0, true, false),
                        at(1200, 6.0, true, false))), "05:40 is level 2, 06:00 closes");
        assertEquals(List.of(opened(0, 3), closed(60, 3)),
                run("off-hours-driving", List.of(at(0, 3, true, false), at(60, 3, false, false))), "stopping closes");
    }

    @Test
    void offHoursDrivingReachesCodeBlackAfter45MinutesInTheMiddleOfTheNight() {
        assertEquals(List.of(opened(0, 3), changed(2700, 3, 4)), run("off-hours-driving", every5min(3, 45, true, false)));
    }

    @Test
    void gapProductionCountsTheOffHours45MinutesFromTheCaseStart() {
        // Driving since 01:45: production is at level 4 from the first signal after 02:30 (45 min driving);
        // the evaluator counts the time from 02:30, when level 4's clock window opens.
        List<Signal> s = every5min(1.75, 50, true, false);
        List<String> production = List.of(opened(0, 1), changed(900, 1, 2), changed(2700, 2, 4));
        List<String> evaluator = List.of(opened(0, 1), changed(900, 1, 2), changed(2700, 2, 3));
        assertEquals(evaluator, run("off-hours-driving", s));
        assertNotEquals(production, evaluator);
    }
}
