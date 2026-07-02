package com.microboxlabs.miot.conversational.dto;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.MessageRole;
import java.util.Map;
import org.junit.jupiter.api.Test;

class SendWhatsAppMessageRequestTest {

    @Test
    void isTemplateIsCaseInsensitiveAndDefaultsToText() {
        assertTrue(request("TEMPLATE").isTemplate());
        assertTrue(request("template").isTemplate());
        assertFalse(request("TEXT").isTemplate());
        assertFalse(request(null).isTemplate());
    }

    @Test
    void languageDefaultsToChileanSpanishWhenBlank() {
        assertEquals("es_CL", template(null).languageOrDefault());
        assertEquals("es_CL", template("  ").languageOrDefault());
        assertEquals("en_US", template("en_US").languageOrDefault());
    }

    @Test
    void roleDefaultsToAgent() {
        assertEquals(MessageRole.AGENT, request("TEXT").roleOrDefault());
        assertEquals(MessageRole.SYSTEM, new SendWhatsAppMessageRequest(
                "+56900", "TEXT", "hi", null, null, null,
                MessageRole.SYSTEM, null, null, null, null).roleOrDefault());
    }

    @Test
    void templateParamsNeverNull() {
        assertTrue(request("TEXT").templateParamsOrEmpty().isEmpty());
        assertEquals(Map.of("driver_name", "Juan"), new SendWhatsAppMessageRequest(
                "+56900", "TEMPLATE", null, "t", "es_CL", Map.of("driver_name", "Juan"),
                null, null, null, null, null).templateParamsOrEmpty());
    }

    @Test
    void actorDefaultsToNullViaLegacyConstructorAndIsCarriedByCanonical() {
        assertNull(request("TEXT").actor());
        assertEquals("ops@mintral.cl", new SendWhatsAppMessageRequest(
                "+56900", "TEMPLATE", null, "pod_rejected_v1", "es_CL", Map.of(),
                MessageRole.AGENT, null, "SVC-1", null, "task-1", "ops@mintral.cl").actor());
    }

    private static SendWhatsAppMessageRequest request(String type) {
        return new SendWhatsAppMessageRequest(
                "+56900", type, "hi", null, null, null, null, null, null, null, null);
    }

    private static SendWhatsAppMessageRequest template(String language) {
        return new SendWhatsAppMessageRequest(
                "+56900", "TEMPLATE", null, "trip_assigned", language, null, null, null, null, null, null);
    }
}
