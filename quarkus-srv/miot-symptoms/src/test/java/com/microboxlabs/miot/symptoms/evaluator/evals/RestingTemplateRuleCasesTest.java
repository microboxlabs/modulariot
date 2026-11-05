package com.microboxlabs.miot.symptoms.evaluator.evals;

import static com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.transition;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * The continuous-resting template (V0.12.20) on checks: past 16 h 15 min on duty without a rest of 8 h, code
 * black while driving, and the level falls as the rest grows, as the GPS database's resting check.
 */
class RestingTemplateRuleCasesTest {

    private static final DataSource CHECK = EvalTraces.source("trip_check");

    private static Signal check(int at, double dutyMinutes, double restingMinutes) {
        return new Signal(at, EvalTraces.root(Map.of("check.trip.active", true, "check.trip.double_driver", false,
                "check.duty_minutes", dutyMinutes, "check.resting_minutes", restingMinutes)));
    }

    private static List<String> run(Signal... checks) {
        return EvalTraces.replay(SeedTemplates.get("continuous-resting").spec(), CHECK, List.of(checks));
    }

    @Test
    void pastTheDutyLimitDrivingIsCodeBlackAndALongerRestLowersTheLevel() {
        assertEquals(List.of(transition("OPENED", 300, 0, 4), transition("LEVEL_CHANGED", 900, 4, 3),
                        transition("LEVEL_CHANGED", 1800, 3, 2), transition("LEVEL_CHANGED", 3600, 2, 1),
                        transition("CLOSED", 4200, 1, 1)),
                run(check(0, 970, 0), check(300, 980, 0), check(600, 990, 400), check(900, 1000, 425),
                        check(1800, 1010, 450), check(3600, 1020, 470), check(4200, 0, 0)));
    }

    @Test
    void withTwoDriversNothingOpens() {
        assertEquals(List.of(), EvalTraces.replay(SeedTemplates.get("continuous-resting").spec(), CHECK,
                List.of(new Signal(0, EvalTraces.root(Map.of("check.trip.active", true,
                        "check.trip.double_driver", true, "check.duty_minutes", 1000.0,
                        "check.resting_minutes", 0.0))))));
    }
}
