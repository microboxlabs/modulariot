package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.service.WhatsAppTemplate.Button;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class WhatsAppTemplateDraftTest {

    private static final String BODY = "Hola {{nombre}}, el móvil {{patente}} activó una alerta.";
    private static final Map<String, String> EXAMPLES = Map.of("nombre", "Juan", "patente", "TEST01");

    private static WhatsAppTemplateDraft draft(String name, String body, Map<String, String> examples,
            List<Button> buttons) {
        return new WhatsAppTemplateDraft(name, null, "utility", null, body, null, buttons, examples);
    }

    private static WhatsAppTemplateDraft ok() {
        return draft("trip_alert_v1", BODY, EXAMPLES, List.of());
    }

    private static void rejects(WhatsAppTemplateDraft d, String fragment) {
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class, d::validateNew);
        assertTrue(e.getMessage().contains(fragment), e.getMessage());
    }

    private static Button quick(String text) {
        return new Button("QUICK_REPLY", text, null, null);
    }

    private static Button url(String text, String url) {
        return new Button("URL", text, url, null);
    }

    @Test
    void aWellFormedDraftPasses() {
        assertDoesNotThrow(() -> new WhatsAppTemplateDraft("trip_alert_v1", "en_US", "MARKETING", "Alerta {{patente}}",
                BODY, "Equipo de operaciones", List.of(quick("Estoy bien"), quick("Necesito ayuda"),
                        url("Ver", "https://example.com/x"), new Button("PHONE_NUMBER", "Llamar", null, "+15550000000")),
                EXAMPLES).validateNew());
    }

    @Test
    void namesAreLowercaseDigitsAndUnderscores() {
        rejects(draft("Trip-Alert", BODY, EXAMPLES, List.of()), "name");
        rejects(draft("trip alert", BODY, EXAMPLES, List.of()), "name");
        rejects(draft(null, BODY, EXAMPLES, List.of()), "name");
        rejects(new WhatsAppTemplateDraft("ok_1", "Spanish", "UTILITY", null, BODY, null, null, EXAMPLES),
                "language");
    }

    @Test
    void categoryIsUtilityOrMarketing() {
        rejects(new WhatsAppTemplateDraft("a", null, "AUTHENTICATION", null, BODY, null, null, EXAMPLES),
                "AUTHENTICATION");
        rejects(new WhatsAppTemplateDraft("a", null, "OTHER", null, BODY, null, null, EXAMPLES), "category");
        rejects(new WhatsAppTemplateDraft("a", null, null, null, BODY, null, null, EXAMPLES), "category");
    }

    @Test
    void everyParameterNeedsAnExampleAndANamedForm() {
        rejects(draft("a", BODY, Map.of("nombre", "Juan"), List.of()), "{{patente}} needs an example");
        rejects(draft("a", BODY, Map.of("nombre", "Juan", "patente", " "), List.of()), "{{patente}}");
        rejects(draft("a", "Hola {{1}}, ¿todo bien?", Map.of("1", "x"), List.of()), "{{1}} must be lowercase");
        rejects(draft("a", "Hola {{Nombre}}, ¿todo bien?", Map.of("Nombre", "x"), List.of()), "{{Nombre}}");
    }

    @Test
    void theBodyNeitherStartsNorEndsWithAParameter() {
        rejects(draft("a", "{{nombre}}, hola", EXAMPLES, List.of()), "start or the end");
        rejects(draft("a", "Hola {{nombre}}", EXAMPLES, List.of()), "start or the end");
        rejects(draft("a", " ", EXAMPLES, List.of()), "body is required");
        rejects(draft("a", "x".repeat(1025), EXAMPLES, List.of()), "1024");
    }

    @Test
    void headerAndFooterLimits() {
        rejects(new WhatsAppTemplateDraft("a", null, "UTILITY", "{{nombre}} {{patente}}", BODY, null, null,
                EXAMPLES), "at most one parameter");
        rejects(new WhatsAppTemplateDraft("a", null, "UTILITY", "x".repeat(61), BODY, null, null, EXAMPLES),
                "header");
        rejects(new WhatsAppTemplateDraft("a", null, "UTILITY", null, BODY, "Hola {{nombre}}", null, EXAMPLES),
                "footer");
    }

    @Test
    void buttonLimits() {
        rejects(draft("a", BODY, EXAMPLES, Collections.nCopies(11, quick("Sí"))), "at most 10");
        rejects(draft("a", BODY, EXAMPLES, List.of(quick(""))), "buttons[1]");
        rejects(draft("a", BODY, EXAMPLES, List.of(quick("x".repeat(26)))), "buttons[1]");
        rejects(draft("a", BODY, EXAMPLES, List.of(url("Ver", "ftp://x"))), "http");
        rejects(draft("a", BODY, EXAMPLES, List.of(url("Ver", "https://x.test/{{1}}"))), "fixed");
        rejects(draft("a", BODY, EXAMPLES,
                List.of(url("a", "https://x.test"), url("b", "https://x.test"), url("c", "https://x.test"))),
                "URL buttons");
        rejects(draft("a", BODY, EXAMPLES, List.of(new Button("PHONE_NUMBER", "Llamar", null, "555"))), "phone");
        rejects(draft("a", BODY, EXAMPLES, List.of(new Button("COPY_CODE", "x", null, null))), "QUICK_REPLY");
        rejects(draft("a", BODY, EXAMPLES, List.of(quick("a"), url("b", "https://x.test"), quick("c"))),
                "together");
    }

    @Test
    void theCreatePayloadUsesNamedParametersWithTheirExamples() {
        JsonObject payload = new WhatsAppTemplateDraft("trip_alert_v1", null, "utility", "Alerta {{patente}}", BODY,
                "Pie", List.of(quick("Estoy bien"), url("Ver", "https://example.com/x")), EXAMPLES).toCreate();

        assertEquals("trip_alert_v1", payload.getString("name"));
        assertEquals("es_CL", payload.getString("language"));
        assertEquals("UTILITY", payload.getString("category"));
        assertEquals("NAMED", payload.getString("parameter_format"));
        JsonArray c = payload.getJsonArray("components");
        assertEquals(4, c.size());
        JsonObject header = c.getJsonObject(0);
        assertEquals("TEXT", header.getString("format"));
        assertEquals("[{\"param_name\":\"patente\",\"example\":\"TEST01\"}]",
                header.getJsonObject("example").getJsonArray("header_text_named_params").encode());
        JsonObject body = c.getJsonObject(1);
        assertEquals("BODY", body.getString("type"));
        assertEquals(BODY, body.getString("text"));
        assertEquals("[{\"param_name\":\"nombre\",\"example\":\"Juan\"},{\"param_name\":\"patente\",\"example\":\"TEST01\"}]",
                body.getJsonObject("example").getJsonArray("body_text_named_params").encode());
        assertEquals("{\"type\":\"FOOTER\",\"text\":\"Pie\"}", c.getJsonObject(2).encode());
        assertEquals("[{\"type\":\"QUICK_REPLY\",\"text\":\"Estoy bien\"},"
                + "{\"type\":\"URL\",\"text\":\"Ver\",\"url\":\"https://example.com/x\"}]",
                c.getJsonObject(3).getJsonArray("buttons").encode());

        JsonObject edit = ok().toEdit();
        assertEquals(Set.of("category", "components"), edit.fieldNames());
    }
}
