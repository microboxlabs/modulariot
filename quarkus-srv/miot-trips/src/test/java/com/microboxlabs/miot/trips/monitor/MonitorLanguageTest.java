package com.microboxlabs.miot.trips.monitor;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.monitor.MonitorLanguage.Expect;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MonitorLanguageTest {

    private static final Map<String, Object> PARAMS = Map.of("lateDepartureMinutes", 30, "closeOnArrival", true);
    private static final MonitorSchema SIGNAL = MonitorSchema.of("signal", PARAMS);
    private static final MonitorSchema TIMER = MonitorSchema.of("timer", PARAMS);

    private static final Instant START = Instant.parse("2026-10-24T08:00:00Z");

    private static Map<String, Object> context() {
        return Map.of(
                "trip", Map.of("status", "planned", "plannedStart", START,
                        "destination", Map.of("code", "CD-1")),
                "stage", Map.of("type", "preparation", "status", "in_progress"),
                "stages", Map.of("preparation", Map.of("status", "in_progress")),
                "mandates", List.of(Map.of("externalCode", "S-1", "status", "active")),
                "signal", Map.of("kind", "left_origin", "at", START.plusSeconds(600)),
                "event", Map.of("on", "signal", "at", START.plusSeconds(600)),
                "params", PARAMS,
                "plan", Map.of("source", Map.of("ESTADO", "Programado")),
                "milestones", Map.of("validation", Map.of("status", "pending",
                        "evidence", Map.of("documents", "ok", "seal", 4411))));
    }

    @Test
    void aRuleReadsTheMetadataASourceSentWithAMilestone() {
        String when = "milestones.validation.evidence.documents == 'ok' && milestones.validation.evidence.seal > 4000";
        assertTrue(MonitorLanguage.check(SIGNAL, when, Expect.CONDITION).ok());
        assertEquals(true, MonitorLanguage.evaluate(SIGNAL, when, context()).value());
    }

    @Test
    void aSignalRuleReadsTheStageAndTheSignal() {
        String when = "stage.type == 'preparation' && signal.kind == 'left_origin'";
        assertTrue(MonitorLanguage.check(SIGNAL, when, Expect.CONDITION).ok());
        assertEquals(true, MonitorLanguage.evaluate(SIGNAL, when, context()).value());
    }

    @Test
    void aTimerAddsMinutesFromAParameter() {
        String at = "trip.plannedStart + minutes(params.lateDepartureMinutes)";
        assertTrue(MonitorLanguage.check(TIMER, at, Expect.TIME).ok());
        assertEquals(START.plusSeconds(1800), MonitorLanguage.evaluate(TIMER, at, context()).value());
        assertTrue(MonitorLanguage.check(TIMER, "event.at > trip.plannedStart + hours(1.5)", Expect.CONDITION)
                .ok());
    }

    @Test
    void listsMapsAndFreeFormFieldsWork() {
        String when = "mandates.exists(m, m.externalCode == 'S-1') && stages.preparation.status == 'in_progress'"
                + " && plan.source.ESTADO == 'Programado' && params.closeOnArrival";
        assertTrue(MonitorLanguage.check(SIGNAL, when, Expect.CONDITION).ok());
        assertEquals(true, MonitorLanguage.evaluate(SIGNAL, when, context()).value());
    }

    @Test
    void anAbsentFieldIsTestedWithHas() {
        String when = "!has(trip.actualStart)";
        assertTrue(MonitorLanguage.check(SIGNAL, when, Expect.CONDITION).ok());
        assertEquals(true, MonitorLanguage.evaluate(SIGNAL, when, context()).value());
    }

    @Test
    void aValueTheTripDoesNotHaveYetIsAMissingValue() {
        MonitorLanguage.Result r = MonitorLanguage.evaluate(TIMER, "stage.type == 'preparation'",
                Map.of("stage", Map.of(), "trip", Map.of()));
        assertFalse(r.ok());
        assertTrue(MonitorLanguage.missingValue(r.error()), r.error());
        assertFalse(MonitorLanguage.missingValue("no such overload"));
    }

    @Test
    void unknownFieldsAndWrongTypesAreRejected() {
        MonitorLanguage.Check unknown = MonitorLanguage.check(SIGNAL, "trip.colour == 'red'", Expect.CONDITION);
        assertFalse(unknown.ok());
        assertEquals(4, unknown.issues().get(0).position());
        assertFalse(MonitorLanguage.check(SIGNAL, "trip.status", Expect.CONDITION).ok());
        assertFalse(MonitorLanguage.check(TIMER, "trip.status == 'planned'", Expect.TIME).ok());
        assertFalse(MonitorLanguage.check(TIMER, "signal.kind == 'x'", Expect.CONDITION).ok(),
                "a timer rule has no signal");
        assertFalse(MonitorLanguage.check(SIGNAL, "stages.boarding.status == 'x'", Expect.CONDITION).ok());
    }

    @Test
    void theSelectorReadsTheNewTrip() {
        String when = "trip.orderType == 'reparto' || mandates.exists(m, m.orderRef.startsWith('R'))";
        assertTrue(MonitorLanguage.check(MonitorSchema.selector(), when, Expect.CONDITION).ok());
        assertFalse(MonitorLanguage.check(MonitorSchema.selector(), "stage.type == 'transit'", Expect.CONDITION)
                .ok());
    }
}
