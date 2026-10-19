package com.microboxlabs.miot.symptoms.evaluator.evals;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Fixture;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Trace;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Real trips through the evaluator with production's continuous-driving rule; see
 * {@code evals/continuous-driving/README.md}.
 */
class ContinuousDrivingParityEvalTest {

    private static final int CADENCE_S = 300;

    @Test
    void realTripsGiveTheTransitionsProductionGave() {
        ParityCheck.assertParity("continuous-driving", 4);
    }

    /**
     * Production checks on every GPS signal; {@code trip_check} declares one check every 5 minutes. At that
     * cadence each check carries the latest value, and transitions land on the next check. This pins what that
     * changes on the same trips.
     */
    @Test
    void atTheSourcesFiveMinuteCadence() {
        SymptomSpec spec = EvalTraces.spec("continuous-driving", "production-rule.json");
        Fixture fixture = EvalTraces.fixture("continuous-driving", "production-traces.json");
        DataSource source = EvalTraces.source(fixture);
        List<List<String>> production = new ArrayList<>();
        List<List<String>> every5min = new ArrayList<>();
        int sameLevels = 0;
        for (Trace t : fixture.traces()) {
            List<String> got = EvalTraces.replay(spec, source, resample(t.signals()));
            production.add(t.expected());
            every5min.add(got);
            if (levels(got).equals(levels(t.expected()))) {
                sameLevels++;
                for (int k = 0; k < got.size(); k++) {
                    int late = at(got.get(k)) - at(t.expected().get(k));
                    assertEquals(true, late >= 0 && late <= CADENCE_S,
                            t.id() + ": " + got.get(k) + " is " + late + " s after " + t.expected().get(k));
                }
            }
        }
        CaseImpact atSignals = CaseImpact.of(production);
        CaseImpact atChecks = CaseImpact.of(every5min);
        System.out.println("continuous-driving at a 5-minute cadence: per signal " + atSignals + ", every 5 min "
                + atChecks + ", same level sequence on " + sameLevels + " of " + fixture.traces().size() + " trips");

        assertEquals(new CaseImpact(4, Map.of(2, 1, 3, 2, 4, 1), 4), atSignals);
        assertEquals(atSignals, atChecks, "the same cases at a 5-minute cadence");
        assertEquals(4, sameLevels, "the same level sequences, each transition at most 5 minutes later");
    }

    private static int at(String transition) {
        return Integer.parseInt(transition.substring(transition.indexOf('@') + 1, transition.indexOf(':')));
    }

    /** One check every 5 minutes from the first signal, with the latest signal's values. */
    private static List<Signal> resample(List<Signal> signals) {
        List<Signal> out = new ArrayList<>();
        int last = signals.get(signals.size() - 1).at();
        int i = 0;
        for (int tick = signals.get(0).at(); tick <= last + CADENCE_S; tick += CADENCE_S) {
            while (i + 1 < signals.size() && signals.get(i + 1).at() <= tick) {
                i++;
            }
            out.add(new Signal(tick, signals.get(i).root()));
        }
        return out;
    }

    private static List<String> levels(List<String> transitions) {
        return transitions.stream().map(t -> t.substring(0, t.indexOf('@')) + t.substring(t.indexOf('>'))).toList();
    }
}
