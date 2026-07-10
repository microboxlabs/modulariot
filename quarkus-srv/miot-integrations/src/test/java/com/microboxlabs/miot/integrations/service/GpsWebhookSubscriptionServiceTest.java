package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import com.microboxlabs.miot.integrations.dto.CreateGpsWebhookRequest;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GpsWebhookSubscriptionServiceTest {

    private GpsWebhookSubscriptionService service;

    @BeforeEach
    void setUp() {
        service = new GpsWebhookSubscriptionService(
                null, null, null, new WebhookFilterCompiler(), null);
    }

    @Test
    void createRejectsMissingName() {
        CreateGpsWebhookRequest req = new CreateGpsWebhookRequest(
                "  ",
                URI.create("https://example.com/hook"),
                null,
                FilterMode.ALL_VISIBLE,
                null,
                true);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.create("t", req));
        assertTrue(ex.getMessage().contains("name"));
    }

    @Test
    void createRejectsMissingUrl() {
        CreateGpsWebhookRequest req = new CreateGpsWebhookRequest(
                "ops-hook",
                null,
                null,
                FilterMode.ALL_VISIBLE,
                null,
                true);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.create("t", req));
        assertEquals("url is required", ex.getMessage());
    }

    @Test
    void createRejectsNonHttpUrl() {
        CreateGpsWebhookRequest req = new CreateGpsWebhookRequest(
                "ops-hook",
                URI.create("ftp://example.com/hook"),
                null,
                FilterMode.ALL_VISIBLE,
                null,
                true);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.create("t", req));
        assertTrue(ex.getMessage().contains("http"));
    }

    @Test
    void createRejectsLoopbackUrl() {
        CreateGpsWebhookRequest req = new CreateGpsWebhookRequest(
                "ops-hook",
                URI.create("http://127.0.0.1/hook"),
                null,
                FilterMode.ALL_VISIBLE,
                null,
                true);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.create("t", req));
        assertTrue(ex.getMessage().contains("internal"));
    }

    @Test
    void createRejectsEmptyRulesFilterBeforeDbAccess() {
        CreateGpsWebhookRequest req = new CreateGpsWebhookRequest(
                "ops-hook",
                URI.create("https://example.com/hook"),
                null,
                FilterMode.RULES,
                Map.of("scopes", Map.of()),
                true);
        IllegalArgumentException ex = assertThrows(IllegalArgumentException.class, () -> service.create("t", req));
        assertTrue(ex.getMessage().contains("at least one"));
    }
}
