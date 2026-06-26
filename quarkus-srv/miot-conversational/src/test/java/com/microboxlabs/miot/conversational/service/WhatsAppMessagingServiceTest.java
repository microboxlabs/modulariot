package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Unit coverage for the pure decision logic of the messaging service (validation rules and
 * preview truncation). The send orchestration itself is exercised end-to-end against a live
 * connection in the dev environment. Mirrors the reflection-based style of the integrations
 * service test (the project does not mock collaborators).
 */
class WhatsAppMessagingServiceTest {

    @Test
    void validateRejectsMissingRecipient() {
        assertIllegalArgument(request(null, "TEXT", "hi", null), "to");
    }

    @Test
    void validateRejectsTextWithoutBody() {
        assertIllegalArgument(request("+56900", "TEXT", "  ", null), "body");
    }

    @Test
    void validateRejectsTemplateWithoutName() {
        assertIllegalArgument(request("+56900", "TEMPLATE", null, null), "templateName");
    }

    @Test
    void validateAcceptsWellFormedTextAndTemplate() {
        assertDoesNotThrow(() -> {
            invokeValidate(request("+56900", "TEXT", "hello", null));
            invokeValidate(request("+56900", "TEMPLATE", null, "trip_assigned"));
        });
    }

    @Test
    void previewTruncatesLongBodyTo280Chars() throws Exception {
        String body = "x".repeat(400);
        String preview = (String) preview().invoke(null, request("+56900", "TEXT", body, null));
        assertEquals(280, preview.length());
    }

    @Test
    void previewLabelsTemplateByName() throws Exception {
        String preview = (String) preview().invoke(null, request("+56900", "TEMPLATE", null, "trip_assigned"));
        assertEquals("[template] trip_assigned", preview);
    }

    private static void assertIllegalArgument(SendWhatsAppMessageRequest request, String field) {
        InvocationTargetException wrapper = assertThrows(InvocationTargetException.class,
                () -> invokeValidate(request));
        assertInstanceOf(IllegalArgumentException.class, wrapper.getCause());
        assertTrue(wrapper.getCause().getMessage().contains(field),
                "expected message about '" + field + "' but was: " + wrapper.getCause().getMessage());
    }

    private static void invokeValidate(SendWhatsAppMessageRequest request) throws Exception {
        Method validate = WhatsAppMessagingService.class.getDeclaredMethod("validate", SendWhatsAppMessageRequest.class);
        validate.setAccessible(true);
        validate.invoke(null, request);
    }

    private static Method preview() throws NoSuchMethodException {
        Method preview = WhatsAppMessagingService.class.getDeclaredMethod("preview", SendWhatsAppMessageRequest.class);
        preview.setAccessible(true);
        return preview;
    }

    private static SendWhatsAppMessageRequest request(String to, String type, String body, String templateName) {
        return new SendWhatsAppMessageRequest(
                to, type, body, templateName, null, Map.of(), null, null, null, null, null);
    }
}
