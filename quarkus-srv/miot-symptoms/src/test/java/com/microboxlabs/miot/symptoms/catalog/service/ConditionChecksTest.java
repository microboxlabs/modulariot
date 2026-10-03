package com.microboxlabs.miot.symptoms.catalog.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Finding;
import com.microboxlabs.miot.symptoms.catalog.service.SpecValidator.Severity;
import java.util.List;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class ConditionChecksTest {

    private static List<String> messages(String rule) {
        return ConditionChecks.check(rule, path -> path).stream()
                .map(f -> f.severity() + " " + f.message())
                .toList();
    }

    @Test
    void conditionsThatCanNeverHoldTogetherAreErrors() {
        assertEquals(List.of("ERROR «signal.trip.active» no puede ser verdadero y falso a la vez; nunca se cumpliría."),
                messages("signal.trip.active && !signal.trip.active"));
        assertEquals(List.of("ERROR «signal.trip.active» no puede ser verdadero y falso a la vez; nunca se cumpliría."),
                messages("signal.trip.active == true && signal.trip.active == false"));
        assertEquals(List.of("ERROR «signal.geo.zone» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("signal.geo.zone == \"A\" && signal.geo.zone == \"B\""));
        assertEquals(List.of("ERROR «signal.geo.zone» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("signal.geo.zone == \"A\" && signal.geo.zone != \"A\""));
        assertEquals(List.of("ERROR «signal.gps.speed_kmh» mayor que 90 y menor que 80 nunca se cumple."),
                messages("signal.gps.speed_kmh > 90 && signal.gps.speed_kmh < 80"));
        assertEquals(List.of("ERROR «signal.gps.speed_kmh» mayor que 80 y menor que 80 nunca se cumple."),
                messages("signal.gps.speed_kmh >= 80 && signal.gps.speed_kmh < 80"));
    }

    @Test
    void boundsThatHoldOrJustRepeatAreFineOrWarnings() {
        assertTrue(messages("signal.gps.speed_kmh >= 80 && signal.gps.speed_kmh <= 80").isEmpty(), "exactly 80");
        assertTrue(messages("signal.gps.speed_kmh > 80 && signal.gps.speed_kmh < 120").isEmpty());
        assertEquals(List.of("WARNING Dos mínimos para «signal.gps.speed_kmh»; basta el mayor (90)."),
                messages("signal.gps.speed_kmh > 80 && signal.gps.speed_kmh > 90"));
        assertEquals(List.of("WARNING Dos máximos para «signal.gps.speed_kmh»; basta el menor (80)."),
                messages("signal.gps.speed_kmh < 80 && signal.gps.speed_kmh <= 100"));
    }

    @Test
    void parenthesesAroundAndGroupsAreIgnored() {
        assertEquals(List.of("ERROR «x» no puede ser verdadero y falso a la vez; nunca se cumpliría."),
                messages("(x && !x)"));
        assertEquals(List.of("ERROR «x» no puede ser verdadero y falso a la vez; nunca se cumpliría."),
                messages("y && ((x) && (z && !x))"));
        assertEquals(Optional.of(List.of("a", "b", "c")), ConditionChecks.conjunction("(a && b) && c"));
        assertEquals(Optional.of(List.of(SpecDiff.squash("a || b"), "c")),
                ConditionChecks.conjunction("((a || b)) && c"), "an || group stays one condition");
        assertEquals(1, ConditionChecks.conjunction("((a) || (b))").orElseThrow().size());
    }

    @Test
    void conditionsInAnotherOrderAreTheSameRule() {
        String rule = "a > 1 && (b == \"x\" || c) && !(d || e)";
        String same = ConditionChecks.unordered(rule);
        assertEquals(same, ConditionChecks.unordered("!(e || d) && (c || b == \"x\") && a > 1"));
        assertEquals(same, ConditionChecks.unordered("(a > 1 && ((c) || b == \"x\")) && !((e) || d)"));
        assertEquals(ConditionChecks.unordered("a || b || c"), ConditionChecks.unordered("c || (b || a)"));

        assertNotEquals(same, ConditionChecks.unordered("a > 1 && (b == \"x\" && c) && !(d || e)"),
                "&& instead of || in a group");
        assertNotEquals(same, ConditionChecks.unordered("a > 1 && (b == \"x\" || c) && (d || e)"),
                "the exception dropped its !");
        assertNotEquals(ConditionChecks.unordered("a || b && c"), ConditionChecks.unordered("c && b || a"),
                "mixed joins at one level keep their order");
        assertNotEquals(ConditionChecks.unordered("a == \"x && y\" && b"),
                ConditionChecks.unordered("a == \"y && x\" && b"), "text inside quotes is not split");
        assertEquals(SpecDiff.squash(null), ConditionChecks.unordered(null));
    }

    @Test
    void numbersCompareByValue() {
        assertTrue(messages("v == 1 && v == 1.0").isEmpty());
        assertEquals(List.of("ERROR «v» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("v == 1 && v != 1.00"));
        assertEquals(List.of("ERROR «v» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("v == 1 && v == 2.5"));
    }

    @Test
    void anEqualityOutsideTheBoundsIsAnError() {
        assertEquals(List.of("ERROR «v» igual a 80 queda fuera de sus otros límites; nunca se cumpliría."),
                messages("v == 80 && v > 90"));
        assertEquals(List.of("ERROR «v» igual a 80 queda fuera de sus otros límites; nunca se cumpliría."),
                messages("v == 80 && v < 80"));
        assertTrue(messages("v == 80 && v >= 80 && v <= 80").isEmpty());
        assertTrue(messages("v == 80 && v > 70 && v < 90").isEmpty());
        assertEquals(List.of("ERROR «v» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("v == \"A\" && v == \"B\" && v > 3"), "one error per field");
    }

    @Test
    void aComparisonWithAnotherFieldIsNotABound() {
        assertTrue(messages("v > w.limit && v < 3 && v == other").isEmpty());
        assertTrue(messages("v == 1.2.3 && v == 4").isEmpty(), "not a number");
    }

    @Test
    void anExceptionIsReadAsTheOppositeOfEachOfItsConditions() {
        assertEquals(List.of("ERROR «x» no puede ser verdadero y falso a la vez; nunca se cumpliría."),
                messages("x && !(x)"));
        assertEquals(List.of("ERROR «x» no puede ser verdadero y falso a la vez; nunca se cumpliría."),
                messages("x && !(y || x)"));
        assertEquals(List.of("ERROR «z» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("z == \"A\" && !(z == \"A\")"));
        assertEquals(List.of("ERROR «v» mayor que 90 y menor que 80 nunca se cumple."),
                messages("v > 90 && !(v >= 80)"));
        assertTrue(messages("x && !(y || z == \"A\")").isEmpty());
        assertTrue(messages("x && !(x && y)").isEmpty(), "not all of them: the form never writes this");
        assertTrue(messages("x && !(v > w)").isEmpty(), "field against field is left alone");
    }

    @Test
    void escapedAndPlainSpellingsOfAValueAreTheSameValue() {
        assertTrue(messages("z == \"\\u0041\" && !(z != \"A\")").isEmpty());
        assertTrue(messages("z == \"\\u0041\" && z == \"A\"").isEmpty());
        assertEquals(List.of("ERROR «z» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("z == \"\\u0041\" && !(z == \"A\")"));
    }

    @Test
    void quotesInsideValuesDoNotSplitTheRule() {
        assertEquals(Optional.of(List.of("z==\"a\\\" && b\"", "x")),
                ConditionChecks.conjunction("z == \"a\\\" && b\" && x"));
        assertEquals(List.of("ERROR «z» no puede tener dos valores a la vez; nunca se cumpliría."),
                messages("z == \"a\\\"b\" && !(z == \"a\\\"b\")"));
    }

    @Test
    void aListFieldComparedWithAValueItDoesNotTakeIsAWarning() {
        SymptomSpec typo = Specs.with(Specs.speeding(),
                Specs.ACTIVATION + " && signal.vehicle.weight_category == \"HEAVVY\"");
        assertTrue(SpecValidator.validate(typo, Specs.gpsSignal()).findings().stream()
                .anyMatch(f -> f.severity() == Severity.WARNING && f.message().equals(
                        "«Categoría de peso» no toma el valor «HEAVVY»; sus valores son HEAVY, LIGHT.")));
        SymptomSpec known = Specs.with(Specs.speeding(),
                Specs.ACTIVATION + " && signal.vehicle.weight_category != \"LIGHT\"");
        assertTrue(SpecValidator.validate(known, Specs.gpsSignal()).findings().stream()
                .noneMatch(f -> f.message().contains("no toma el valor")));
    }

    @Test
    void unknownValuesAreFoundAnywhereInTheRule() {
        for (String rule : new String[] {
                "signal.vehicle.weight_category == \"HEAVVY\" || signal.trip.active",
                "signal.trip.active && !(signal.vehicle.weight_category == \"HEAVVY\")",
                "\"HEAVVY\" == signal.vehicle.weight_category && signal.trip.active",
                "signal.trip.active && signal.vehicle.weight_category in [\"LIGHT\", \"HEAVVY\"]",
                "signal.trip.active && (signal.vehicle.weight_category == \"HEAVVY\""
                        + " || signal.vehicle.weight_category == \"HEAVVY\")" }) {
            List<String> warnings = SpecValidator.validate(Specs.with(Specs.speeding(), rule), Specs.gpsSignal())
                    .findings().stream()
                    .map(Finding::message)
                    .filter(m -> m.contains("no toma el valor"))
                    .toList();
            assertEquals(List.of("«Categoría de peso» no toma el valor «HEAVVY»; sus valores son HEAVY, LIGHT."),
                    warnings, rule);
        }
        SymptomSpec escaped = Specs.with(Specs.speeding(),
                Specs.ACTIVATION + " && signal.vehicle.weight_category == \"HEA\\\"VY\"");
        assertTrue(SpecValidator.validate(escaped, Specs.gpsSignal()).findings().stream()
                .anyMatch(f -> f.message().contains("«HEA\"VY»")), "the value is read unescaped");
    }

    @Test
    void thePlatformGpsSourceListsTheWeightCategories() {
        var weight = DataSourceService.read().stream()
                .filter(s -> s.key().equals("gps_signal"))
                .flatMap(s -> s.fields().stream())
                .filter(f -> f.path().equals("signal.vehicle.weight_category"))
                .findFirst().orElseThrow();
        assertEquals(List.of("HEAVY", "LIGHT"), weight.values().stream().map(v -> v.value()).toList());
    }

    @Test
    void anOrderOnATextIsLeftToTheTypeCheck() {
        assertTrue(messages("signal.geo.zone > \"A\" && signal.geo.zone < \"B\"").isEmpty());
        SymptomSpec spec = Specs.with(Specs.speeding(), Specs.ACTIVATION + " && signal.trip.active > \"A\"");
        assertTrue(SpecValidator.validate(spec, Specs.gpsSignal()).findings().stream()
                .anyMatch(f -> f.severity() == Severity.ERROR && f.section().equals("activation")));
    }

    @Test
    void rulesWithOrAtTheTopAreLeftAlone() {
        assertTrue(messages("signal.trip.active || !signal.trip.active").isEmpty());
        assertTrue(messages("(signal.trip.active || x) && !signal.trip.active").isEmpty(), "the || is nested");
        assertEquals(Optional.empty(), ConditionChecks.conjunction("a || b"));
        assertEquals(Optional.of(List.of("a", "b == \"x && y\"")), ConditionChecks.conjunction("a && b == \"x && y\""));
    }

    @Test
    void theValidatorUsesTheSourceLabels() {
        SymptomSpec spec = Specs.with(Specs.speeding(), Specs.ACTIVATION + " && !signal.trip.active");
        List<Finding> found = SpecValidator.validate(spec, Specs.gpsSignal()).findings();
        assertTrue(found.stream().anyMatch(f -> f.severity() == Severity.ERROR
                && f.message().equals("«En viaje» no puede ser verdadero y falso a la vez; nunca se cumpliría.")));
    }

    @Test
    void gapsBetweenLevelsAreWarnings() {
        SymptomSpec gap = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida >= 5 && medida < 11", "medida >= 15 && medida < 21", "medida >= 21 && sostenido_s >= 60"));
        assertEquals(List.of("Entre 11 y 15 ningún nivel aplica."), levelWarnings(gap));
        assertTrue(levelWarnings(Specs.speeding()).isEmpty(), "the speeding ladder has no gap");

        SymptomSpec byTime = Specs.withLevels(Specs.speeding(), List.of(
                new SymptomSpec.Level(1, true, "sostenido_s < 600", Specs.response(false, null)),
                new SymptomSpec.Level(2, true, "sostenido_s >= 900", Specs.response(false, null)),
                new SymptomSpec.Level(3, false, null, null),
                new SymptomSpec.Level(4, false, null, null)));
        assertEquals(List.of("Entre 600 y 900 s sostenidos ningún nivel aplica."), levelWarnings(byTime));
    }

    @Test
    void gapsAreReportedAtTheRuleNumbers() {
        SymptomSpec open = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida > 10 && medida < 21", "medida >= 21 && medida < 30", "medida >= 30 && sostenido_s >= 60"));
        assertEquals(List.of("Entre 5 y 10 ningún nivel aplica."), levelWarnings(open));
        SymptomSpec point = Specs.withLevels(Specs.speeding(), Specs.levels("medida > 0 && medida < 5",
                "medida > 5 && medida < 21", "medida >= 21 && medida < 30", "medida >= 30 && sostenido_s >= 60"));
        assertEquals(List.of("Con 5 exactos ningún nivel aplica."), levelWarnings(point));
    }

    private static List<String> levelWarnings(SymptomSpec spec) {
        return SpecValidator.validate(spec, Specs.gpsSignal()).findings().stream()
                .filter(f -> f.section().equals("levels") && f.severity() == Severity.WARNING)
                .map(Finding::message)
                .toList();
    }
}
