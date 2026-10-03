package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Lifecycle;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Recurrence;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Response;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.SpecDiff.Change;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;

/** Escalation, consequence management, level down and the recurrence entity. */
class SpecFieldsTest {

    private static SymptomSpec withLevel4(SymptomSpec s, Response response) {
        List<Level> levels = new ArrayList<>(s.levels());
        Level l4 = levels.get(3);
        levels.set(3, new Level(l4.icu(), l4.applies(), l4.when(), response));
        return Specs.withLevels(s, levels);
    }

    private static SymptomSpec with(SymptomSpec s, Lifecycle lifecycle, Recurrence recurrence) {
        return new SymptomSpec(s.source(), s.activation(), s.measure(), s.levels(), lifecycle, recurrence);
    }

    @Test
    void escalationAndConsequenceArePatchChangesOfTheResponse() {
        SymptomSpec base = Specs.speeding();
        Response r = base.levels().get(3).response();
        SymptomSpec escalated = withLevel4(base, new Response(r.operator(), r.slaMinutes(), r.steps(), r.notices(),
                r.evidence(), r.ignorable(), "Jefe de torre", true));
        List<Change> changes = SpecDiff.changes(base, escalated);
        assertEquals(VersionBump.PATCH, SpecDiff.bump(changes));
        assertEquals(List.of("response"), changes.stream().map(Change::section).toList());
    }

    @Test
    void levelDownIsAMinorLifecycleChange() {
        SymptomSpec base = Specs.speeding();
        Lifecycle l = base.lifecycle();
        List<Change> changes = SpecDiff.changes(base, with(base, new Lifecycle(l.open(), l.close(), true), null));
        assertEquals(VersionBump.MINOR, SpecDiff.bump(changes));
        assertEquals(List.of("lifecycle"), changes.stream().map(Change::section).toList());
    }

    @Test
    void aRecurrenceWithoutEntityCountsPerVehicle() {
        SymptomSpec base = Specs.speeding();
        SymptomSpec old = with(base, base.lifecycle(), new Recurrence(true, 20, 7, 1, null));
        SymptomSpec perVehicle = with(base, base.lifecycle(), new Recurrence(true, 20, 7, 1));
        SymptomSpec perDriver = with(base, base.lifecycle(), new Recurrence(true, 20, 7, 1, Recurrence.DRIVER));
        assertTrue(SpecDiff.changes(old, perVehicle).isEmpty());
        assertEquals(VersionBump.MINOR, SpecDiff.bump(SpecDiff.changes(perVehicle, perDriver)));
    }

    @Test
    void aRecurrenceMustCountSomethingSensible() {
        SymptomSpec base = Specs.speeding();
        assertTrue(errors(with(base, base.lifecycle(), new Recurrence(true, 20, 7, 1, "camión"))));
        assertTrue(errors(with(base, base.lifecycle(), new Recurrence(true, 1, 7, 1))));
        assertTrue(errors(with(base, base.lifecycle(), new Recurrence(true, 20, 0, 1))));
        assertFalse(errors(with(base, base.lifecycle(), new Recurrence(true, 20, 7, 1, Recurrence.DRIVER))));
        assertFalse(errors(with(base, base.lifecycle(), new Recurrence(false, 0, 0, 0, "x"))), "off: not checked");
    }

    private static boolean errors(SymptomSpec spec) {
        return SpecValidator.validate(spec, Specs.gpsSignal()).findings().stream()
                .anyMatch(f -> f.section().equals("recurrence"));
    }

    @Test
    void specsSavedBeforeTheseFieldsReadWithDefaults() throws Exception {
        String json = """
                {"source":"gps_signal","activation":"signal.trip.active",
                 "levels":[{"icu":4,"applies":true,"when":"true",
                   "response":{"operator":true,"slaMinutes":5,"steps":[],"notices":[],"evidence":[],"ignorable":false}}],
                 "lifecycle":{"open":"caso.condicion_s >= 0","close":"caso.normal_s >= 120"},
                 "recurrence":{"enabled":true,"count":20,"days":7,"raiseLevels":1}}""";
        SymptomSpec spec = new ObjectMapper().readValue(json, SymptomSpec.class);
        assertNull(spec.levels().get(0).response().escalateTo());
        assertFalse(spec.levels().get(0).response().consequence());
        assertFalse(spec.lifecycle().levelDown());
        assertNull(spec.recurrence().entity(), "read as per vehicle");
    }
}
