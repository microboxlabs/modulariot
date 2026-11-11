package com.microboxlabs.miot.symptoms.catalog.cel;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.symptoms.catalog.cel.RuleLanguage.Expect;
import java.util.Map;
import org.junit.jupiter.api.Test;

class RuleLanguageTest {

    private static final RuleSchema SIGNAL = new RuleSchema("signal", Map.of(
            "signal.trip.active", "bool",
            "signal.vehicle.weight_category", "list",
            "signal.frame.gps.speed", "number",
            "signal.road.maxspeed_osm", "number",
            "signal.geo.zone", "zone"), Map.of());

    private static final Map<String, Object> SAMPLE = Map.of("signal", Map.of(
            "trip", Map.of("active", true),
            "vehicle", Map.of("weight_category", "HEAVY"),
            "frame", Map.of("gps", Map.of("speed", 112.0)),
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
        assertNotEquals(twoConditions, oneString, "one string with || inside is not two conditions");
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
        String measure = "signal.frame.gps.speed - signal.road.maxspeed_osm";

        assertTrue(RuleLanguage.check(SIGNAL, measure, Expect.NUMBER).ok());
        assertEquals(22.0, RuleLanguage.evaluate(SIGNAL, measure, SAMPLE).value());
        assertEquals("La condición debe dar sí o no.",
                RuleLanguage.check(SIGNAL, measure, Expect.CONDITION).issues().get(0).message());
    }

    @Test
    void wholeNumbersCompareWithDecimalFields() {
        assertTrue(RuleLanguage.check(SIGNAL, "signal.frame.gps.speed > 90", Expect.CONDITION).ok());
    }

    @Test
    void levelConditionsReadTheMeasureAndHowLongItHeld() {
        RuleSchema level = SIGNAL.withExtras(RuleSchema.LEVEL_VARIABLES);
        String rule = "measure >= 21 && held_s >= 60";

        assertTrue(RuleLanguage.check(level, rule, Expect.CONDITION).ok());
        assertEquals(true, RuleLanguage.evaluate(level, rule, Map.of("measure", 22.0, "held_s", 75.0)).value());
        assertEquals(false, RuleLanguage.evaluate(level, rule, Map.of("measure", 22.0, "held_s", 20.0)).value());
    }

    @Test
    void numbersCompareForEqualityWithWholeNumbers() {
        RuleSchema level = SIGNAL.withExtras(RuleSchema.LEVEL_VARIABLES);

        assertTrue(RuleLanguage.check(level, "measure == 0", Expect.CONDITION).ok());
        assertEquals(true, RuleLanguage.evaluate(level, "measure == 0", Map.of("measure", 0.0)).value());
        assertEquals(true, RuleLanguage.evaluate(level, "-3 != measure", Map.of("measure", 0.0)).value());
        assertTrue(RuleLanguage.check(level, "size(\"ab == 1\") == 2", Expect.CONDITION).ok(),
                "a rule that compiles as written keeps its integers");
        String mixed = "size(\"ab\") == 2 && measure == 0";
        assertTrue(RuleLanguage.check(level, mixed, Expect.CONDITION).ok(),
                "only the comparison CEL rejected gets a double");
        assertEquals(true, RuleLanguage.evaluate(level, mixed, Map.of("measure", 0.0)).value());
    }

    @Test
    void aMeasureSubtractsADouble() {
        assertTrue(RuleLanguage.check(SIGNAL, "signal.frame.gps.speed - 90.0", Expect.NUMBER).ok());
        assertFalse(RuleLanguage.check(SIGNAL, "signal.frame.gps.speed - 90", Expect.NUMBER).ok(),
                "the app writes whole offsets as doubles");
    }

    @Test
    void variablesConvertedOnceReadAsTheRawOnesAndAreNotCopiedAgain() {
        Map<String, Object> raw = Map.of("signal", Map.of(
                "frame", Map.of("gps", Map.of("speed", 112), "events", java.util.List.of(Map.of("n", 3))),
                "trip", Map.of("active", true)));
        var rule = RuleLanguage.prepare(SIGNAL, "signal.frame.gps.speed > 100.0 && signal.trip.active");

        Map<String, Object> converted = RuleLanguage.converted(raw);

        assertEquals(rule.run(raw), rule.run(converted));
        assertEquals(true, rule.run(converted).value());
        org.junit.jupiter.api.Assertions.assertSame(converted, RuleLanguage.converted(converted), "converted values are kept as they are");
        @SuppressWarnings("unchecked")
        var frame = (Map<String, Object>) ((Map<String, Object>) converted.get("signal")).get("frame");
        assertEquals(Map.of("speed", 112.0), frame.get("gps"));
        assertEquals(java.util.List.of(Map.of("n", 3.0)), frame.get("events"));
        assertEquals(raw.keySet(), converted.keySet());
        org.junit.jupiter.api.Assertions.assertThrows(UnsupportedOperationException.class,
                () -> converted.put("x", 1));
        var levels = RuleLanguage.prepare(SIGNAL.withExtras(RuleSchema.LEVEL_VARIABLES),
                "signal.frame.gps.speed - measure > 100.0");
        Map<String, Object> vars = new java.util.LinkedHashMap<>(converted);
        vars.put("measure", 2);
        assertEquals(true, levels.run(vars).value(), "a whole number added to converted variables is converted");
    }

    @Test
    void anErrorAfterAWrittenIntegerPointsAtTheRuleAsWritten() {
        RuleSchema level = SIGNAL.withExtras(RuleSchema.LEVEL_VARIABLES);
        String rule = "measure == 0 && nope > 1";

        assertEquals(rule.indexOf("nope"),
                RuleLanguage.check(level, rule, Expect.CONDITION).issues().get(0).position());
    }

    @Test
    void equalityLiteralsSkipStringsNamesAndDecimals() {
        assertEquals("a == 1.0 && \"x == 2\" == b && c2 == 3.5 && d != 4.0",
                EqualityLiterals.of("a == 1 && \"x == 2\" == b && c2 == 3.5 && d != 4").text());
        assertEquals("x > 1", EqualityLiterals.of("x > 1").text());
    }

    @Test
    void lifecycleReadsTheCase() {
        assertTrue(RuleLanguage.check(RuleSchema.CASE, "case.normal_s >= 120 || case.age_h >= 12",
                Expect.CONDITION).ok());
    }

    @Test
    void samplesWithWholeNumbersRun() {
        Map<String, Object> ints = Map.of("signal", Map.of("frame", Map.of("gps", Map.of("speed", 112)),
                "road", Map.of("maxspeed_osm", 90)));

        assertEquals(22.0, RuleLanguage.evaluate(SIGNAL, "signal.frame.gps.speed - signal.road.maxspeed_osm", ints)
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
        String rule = "signal.trip.active\n&& signal.frame.gps.speedy > 1";

        assertEquals(rule.indexOf("speedy >") - 1,
                RuleLanguage.check(SIGNAL, rule, Expect.CONDITION).issues().get(0).position());
    }

    @Test
    void problemsAreReportedInSpanishWithTheirPosition() {
        RuleCheck typeError = RuleLanguage.check(SIGNAL, "signal.vehicle.weight_category > 3", Expect.CONDITION);
        assertFalse(typeError.ok());
        assertEquals("No se puede usar «>» entre texto y número entero.", typeError.issues().get(0).message());

        RuleIssue unknown = RuleLanguage.check(SIGNAL, "signal.frame.gps.speedy > 1", Expect.CONDITION).issues().get(0);
        assertEquals("El campo «speedy» no existe en esta fuente.", unknown.message());
        assertEquals(16, unknown.position());

        assertEquals("«foo» no existe en esta fuente.",
                RuleLanguage.check(SIGNAL, "foo > 1", Expect.CONDITION).issues().get(0).message());
        assertEquals("La expresión está incompleta.",
                RuleLanguage.check(SIGNAL, "signal.frame.gps.speed >", Expect.CONDITION).issues().get(0).message());
        assertEquals("La expresión está vacía.",
                RuleLanguage.check(SIGNAL, " ", Expect.CONDITION).issues().get(0).message());
    }

    private static final RuleSchema FRAME = new RuleSchema("signal", Map.of(
            "signal.trip.active", "bool",
            "signal.frame.sensors.panic_button", "bool",
            "signal.frame.gps.speed", "number"), Map.of());

    private static Object run(String rule, Map<String, Object> signal) {
        assertTrue(RuleLanguage.check(FRAME, rule, Expect.CONDITION).ok(), rule);
        RuleResult r = RuleLanguage.evaluate(FRAME, rule, Map.of("signal", signal));
        assertTrue(r.ok(), r.error());
        return r.value();
    }

    @Test
    void optionalReadsCompareWithTrueFalseAndNone() {
        String pressed = "signal.frame.?sensors.?panic_button == TRUE";
        Map<String, Object> on = Map.of("frame", Map.of("sensors", Map.of("panic_button", true)));
        Map<String, Object> off = Map.of("frame", Map.of("sensors", Map.of("panic_button", false)));
        Map<String, Object> noButton = Map.of("frame", Map.of("sensors", Map.of()));
        Map<String, Object> noSensors = Map.of("frame", Map.of());

        assertEquals(true, run(pressed, on));
        assertEquals(false, run(pressed, off));
        assertEquals(false, run(pressed, noButton), "a missing field is no error");
        assertEquals(false, run(pressed, noSensors), "nor a missing parent");
        assertEquals(true, run("signal.frame.?sensors.?panic_button == FALSE", off));
        assertEquals(true, run("signal.frame.?sensors.?panic_button == NONE", noSensors));
        assertEquals(false, run("signal.frame.?sensors.?panic_button == NONE", off));
        assertEquals(true, run("signal.frame.?gps.?speed.orValue(0.0) > 90.0",
                Map.of("frame", Map.of("gps", Map.of("speed", 112.0)))));
    }

    @Test
    void aMissingTripTypeUsesTheOptionalFallback() {
        RuleSchema schema = new RuleSchema("signal", Map.of("signal.trip.type", "text"), Map.of());
        String rule = "signal.?trip.?type.orValue(\"v\") == \"v\"";
        assertTrue(RuleLanguage.check(schema, rule, Expect.CONDITION).ok());
        for (Map<String, Object> signal : java.util.List.<Map<String, Object>>of(
                Map.of(), Map.of("trip", Map.of()), Map.of("trip", Map.of("type", "v")))) {
            RuleResult result = RuleLanguage.evaluate(schema, rule, Map.of("signal", signal));
            assertTrue(result.ok(), result.error());
            assertEquals(true, result.value());
        }
        assertEquals(false, RuleLanguage.evaluate(schema, rule,
                Map.of("signal", Map.of("trip", Map.of("type", "otr")))).value());
    }

    @Test
    void optionalsCannotBeUsedAsConditionsDirectly() {
        assertFalse(RuleLanguage.check(FRAME, "signal.frame.?sensors.?panic_button", Expect.CONDITION).ok());
    }

    @Test
    void optionalReadsAreFieldsOfTheRule() {
        String rule = "signal.trip.active && signal.frame.?sensors.?panic_button == TRUE";
        assertEquals(java.util.Set.of("signal.trip.active", "signal.frame.sensors.panic_button"),
                RuleText.fieldPaths(rule));
        assertEquals(RuleText.canonical(rule), RuleText.canonical("signal.trip.active&&signal.frame.?sensors.?panic_button==TRUE"));
    }

    private static final RuleSchema EVENTS = new RuleSchema("signal", Map.of(
            "signal.trip.active", "bool",
            "signal.frame.events", RuleLanguage.OBJECTS,
            "signal.frame.events.event_type", "text",
            "signal.frame.events.severity", "text",
            "signal.frame.events.description", "text",
            "signal.frame.events.timestamp", "time"), Map.of());

    private static Map<String, Object> withEvents(String... types) {
        return Map.of("signal", Map.of("trip", Map.of("active", true), "frame", Map.of("events",
                java.util.Arrays.stream(types).map(t -> Map.of("event_type", t, "severity", "high",
                        "description", "Evento", "timestamp", "2026-01-01T12:00:00Z")).toList())));
    }

    @Test
    void aListOfObjectsIsReadWithTheListMacros() {
        String rule = "signal.frame.events.exists(e, e.event_type in [\"main_power_disconnect\", \"gps_jamming\","
                + " \"device_tamper\"])";

        assertTrue(RuleLanguage.check(EVENTS, rule, Expect.CONDITION).ok());
        assertEquals(true, RuleLanguage.evaluate(EVENTS, rule, withEvents("ignition_on", "device_tamper")).value());
        assertEquals(false, RuleLanguage.evaluate(EVENTS, rule, withEvents("main_power_reconnect")).value());
        assertEquals(false, RuleLanguage.evaluate(EVENTS, rule, withEvents()).value());
        assertEquals(true, RuleLanguage.evaluate(EVENTS, "signal.frame.events.all(e, e.severity == \"high\")",
                withEvents("a", "b")).value());
        assertEquals(2L, RuleLanguage.evaluate(EVENTS,
                "signal.frame.events.filter(e, e.event_type.startsWith(\"main_power\")).size()",
                withEvents("main_power_disconnect", "main_power_reconnect", "gps_jamming")).value());
        assertTrue(RuleLanguage.check(EVENTS, "signal.frame.events.exists_one(e, e.event_type == \"x\")",
                Expect.CONDITION).ok());
    }

    @Test
    void anEventFieldTheSchemaDoesNotDeclareIsRejected() {
        assertFalse(RuleLanguage.check(EVENTS, "signal.frame.events.exists(e, e.code == \"x\")",
                Expect.CONDITION).ok());
        assertFalse(RuleLanguage.check(EVENTS, "signal.frame.events.exists(e, e.severity > 1.0)",
                Expect.CONDITION).ok(), "severity is text");
        assertFalse(RuleLanguage.check(EVENTS, "signal.frame.events == \"x\"", Expect.CONDITION).ok());
    }

    @Test
    void aLifecycleRuleReadsTheCaseAndTheSignal() {
        com.microboxlabs.miot.symptoms.catalog.domain.DataSource source =
                com.microboxlabs.miot.symptoms.catalog.service.DataSourceServiceFixtures.gpsSignal();
        RuleSchema lifecycle = RuleSchema.lifecycle(source);
        String close = "case.closed_by_operator || signal.frame.events.exists(e, e.event_type == "
                + "\"main_power_reconnect\")";

        assertTrue(RuleLanguage.check(lifecycle, close, Expect.CONDITION).ok());
        assertFalse(RuleLanguage.check(RuleSchema.CASE, close, Expect.CONDITION).ok(), "the case alone has no signal");
        Map<String, Object> caseFields = Map.of("condition_s", 0.0, "normal_s", 30.0, "age_h", 1.0, "level", 4.0,
                "closed_by_operator", false);
        Map<String, Object> vars = new java.util.HashMap<>(withEvents("main_power_reconnect"));
        vars.put("case", caseFields);
        assertEquals(true, RuleLanguage.evaluate(lifecycle, close, vars).value(), "closed by the event");
        Map<String, Object> byOperator = new java.util.HashMap<>(withEvents());
        byOperator.put("case", Map.of("condition_s", 0.0, "normal_s", 30.0, "age_h", 1.0, "level", 4.0,
                "closed_by_operator", true));
        assertEquals(true, RuleLanguage.evaluate(lifecycle, close, byOperator).value(), "closed by the operator");
        Map<String, Object> neither = new java.util.HashMap<>(withEvents("gps_jamming"));
        neither.put("case", caseFields);
        assertEquals(false, RuleLanguage.evaluate(lifecycle, close, neither).value());
    }
}
