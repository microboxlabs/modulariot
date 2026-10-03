package com.microboxlabs.miot.symptoms.catalog.cel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.Expect;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RuleLanguageTest {

    private static final RuleSchema SIGNAL = new RuleSchema("signal", Map.of(
            "signal.trip.active", "bool",
            "signal.vehicle.weight_category", "list",
            "signal.gps.speed_kmh", "number",
            "signal.road.maxspeed_osm", "number",
            "signal.geo.zone", "zone"), Map.of());

    private static final Map<String, Object> SAMPLE = Map.of("signal", Map.of(
            "trip", Map.of("active", true),
            "vehicle", Map.of("weight_category", "HEAVY"),
            "gps", Map.of("speed_kmh", 112.0),
            "road", Map.of("maxspeed_osm", 90.0),
            "geo", Map.of("zone", "Ruta 5")));

    @Test
    void stringLiteralsAreDecoded() {
        assertEquals("A", RuleText.stringLiteral("\"\\u0041\"").orElseThrow());
        assertEquals("a\"b", RuleText.stringLiteral("\"a\\\"b\"").orElseThrow());
        assertTrue(RuleText.stringLiteral("x").isEmpty());
        assertTrue(RuleText.stringLiteral("1").isEmpty());
    }

    @Test
    void canonicalTextIgnoresSpacingButKeepsEscapedQuotes() {
        assertEquals(RuleText.canonical("a  &&   b > 1"), RuleText.canonical("a && b > 1"));
        assertEquals("z==\"a\\\"b\"", RuleText.canonical(" z == \"a\\\"b\" "));
        String oneString = RuleText.canonical("z == \"a\\\" || z == \\\"b\"");
        String twoConditions = RuleText.canonical("z == \"a\" || z == \"b\"");
        assertFalse(oneString.equals(twoConditions), "one string with || inside is not two conditions");
        assertEquals(RuleText.canonical("z==\"a\\\"b\"&&x  in  [1]"),
                RuleText.canonical(" z == \"a\\\"b\" && x in [1] "), "spacing outside strings is not a change");
        assertEquals("z==\"a  \\\" b\"", RuleText.canonical("z == \"a  \\\" b\""), "spacing inside strings is kept");
        assertEquals("a in b", RuleText.spacing("a   in\n b"));
    }

    @Test
    void speedingActivationChecksAndRuns() {
        String rule = "signal.trip.active && signal.vehicle.weight_category == \"HEAVY\""
                + " && !(signal.geo.zone == \"Faena Norte\")";

        assertTrue(RuleLanguage.check(SIGNAL, rule, Expect.CONDITION).ok());
        assertEquals(true, RuleLanguage.evaluate(SIGNAL, rule, SAMPLE).value());
    }

    @Test
    void measureIsANumber() {
        String measure = "signal.gps.speed_kmh - signal.road.maxspeed_osm";

        assertTrue(RuleLanguage.check(SIGNAL, measure, Expect.NUMBER).ok());
        assertEquals(22.0, RuleLanguage.evaluate(SIGNAL, measure, SAMPLE).value());
        assertEquals("La condición debe dar sí o no.",
                RuleLanguage.check(SIGNAL, measure, Expect.CONDITION).issues().get(0).message());
    }

    @Test
    void wholeNumbersCompareWithDecimalFields() {
        assertTrue(RuleLanguage.check(SIGNAL, "signal.gps.speed_kmh > 90", Expect.CONDITION).ok());
    }

    @Test
    void levelConditionsReadTheMeasureAndHowLongItHeld() {
        RuleSchema level = SIGNAL.withExtras(RuleSchema.LEVEL_VARIABLES);
        String rule = "medida >= 21 && sostenido_s >= 60";

        assertTrue(RuleLanguage.check(level, rule, Expect.CONDITION).ok());
        assertEquals(true, RuleLanguage.evaluate(level, rule, Map.of("medida", 22.0, "sostenido_s", 75.0)).value());
        assertEquals(false, RuleLanguage.evaluate(level, rule, Map.of("medida", 22.0, "sostenido_s", 20.0)).value());
    }

    @Test
    void lifecycleReadsTheCase() {
        assertTrue(RuleLanguage.check(RuleSchema.CASE, "caso.normal_s >= 120 || caso.edad_h >= 12",
                Expect.CONDITION).ok());
    }

    @Test
    void samplesWithWholeNumbersRun() {
        Map<String, Object> ints = Map.of("signal", Map.of("gps", Map.of("speed_kmh", 112),
                "road", Map.of("maxspeed_osm", 90)));

        assertEquals(22.0, RuleLanguage.evaluate(SIGNAL, "signal.gps.speed_kmh - signal.road.maxspeed_osm", ints)
                .value());
    }

    @Test
    void similarPathsKeepTheirOwnTypes() {
        RuleSchema schema = new RuleSchema("signal", Map.of("signal.gps_speed", "number", "signal.gps.speed", "text"),
                Map.of());

        assertTrue(RuleLanguage.check(schema, "signal.gps_speed > 1", Expect.CONDITION).ok());
        assertTrue(RuleLanguage.check(schema, "signal.gps.speed == \"x\"", Expect.CONDITION).ok());
    }

    @Test
    void positionsCountEarlierLines() {
        String rule = "signal.trip.active\n&& signal.gps.speed > 1";

        assertEquals(rule.indexOf("speed >") - 1,
                RuleLanguage.check(SIGNAL, rule, Expect.CONDITION).issues().get(0).position());
    }

    @Test
    void problemsAreReportedInSpanishWithTheirPosition() {
        RuleCheck typeError = RuleLanguage.check(SIGNAL, "signal.vehicle.weight_category > 3", Expect.CONDITION);
        assertFalse(typeError.ok());
        assertEquals("No se puede usar «>» entre texto y número entero.", typeError.issues().get(0).message());

        RuleIssue unknown = RuleLanguage.check(SIGNAL, "signal.gps.speed > 1", Expect.CONDITION).issues().get(0);
        assertEquals("El campo «speed» no existe en esta fuente.", unknown.message());
        assertEquals(10, unknown.position());

        assertEquals("«foo» no existe en esta fuente.",
                RuleLanguage.check(SIGNAL, "foo > 1", Expect.CONDITION).issues().get(0).message());
        assertEquals("La expresión está incompleta.",
                RuleLanguage.check(SIGNAL, "signal.gps.speed_kmh >", Expect.CONDITION).issues().get(0).message());
        assertEquals("La expresión está vacía.",
                RuleLanguage.check(SIGNAL, " ", Expect.CONDITION).issues().get(0).message());
    }
}
