package com.microboxlabs.miot.symptoms.evaluator.evals;

import static com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.transition;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.catalog.domain.DataSource;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomState;
import com.microboxlabs.miot.symptoms.catalog.service.SeedTemplates;
import com.microboxlabs.miot.symptoms.evaluator.CompiledSymptom;
import com.microboxlabs.miot.symptoms.evaluator.InMemoryEpisodeStore;
import com.microboxlabs.miot.symptoms.evaluator.SignalEvaluator;
import com.microboxlabs.miot.symptoms.evaluator.evals.EvalTraces.Signal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * The platform's event templates (V0.12.17) on frames that carry device or driver-app events. The levels follow the
 * GPS database's event rules: the time between the first and the latest event of the case, plus the event's
 * severity for camera fatigue.
 */
class EventTemplatesRuleCasesTest {

    private static final DataSource GPS = EvalTraces.source("gps_signal");

    /** A frame on or off a trip; {@code type} is the frame's one event, or null for none. */
    private static Signal frame(int at, boolean onTrip, String type, String severity) {
        return frame(at, onTrip, type, severity, "");
    }

    private static Signal frame(int at, boolean onTrip, String type, String severity, String code) {
        List<Map<String, Object>> events = type == null ? List.of()
                : List.of(Map.of("event_type", type, "severity", severity, "description", "", "timestamp", "",
                        "code", code));
        Map<String, Object> signal = new LinkedHashMap<>();
        signal.put("trip", Map.of("active", onTrip));
        signal.put("frame", Map.of("events", events));
        return new Signal(at, Map.of("signal", signal));
    }

    private static Signal event(int at, boolean onTrip, String type) {
        return frame(at, onTrip, type, "");
    }

    private static Signal quiet(int at, boolean onTrip) {
        return frame(at, onTrip, null, null);
    }

    private static List<String> run(String template, Signal... signals) {
        return EvalTraces.replay(SeedTemplates.get(template).spec(), GPS, List.of(signals));
    }

