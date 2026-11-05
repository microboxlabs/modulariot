package com.microboxlabs.miot.symptoms.evaluator.evals;

import static com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.transition;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeStore;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/** The route templates (V0.12.21): ETA deviation early and late, and the double-driver rotation reminder. */
class RouteTemplatesRuleCasesTest {

    private static final DataSource GPS = EvalTraces.source("gps_signal");

    private static Signal onTrip(int at, Double etaDeviation, boolean doubleDriver, double ageMin) {
        Map<String, Object> trip = new LinkedHashMap<>();
        trip.put("active", true);
        trip.put("double_driver", doubleDriver);
        trip.put("id", "T-1");
        trip.put("age_min", ageMin);
        trip.put("destination", Map.of("visited", false));
        if (etaDeviation != null) {
            trip.put("eta_deviation_min", etaDeviation);
        }
        return new Signal(at, Map.of("signal", Map.of("trip", trip)));
    }

    private static Signal offTrip(int at) {
        return new Signal(at, Map.of("signal", Map.of("trip", Map.of("active", false, "double_driver", false))));
    }

    private static List<String> run(String template, Signal... signals) {
        return EvalTraces.replay(SeedTemplates.get(template).spec(), GPS, List.of(signals));
    }

    @Test
    void earlyArrivalOpensFromFortyMinutesAndFollowsTheDeviation() {
        assertEquals(List.of(transition("OPENED", 60, 0, 1), transition("LEVEL_CHANGED", 120, 1, 2),
                        transition("LEVEL_CHANGED", 180, 2, 4), transition("LEVEL_CHANGED", 240, 4, 3),
                        transition("CLOSED", 400, 3, 3)),
                run("eta-early", onTrip(0, -30.0, false, 60), onTrip(60, -45.0, false, 61),
                        onTrip(120, -70.0, false, 62), onTrip(180, -200.0, false, 63), onTrip(240, -130.0, false, 64),
                        onTrip(300, -10.0, false, 65), offTrip(400)));
    }

    @Test
    void lateArrivalUsesItsOwnLadder() {
        assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("LEVEL_CHANGED", 60, 1, 3),
                        transition("LEVEL_CHANGED", 120, 3, 4)),
                run("eta-late", onTrip(0, 150.0, false, 60), onTrip(60, 250.0, false, 61),
                        onTrip(120, 500.0, false, 62)));
        assertEquals(List.of(), run("eta-late", onTrip(0, 100.0, false, 60)), "under 120 min late");
    }

    @Test
    void withoutAPredictionNothingOpensAndNoRuleFails() {
        assertEquals(List.of(), run("eta-early", onTrip(0, null, false, 60)));
        assertEquals(List.of(), run("eta-late", onTrip(0, null, false, 60)));
    }

    @Test
    void rotationRemindsThirtyMinutesIntoATripWithTwoDrivers() {
        assertEquals(List.of(transition("OPENED", 60, 0, 3)),
                run("double-driver-rotation", onTrip(0, null, true, 29), onTrip(60, null, true, 31),
                        onTrip(600, null, true, 40)));
        assertEquals(List.of(), run("double-driver-rotation", onTrip(0, null, false, 31)), "one driver");
    }

    @Test
    void rotationRemindsAgainFiveHoursAfterTheOperatorCloseEvenWhenAHoldFinishes() {
        SymptomSpec spec = SeedTemplates.get("double-driver-rotation").spec();
        UUID id = UUID.randomUUID();
        CompiledSymptom symptom = CompiledSymptom.compile(id, "1.0.0", SymptomState.TEST, spec, GPS);
        InMemoryEpisodeStore store = new InMemoryEpisodeStore();
        SignalEvaluator evaluator = new SignalEvaluator(store);
        List<String> out = new ArrayList<>();
        int closeAt = 900;
        for (int at = 0; at <= 20_000; at += 300) {
            if (at == closeAt) {
                // What the treatment API does when the operator closes the reminder's treatment.
                store.save("tenant", Episode.closedOnTrip(id, "vehicle", "T-1", EvalTraces.T0.plusSeconds(at)));
            }
            if (at == 1200) {
                evaluator.finishHold("tenant", "vehicle", EvalTraces.T0.plusSeconds(at), List.of(symptom));
            }
            Signal s = onTrip(at, null, true, 30 + at / 60.0);
            evaluator.evaluate("tenant", "vehicle", EvalTraces.T0.plusSeconds(at), s.root(), List.of(symptom))
                    .transitions().forEach(t -> out.add(t.kind() + "@" + s.at()));
        }

        assertEquals(List.of("OPENED@0", "OPENED@18900"), out, "5 h after the close at 900 s");
    }
}
