package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Template variables from an event, rendering, and the trigger condition. */
class TemplateVariablesTest {

    private static final Instant AT = Instant.parse("2026-10-23T15:04:00Z");

    @Test
    void theDerivedVariables() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("symptomName", "Botón de pánico");
        data.put("level", 4);
        data.put("assetId", "ABCD12");
        data.put("latitude", -33.4567891);
        data.put("longitude", -70.6);
        data.put("measure", 1.0);
        data.put("closedBy", null);

        Map<String, String> vars = TemplateVariables.of(data, AT, null);

        assertEquals("12:04", vars.get("hora"));
        assertEquals("23-10-2026", vars.get("fecha"));
        assertEquals("conductor", vars.get("nombre"));
        assertEquals("ABCD12", vars.get("patente"));
        assertEquals("Botón de pánico", vars.get("sintoma"));
        assertEquals("Código negro", vars.get("nivel"));
        assertEquals("-33.45679, -70.60000", vars.get("ubicacion"));
        assertEquals("4", vars.get("level"));
        assertEquals("1", vars.get("measure"));
        assertFalse(vars.containsKey("closedBy"));
    }

    @Test
    void aPlateWinsOverTheAssetAndTheRecipientNameOverConductor() {
        Map<String, String> vars = TemplateVariables.of(Map.of("plate", "XY1234", "assetId", "A-1", "level", 2), AT,
                "Ana");

        assertEquals("XY1234", vars.get("patente"));
        assertEquals("Ana", vars.get("nombre"));
        assertEquals("Comprometida", vars.get("nivel"));
        assertEquals("Bajo observación", TemplateVariables.of(Map.of("level", 1), AT, null).get("nivel"));
        assertEquals("Crítica", TemplateVariables.of(Map.of("level", 3), AT, null).get("nivel"));
    }

    @Test
    void renderingFillsKnownVariablesAndEmptiesTheRest() {
        String out = TemplateVariables.render("Hola {{nombre}}, {{ patente }} a las {{hora}}{{nada}}. $1 \\ok",
                Map.of("nombre", "Ana", "patente", "AB$12", "hora", "12:04"));

        assertEquals("Hola Ana, AB$12 a las 12:04. $1 \\ok", out);
    }

    @Test
    void theConditionReadsTheEvent() {
        Map<String, Object> data = new LinkedHashMap<>();
        data.put("symptomKey", "panic-button");
        data.put("level", 4);
        data.put("speedKmh", 10.5);
        data.put("closedBy", null);
        StoredEvent event = new StoredEvent("e", "t", "symptom.case.opened", "s", "symptom_case", "-1", data, false,
                AT, AT);
        Map<String, Object> cel = event.asCelEvent();

        assertTrue(EventCondition.matches("event.data.symptomKey == 'panic-button' && event.data.level >= 4", cel));
        assertTrue(EventCondition.matches("event.data.speedKmh > 10", cel));
        assertTrue(EventCondition.matches("event.type == 'symptom.case.opened' && event.context.key == '-1'", cel));
        assertTrue(EventCondition.matches("!event.test", cel));
        assertTrue(EventCondition.matches("!has(event.data.closedBy)", cel));
        assertTrue(EventCondition.matches("", cel));
        assertFalse(EventCondition.matches("event.data.level >= 5", cel));
        assertFalse(EventCondition.matches("event.data.missing == 1", cel), "a missing field is false");
        assertFalse(EventCondition.matches("event.data.level >=", cel), "a broken condition is false");
        assertFalse(EventCondition.matches("event.data.level", cel), "a number is not true");
    }
}
