package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Level;
import com.microboxlabs.miot.symptoms.catalog.domain.VersionBump;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Report;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Severity;
import java.util.List;
import org.junit.jupiter.api.Test;

class SpecRulesTest {

    @Test
    void bumpFollowsWhatChanged() {
        SymptomSpec base = Specs.speeding();

        assertNull(SpecDiff.bump(SpecDiff.changes(base, Specs.speeding())));
        assertEquals(VersionBump.MAJOR, SpecDiff.bump(SpecDiff.changes(base,
                Specs.with(base, Specs.ACTIVATION + " && signal.gps.speed_kmh > 10"))));
        assertNull(SpecDiff.bump(SpecDiff.changes(base, Specs.with(base, "  " + Specs.ACTIVATION.replace(" && ",
                "\n && ")))), "whitespace is not a change");
        assertNull(SpecDiff.bump(SpecDiff.changes(base, Specs.with(base, Specs.ACTIVATION.replace(" && ", "&&")))),
                "neither is spacing around operators");
        SymptomSpec zone = Specs.with(base, "signal.geo.zone == \"North Yard\"");
        assertEquals(VersionBump.MAJOR, SpecDiff.bump(SpecDiff.changes(zone,
                Specs.with(base, "signal.geo.zone == \"North  Yard\""))), "spaces inside a string are a change");

        List<Level> raised = Specs.levels("medida > 0 && medida < 5", "medida >= 5 && medida < 11",
                "medida >= 11 && medida < 25", "medida >= 25 && sostenido_s >= 60");
        assertEquals(VersionBump.MINOR, SpecDiff.bump(SpecDiff.changes(base, Specs.withLevels(base, raised))));

        List<Level> newSla = List.of(base.levels().get(0), base.levels().get(1), base.levels().get(2),
                new Level(4, true, base.levels().get(3).when(), Specs.response(true, 1)));
        List<SpecDiff.Change> changes = SpecDiff.changes(base, Specs.withLevels(base, newSla));
        assertEquals(VersionBump.PATCH, SpecDiff.bump(changes));
        assertEquals("Cambió la respuesta de Código negro", changes.get(0).text());
    }

    @Test
    void versionNumbersFollowSemver() {
        assertEquals("1.0.0", SpecDiff.next(null, VersionBump.PATCH));
        assertEquals("3.0.0", SpecDiff.next("2.1.4", VersionBump.MAJOR));
        assertEquals("2.2.0", SpecDiff.next("2.1.4", VersionBump.MINOR));
        assertEquals("2.1.5", SpecDiff.next("2.1.4", VersionBump.PATCH));
    }

    @Test
    void theReportSerializesItsVerdicts() throws Exception {
        String json = new ObjectMapper().writeValueAsString(SpecValidator.validate(Specs.speeding(), Specs.gpsSignal()));

        assertTrue(json.contains("\"publishable\":true"), json);
        assertTrue(json.contains("\"needsTestOnly\":false"), json);
    }

    @Test
    void theSpeedingSymptomIsPublishable() {
        Report report = SpecValidator.validate(Specs.speeding(), Specs.gpsSignal());

        assertTrue(report.publishable(), () -> report.findings().toString());
        assertFalse(report.needsTestOnly());
    }

    @Test
    void overlappingLevelsAreAnError() {
        SymptomSpec overlap = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida >= 11", "medida >= 21 && sostenido_s >= 60"));

        Report report = SpecValidator.validate(overlap, Specs.gpsSignal());

        assertFalse(report.publishable());
        assertEquals("Crítica y Código negro se solapan: con medida 21 y 60 s sostenidos se cumplen los dos.",
                report.findings().get(0).message());
    }

    @Test
    void overlapsAreFoundBeyondAnyFixedRange() {
        SymptomSpec high = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida > 500", "medida > 500"));

        assertFalse(SpecValidator.validate(high, Specs.gpsSignal()).publishable());
    }

    @Test
    void levelRulesCountForEngineSupportButStringsDoNot() {
        SymptomSpec levelField = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida >= 11 && medida < 21",
                "medida >= 21 && signal.derived.speed_avg_5m > 90.0"));
        assertTrue(SpecValidator.validate(levelField, Specs.gpsSignal()).needsTestOnly());

        SymptomSpec inText = Specs.with(Specs.speeding(),
                Specs.ACTIVATION + " && signal.vehicle.weight_category != \"signal.derived.speed_avg_5m\"");
        assertFalse(SpecValidator.validate(inText, Specs.gpsSignal()).needsTestOnly());
    }

    @Test
    void duplicatedConditionsAndBadRulesAreErrors() {
        Report dup = SpecValidator.validate(Specs.with(Specs.speeding(),
                "signal.trip.active && signal.trip.active"), Specs.gpsSignal());
        assertEquals("La condición «signal.trip.active» está repetida.", dup.findings().get(0).message());

        Report typo = SpecValidator.validate(Specs.with(Specs.speeding(), "signal.trip.activo"), Specs.gpsSignal());
        assertEquals("activation", typo.findings().get(0).section());
        assertEquals(Severity.ERROR, typo.findings().get(0).severity());
    }

    @Test
    void fieldsTheEngineCannotEvaluateAllowOnlyTesting() {
        Report report = SpecValidator.validate(Specs.with(Specs.speeding(),
                Specs.ACTIVATION + " && signal.derived.speed_avg_5m > 80"), Specs.gpsSignal());

        assertTrue(report.publishable());
        assertTrue(report.needsTestOnly());
    }

    @Test
    void operatorLevelsNeedAnSla() {
        SymptomSpec noSla = Specs.withLevels(Specs.speeding(), List.of(
                new Level(1, false, null, null), new Level(2, false, null, null), new Level(3, false, null, null),
                new Level(4, true, "medida >= 21", Specs.response(true, null))));

        assertEquals("Si interviene un operador, el nivel necesita un SLA.",
                SpecValidator.validate(noSla, Specs.gpsSignal()).findings().get(0).message());
    }

    @Test
    void stepsNeedWhomToContactAndMinutes() {
        SymptomSpec.Response withSteps = new SymptomSpec.Response(true, 5, List.of(
                new SymptomSpec.Step("Conductor", "call", 2, null),
                new SymptomSpec.Step(" ", "call", 0, "Hola")), List.of(), List.of(), true);
        SymptomSpec spec = Specs.withLevels(Specs.speeding(), List.of(
                new Level(1, false, null, null), new Level(2, false, null, null), new Level(3, false, null, null),
                new Level(4, true, "medida >= 21", withSteps)));

        List<String> messages = SpecValidator.validate(spec, Specs.gpsSignal()).findings().stream()
                .map(SpecValidator.Finding::message).toList();

        assertEquals(List.of("El paso 2 no dice a quién contactar.", "El paso 2 necesita minutos."), messages);
    }

    @Test
    void topLevelTermsIgnoreNestingAndStrings() {
        assertEquals(List.of("a", "b || c", "d == \"x && y\""),
                SpecValidator.topLevelTerms("a && (b || c) && d == \"x && y\""));
    }
}