    @Test
    void fatigueSensorRisesEachTimeTheEventRepeatsAndClosesWhenTheTripEnds() {
        assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("LEVEL_CHANGED", 400, 1, 2),
                        transition("LEVEL_CHANGED", 1000, 2, 3), transition("LEVEL_CHANGED", 1900, 3, 4),
                        transition("CLOSED", 2500, 4, 4)),
                run("driver-fatigue-sensor", event(0, true, "FYSS"), quiet(30, true), event(400, true, "FYSS"),
                        quiet(500, true), event(1000, true, "FYSS"), event(1900, true, "FYSS"), quiet(2400, true),
                        quiet(2500, false)));
    }

    @Test
    void fatigueSensorWithoutRepeatsStaysAtLevelOneAndOffATripOpensNothing() {
        assertEquals(List.of(transition("OPENED", 0, 0, 1)),
                run("driver-fatigue-sensor", event(0, true, "FYSS"), quiet(3600, true)));
        assertEquals(List.of(), run("driver-fatigue-sensor", event(0, false, "FYSS")));
        assertEquals(List.of(), run("driver-fatigue-sensor", event(0, true, "FYS")), "another event type");
    }

    @Test
    void cameraFatigueOpensByTheEventsSeverity() {
        assertEquals(List.of(transition("OPENED", 0, 0, 4)),
                run("driver-fatigue", frame(0, true, "FYS", "high")));
        assertEquals(List.of(transition("OPENED", 0, 0, 2)),
                run("driver-fatigue", frame(0, true, "FYS", "medium")));
        assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("LEVEL_CHANGED", 650, 1, 3),
                        transition("LEVEL_CHANGED", 950, 3, 4)),
                run("driver-fatigue", frame(0, true, "FYS", "low"), quiet(60, true), frame(650, true, "FYS", "low"),
                        frame(950, true, "FYS", "low")));
    }

    @Test
    void cameraFatigueOpensByTheCameraCodeAsTheGpsDatabaseFunction() {
        for (String code : List.of("109", "112", "115")) {
            assertEquals(List.of(transition("OPENED", 0, 0, 4)),
                    run("driver-fatigue", frame(0, true, "FYS", "", code)), code);
        }
        assertEquals(List.of(transition("OPENED", 0, 0, 2)), run("driver-fatigue", frame(0, true, "FYS", "", "105")));
        assertEquals(List.of(transition("OPENED", 0, 0, 1)), run("driver-fatigue", frame(0, true, "FYS", "", "111")));
        assertEquals(List.of(), run("driver-fatigue", frame(0, false, "FYS", "", "109")), "off a trip");
    }

    @Test
    void loadSecuringSkipsLevelTwoAndClosesAfterTwentyMinutesOffATrip() {
        assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("LEVEL_CHANGED", 130, 1, 3),
                        transition("LEVEL_CHANGED", 160, 3, 4), transition("CLOSED", 1400, 4, 4)),
                run("load-securing-absence", event(0, false, "AAS"), event(100, false, "AAS"),
                        event(130, false, "AAS"), event(160, false, "AAS"), quiet(200, false), quiet(1400, false)));
    }

    @Test
    void loadSecuringOnATripStaysOpenForTheOperator() {
        assertEquals(List.of(transition("OPENED", 0, 0, 1)),
                run("load-securing-absence", event(0, true, "AAS"), quiet(60, true), quiet(7200, true)));
    }

    @Test
    void cargoCasesWaitForTwentyQuietMinutesOffATripAndRestartWhenATripResumes() {
        for (var template : Map.of("load-securing-absence", "AAS", "stake-side-usage", "ABR").entrySet()) {
            assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("CLOSED", 6400, 1, 1)),
                    run(template.getKey(), event(0, true, template.getValue()), quiet(60, true),
                            quiet(3600, false), quiet(4700, false), quiet(4800, true),
                            quiet(5200, false), quiet(6399, false), quiet(6400, false)));
            assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("CLOSED", 1201, 1, 1)),
                    run(template.getKey(), event(0, false, template.getValue()), quiet(1, false),
                            quiet(1200, false), quiet(1201, false)));
        }
    }

    @Test
    void cargoCasesCloseAfterTheTenantLeavesTheSignalClients() {
        for (var template : Map.of("load-securing-absence", "AAS", "stake-side-usage", "ABR").entrySet()) {
            var symptom = CompiledSymptom.compile(UUID.randomUUID(), "1.0.0", SymptomState.TEST,
                    SeedTemplates.get(template.getKey()).spec(), GPS);
            var evaluator = new SignalEvaluator(new InMemoryEpisodeStore());
            assertEquals(1, evaluator.evaluate("tenant-a", "DEMO", EvalTraces.T0,
                    event(0, true, template.getValue()).root(), List.of(symptom)).transitions().size());
            Map<String, Object> minimal = Map.of("signal", Map.of("trip", Map.of("active", false)));
            assertEquals(List.of(), evaluator.reconcile("tenant-a", "DEMO", EvalTraces.T0.plusSeconds(3600),
                    minimal, List.of(symptom)).transitions());
            var closed = evaluator.reconcile("tenant-a", "DEMO", EvalTraces.T0.plusSeconds(4800),
                    minimal, List.of(symptom));
            assertEquals(List.of(), closed.errors());
            assertEquals(List.of("CLOSED"), closed.transitions().stream().map(t -> t.kind().name()).toList());
        }
    }

    @Test
    void stakeSideUsageHasTheSameLadder() {
        assertEquals(List.of(transition("OPENED", 0, 0, 1), transition("LEVEL_CHANGED", 150, 1, 4)),
                run("stake-side-usage", event(0, true, "ABR"), event(150, true, "ABR")));
    }

    @Test
    void roadAssistanceOpensAtLevelThreeAndOnlyTheOperatorCloses() {
        assertEquals(List.of(transition("OPENED", 0, 0, 3)),
                run("road-assistance", event(0, false, "Asistencia en ruta"), quiet(60, false),
                        quiet(86_400, false)));
    }

    @Test
    void panicOpensOnTheDriverAppEmergencyToo() {
        assertEquals(List.of(transition("OPENED", 0, 0, 4)),
                run("panic-button", event(0, false, "Emergencia"), quiet(60, false)));
        Map<String, Object> flat = new LinkedHashMap<>();
        flat.put("signal.frame.sensors.panic_button", true);
        flat.put("signal.frame.events", List.of());
        assertEquals(List.of(transition("OPENED", 0, 0, 4)),
                run("panic-button", new Signal(0, EvalTraces.root(flat))), "the GPS button still opens it");
    }
}
