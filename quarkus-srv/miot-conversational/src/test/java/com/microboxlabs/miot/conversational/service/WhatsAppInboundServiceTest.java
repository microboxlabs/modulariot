package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import org.junit.jupiter.api.Test;

/**
 * Pure decision logic of inbound ingestion (status advance-only ladder + inbox preview). The DB
 * orchestration is exercised end-to-end via the Bruno "Simulate Meta Inbound" request and the dev
 * environment, mirroring how the outbound send path is validated.
 */
class WhatsAppInboundServiceTest {

    @Test
    void statusOnlyAdvancesForward() {
        assertTrue(WhatsAppInboundService.advances(MessageStatus.SENT, MessageStatus.DELIVERED));
        assertTrue(WhatsAppInboundService.advances(MessageStatus.DELIVERED, MessageStatus.READ));
        assertTrue(WhatsAppInboundService.advances(MessageStatus.PENDING, MessageStatus.SENT));
    }

    @Test
    void statusNeverRegressesOrRepeats() {
        assertFalse(WhatsAppInboundService.advances(MessageStatus.READ, MessageStatus.DELIVERED));
        assertFalse(WhatsAppInboundService.advances(MessageStatus.DELIVERED, MessageStatus.SENT));
        assertFalse(WhatsAppInboundService.advances(MessageStatus.DELIVERED, MessageStatus.DELIVERED));
        assertFalse(WhatsAppInboundService.advances(MessageStatus.SENT, null));
    }

    @Test
    void failedReachableOnlyBeforeDeliveryAndTerminal() {
        assertTrue(WhatsAppInboundService.advances(MessageStatus.SENT, MessageStatus.FAILED));
        assertTrue(WhatsAppInboundService.advances(MessageStatus.PENDING, MessageStatus.FAILED));
        assertFalse(WhatsAppInboundService.advances(MessageStatus.DELIVERED, MessageStatus.FAILED));
        assertFalse(WhatsAppInboundService.advances(MessageStatus.FAILED, MessageStatus.DELIVERED));
    }

    @Test
    void previewUsesTextWhenPresent() {
        assertEquals("hola jefe", WhatsAppInboundService.inboundPreview(text("hola jefe")));
    }

    @Test
    void previewTruncatesLongTextTo280() {
        assertEquals(280, WhatsAppInboundService.inboundPreview(text("x".repeat(400))).length());
    }

    @Test
    void previewLabelsMediaWithoutCaption() {
        InboundMessage image = new InboundMessage(
                "PNID", "+56900000001", "Juan", "wamid.IMG", MessageType.IMAGE,
                null, "MEDIA_1", "image/jpeg", null, null);
        assertEquals("[image]", WhatsAppInboundService.inboundPreview(image));
    }

    private static InboundMessage text(String body) {
        return new InboundMessage(
                "PNID", "+56900000001", "Juan", "wamid.TXT", MessageType.TEXT,
                body, null, null, null, null);
    }
}
