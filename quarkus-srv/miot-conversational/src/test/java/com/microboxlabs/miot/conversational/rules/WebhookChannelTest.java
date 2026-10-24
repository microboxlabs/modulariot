package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import java.net.URI;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The webhook channel's template, its connections and the payload a step sends. */
class WebhookChannelTest {

    private static final String TENANT = "tenant-1";

    private final InMemoryIntegrations integrations = new InMemoryIntegrations();
    private final WebhookChannel webhook = integrations.webhook;

    @Test
    void theTemplateIsCreatedOncePerOrganization() {
        IntegrationTemplate first = webhook.ensureTemplate(TENANT);
        IntegrationTemplate again = webhook.ensureTemplate(TENANT);
        IntegrationTemplate other = webhook.ensureTemplate("tenant-2");

        assertEquals(first.id(), again.id());
        assertEquals(2, integrations.templates.size());
        assertEquals("tenant-2", other.tenantCode());
        assertEquals(WebhookChannel.TEMPLATE_NAME, first.name());
        assertEquals(ProviderType.CUSTOM_HTTP, first.providerType());
        assertEquals("deliver", first.operationName());
        assertEquals("POST", first.method());
        assertEquals("", first.path());
        assertEquals(WebhookChannel.REQUEST_SCHEMA, first.requestSchema());
    }

    @Test
    void connectionsAreTheOnesMadeFromTheTemplate() {
        assertEquals(List.of(), webhook.connections(TENANT));
        assertTrue(integrations.templates.isEmpty(), "reading creates no template");

        IntegrationConnection made = webhook.create(TENANT, " Torre externa ", "https://hooks.example.com/miot", " ");
        integrations.connections.add(new IntegrationConnection("other", TENANT, "Otra", ProviderType.CUSTOM_HTTP,
                URI.create("https://other.example.com"), null, ConnectionStatus.ACTIVE, null, null, Map.of()));

        assertEquals("Torre externa", made.name());
        assertNull(made.credentialProfileId());
        assertEquals(webhook.ensureTemplate(TENANT).id(), made.templateId());
        assertEquals(List.of(made), webhook.connections(TENANT));
        assertEquals(List.of(), webhook.connections("tenant-2"));
    }

    @Test
    void aConnectionNeedsANameAndAnHttpUrl() {
        assertThrows(IllegalArgumentException.class, () -> webhook.create(TENANT, null, "https://a.example.com", null));
        assertThrows(IllegalArgumentException.class, () -> webhook.create(TENANT, "a", null, null));
        assertThrows(IllegalArgumentException.class, () -> webhook.create(TENANT, "a", "hooks.example.com", null));
        assertThrows(IllegalArgumentException.class, () -> webhook.create(TENANT, "a", "https://a b", null));
        assertTrue(integrations.connections.isEmpty());
    }

    @Test
    void thePayloadCarriesTheEventRuleAndRun() {
        Instant at = Instant.parse("2026-10-23T15:04:00Z");
        StoredEvent event = new StoredEvent("e-1", TENANT, "symptom.case.opened", "miot-symptoms", "symptom_case",
                "-7", Map.of("level", 4), false, at, at);
        Run run = new Run("run-1", TENANT, "rule-1", "0.2.0", "e-1", "symptom_case", "-7", true, Run.Status.WAITING,
                1, at, null, at, at);
        Rule rule = new Rule("rule-1", TENANT, "panic", "Botón de pánico", Rule.State.TEST, "0.2.0", at, at);

        Map<String, Object> payload = WebhookChannel.payload(event, run, rule, "Asunto", "Texto");

        assertEquals(List.of("event", "at", "context", "rule", "run", "title", "text", "data"),
                List.copyOf(payload.keySet()));
        assertEquals("symptom.case.opened", payload.get("event"));
        assertEquals("2026-10-23T15:04:00Z", payload.get("at"));
        assertEquals(Map.of("kind", "symptom_case", "key", "-7"), payload.get("context"));
        assertEquals(Map.of("id", "rule-1", "key", "panic", "name", "Botón de pánico", "version", "0.2.0"),
                payload.get("rule"));
        assertEquals(Map.of("id", "run-1", "step", 1, "test", true), payload.get("run"));
        assertEquals("Asunto", payload.get("title"));
        assertEquals(Map.of("level", 4), payload.get("data"));
    }
}
