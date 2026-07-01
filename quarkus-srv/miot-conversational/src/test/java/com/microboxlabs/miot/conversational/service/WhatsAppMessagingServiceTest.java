package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.lang.reflect.InvocationTargetException;
import java.lang.reflect.Method;
import java.net.URI;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
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
    void validateRejectsTemplateParamWithBlankName() {
        assertIllegalArgument(template("trip_detention_alert_v1", Map.of(" ", "Juan")), "parameter name");
    }

    @Test
    void validateRejectsTemplateParamWithBlankValue() {
        assertIllegalArgument(template("trip_detention_alert_v1", Map.of("driver_name", "")), "driver_name");
    }

    @Test
    void validateAcceptsWellFormedTextAndTemplate() {
        assertDoesNotThrow(() -> {
            invokeValidate(request("+56900", "TEXT", "hello", null));
            invokeValidate(request("+56900", "TEMPLATE", null, "trip_assigned"));
            invokeValidate(template("trip_detention_alert_v1", Map.of("driver_name", "Juan")));
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
        // An unknown template with no stored copy shows its bare name in the preview.
        String preview = (String) preview().invoke(null, request("+56900", "TEMPLATE", null, "trip_assigned"));
        assertEquals("trip_assigned", preview);
    }

    @Test
    void maskPhoneKeepsOnlyLastFourDigits() throws Exception {
        Method maskPhone = WhatsAppMessagingService.class.getDeclaredMethod("maskPhone", String.class);
        maskPhone.setAccessible(true);
        assertEquals("****0001", maskPhone.invoke(null, "+56900000001"));
        assertEquals("****", maskPhone.invoke(null, "123"));
        assertEquals("****", maskPhone.invoke(null, new Object[] {null}));
    }

    // Placeholder numbers only — never put real phone numbers in the codebase.
    @Test
    void testModeBlocksRecipientNotOnTheAllowlist() {
        ResolvedConnection connection = testConnection(true, List.of("+56 9 0000 0001", "+56900000002"));
        assertThrows(IllegalArgumentException.class,
                () -> WhatsAppMessagingService.enforceTestMode(connection, "+56900009999"));
    }

    @Test
    void testModeAllowsAllowlistedRecipientIgnoringFormatting() {
        ResolvedConnection connection = testConnection(true, List.of("+56 9 0000 0001"));
        assertDoesNotThrow(() -> WhatsAppMessagingService.enforceTestMode(connection, "569 0000-0001"));
    }

    @Test
    void testModeDisabledAllowsAnyRecipient() {
        ResolvedConnection connection = testConnection(false, List.of("+56900000001"));
        assertDoesNotThrow(() -> WhatsAppMessagingService.enforceTestMode(connection, "+56900009999"));
    }

    @Test
    void parseRecipientsAcceptsListOrCommaSeparatedString() {
        Set<String> expected = Set.of("56900000001", "56900000002");
        assertEquals(expected,
                WhatsAppMessagingService.parseRecipients(List.of("+56 9 0000 0001", "+56900000002")));
        assertEquals(expected,
                WhatsAppMessagingService.parseRecipients("+56900000001, +56 9 0000 0002"));
    }

    private static ResolvedConnection testConnection(boolean enabled, List<String> recipients) {
        Map<String, Object> metadata = new HashMap<>();
        metadata.put("test_mode_enabled", enabled);
        metadata.put("test_recipients", recipients);
        return new ResolvedConnection(
                "conn-1", URI.create("https://graph.facebook.com/v25.0"), metadata, Map.of());
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

    private static SendWhatsAppMessageRequest template(String templateName, Map<String, String> params) {
        return new SendWhatsAppMessageRequest(
                "+56900", "TEMPLATE", null, templateName, null, params, null, null, null, null, null);
    }
}
