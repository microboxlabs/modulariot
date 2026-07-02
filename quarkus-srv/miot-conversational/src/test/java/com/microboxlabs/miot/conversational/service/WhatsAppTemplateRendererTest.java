package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import org.junit.jupiter.api.Test;

class WhatsAppTemplateRendererTest {

    @Test
    void fillsNamedParamsForKnownTemplate() {
        String body = WhatsAppTemplateRenderer.render(
                "pod_rejected_v1",
                Map.of("driver_name", "Mike", "trip_reference", "1586405", "reason", "la firma no es legible"));

        assertTrue(body.contains("Hola Mike."), body);
        assertTrue(body.contains("viaje 1586405"), body);
        assertTrue(body.contains("no pudo ser aceptado: la firma no es legible."), body);
        assertFalse(body.contains("{{"), "no raw placeholders should remain:\n" + body);
    }

    @Test
    void unknownTemplateReturnsNullSoCallerFallsBackToName() {
        assertNull(WhatsAppTemplateRenderer.render("no_such_template_v9", Map.of("driver_name", "Mike")));
    }

    @Test
    void nullTemplateNameReturnsNull() {
        assertNull(WhatsAppTemplateRenderer.render(null, Map.of()));
    }

    @Test
    void stripsPlaceholdersForMissingParams() {
        // reason not supplied — the {{reason}} placeholder must be removed, never rendered raw.
        String body = WhatsAppTemplateRenderer.render(
                "pod_rejected_v1", Map.of("driver_name", "Ana", "trip_reference", "V-99"));

        assertFalse(body.contains("{{reason}}"), body);
        assertFalse(body.contains("{{"), body);
        assertTrue(body.contains("Hola Ana."), body);
    }

    @Test
    void toleratesNullParamsMap() {
        // No params at all: still renders the static parts, all placeholders stripped.
        String body = WhatsAppTemplateRenderer.render("pod_approved_v1", null);
        assertFalse(body.contains("{{"), body);
        assertTrue(body.contains("validado"), body);
    }

    @Test
    void rendersEmptyValueWithoutPlaceholder() {
        String body = WhatsAppTemplateRenderer.render(
                "pod_approved_v1", Map.of("driver_name", "", "trip_reference", "V-1"));
        assertEquals(false, body.contains("{{"), body);
    }
}
