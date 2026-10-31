package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaNotification;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;

class GeocodingQuotaTemplateTest {
    @Test
    void localDraftIsUtilitySpanishAndMatchesTheRendererAndSeed() throws Exception {
        try (var resource = getClass().getResourceAsStream("/templates/miot_geocoding_quota_alert.json")) {
            assertNotNull(resource);
            var draft = new ObjectMapper().readValue(resource, WhatsAppTemplateDraft.class);
            draft.validateNew();
            assertEquals("UTILITY", draft.category());
            assertEquals("es", draft.language());
            assertEquals(GeocodingQuotaNotification.TEMPLATE_BODY, draft.body());
            assertEquals(5, draft.examples().size());
            var body = WhatsAppTemplateRenderer.render(draft.name(), Map.of("organization", "Example (2026-10)",
                    "used", "100", "quota", "100", "pct", "100", "next_step", "Las llamadas continúan."));
            assertTrue(body.contains("Example (2026-10): 100 / 100"));
            assertFalse(body.contains("{{"));
            try (var migration = getClass().getResourceAsStream("/db/migration/conversational/V0.11.6__geocoding_quota_alert_template.sql")) {
                assertNotNull(migration);
                var sql = new String(migration.readAllBytes(), StandardCharsets.UTF_8);
                assertTrue(sql.contains(draft.body()));
                assertTrue(sql.contains("ON CONFLICT (tenant_code, key) DO NOTHING"));
            }
        }
    }
}
