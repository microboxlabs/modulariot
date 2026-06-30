package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/**
 * The verify-token handshake decision: only a genuine subscribe carrying exactly our configured
 * token may echo the challenge. Static helper so it is unit-testable without HTTP.
 */
class WhatsAppWebhookResourceTest {

    private static final String TOKEN = "the-configured-verify-token";

    @Test
    void acceptsSubscribeWithMatchingToken() {
        assertTrue(WhatsAppWebhookResource.isValidHandshake("subscribe", TOKEN, TOKEN));
    }

    @Test
    void rejectsWrongToken() {
        assertFalse(WhatsAppWebhookResource.isValidHandshake("subscribe", "guessed", TOKEN));
    }

    @Test
    void rejectsNonSubscribeMode() {
        assertFalse(WhatsAppWebhookResource.isValidHandshake("unsubscribe", TOKEN, TOKEN));
        assertFalse(WhatsAppWebhookResource.isValidHandshake(null, TOKEN, TOKEN));
    }

    @Test
    void rejectsWhenConfiguredTokenIsBlankOrPresentedTokenIsNull() {
        assertFalse(WhatsAppWebhookResource.isValidHandshake("subscribe", "", ""));
        assertFalse(WhatsAppWebhookResource.isValidHandshake("subscribe", null, TOKEN));
    }
}
