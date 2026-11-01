package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The platform's GPS sabotage template: a power-disconnected or jamming event on a trip opens a level-4 case. */
class GpsSabotageRuleCasesTest {

    private static final SymptomSpec TEMPLATE = SeedTemplates.get("gps-sabotage").spec();
    private static final DataSource GPS = EvalTraces.source("gps_signal");

    private static Signal signal(int at, boolean onTrip, Boolean power, Boolean jamming) {
        Map<String, Object> flat = new LinkedHashMap<>();
        flat.put("signal.trip.active", onTrip);
        if (power != null) {
            flat.put("signal.derived.power_disconnected", power);
        }
        if (jamming != null) {
            flat.put("signal.derived.jamming", jamming);
        }
        return new Signal(at, EvalTraces.root(flat));
    }

    private static List<String> run(Signal... signals) {
        return EvalTraces.replay(TEMPLATE, GPS, List.of(signals));
    }

    @Test
    void aPowerDisconnectionOnATripOpensAtLevel4AndStaysForTheOperator() {
        assertEquals(List.of(EvalTraces.transition("OPENED", 30, 0, 4)),
                run(signal(0, true, false, false), signal(30, true, true, false), signal(60, true, false, false),
                        signal(3600, true, false, false)));
    }

    @Test
    void jammingOpensToo() {
        assertEquals(List.of(EvalTraces.transition("OPENED", 0, 0, 4)), run(signal(0, true, false, true)));
    }

    @Test
    void offATripOrWithoutTheFieldsNothingOpens() {
        assertEquals(List.of(), run(signal(0, false, true, true)));
        assertEquals(List.of(), run(signal(0, true, null, null)), "a signal built before the fields existed");
    }
}
