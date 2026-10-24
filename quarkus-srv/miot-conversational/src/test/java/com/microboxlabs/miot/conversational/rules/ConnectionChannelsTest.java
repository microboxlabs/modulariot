package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
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
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.junit.jupiter.api.Test;

/** The connection channels' templates, their connections and the body each kind sends. */
class ConnectionChannelsTest {

    private static final String TENANT = "tenant-1";
    private static final Instant AT = Instant.parse("2026-10-23T15:04:00Z");

    private final InMemoryIntegrations integrations = new InMemoryIntegrations();
    private final ConnectionChannels channels = integrations.channels;

    private static ConnectionChannel.Delivery delivery(String title, String text) {
        StoredEvent event = new StoredEvent("e-1", TENANT, "symptom.case.opened", "miot-symptoms", "symptom_case",
                "-7", Map.of("level", 4), false, AT, AT);
        Run run = new Run("run-1", TENANT, "rule-1", "0.2.0", "e-1", "symptom_case", "-7", true, Run.Status.WAITING,
                1, AT, null, AT, AT);
        Rule rule = new Rule("rule-1", TENANT, "panic", "Botón de pánico", Rule.State.TEST, "0.2.0", AT, AT);
        return new ConnectionChannel.Delivery(event, run, rule, title, text);
    }

    @Test
    void theKindsAreKnownByTheirKeyInAnyCase() {
        assertEquals(Optional.of(ConnectionChannel.WEBHOOK), ConnectionChannel.of("webhook"));
        assertEquals(Optional.of(ConnectionChannel.SLACK), ConnectionChannel.of(" Slack "));
        assertEquals(Optional.of(ConnectionChannel.TEAMS), ConnectionChannel.of("TEAMS"));
        assertEquals(Optional.empty(), ConnectionChannel.of("whatsapp"));
        assertEquals(Optional.empty(), ConnectionChannel.of(null));
        Set<String> names = Stream.of(ConnectionChannel.values()).map(ConnectionChannel::templateName)
                .collect(Collectors.toSet());
        assertEquals(Set.of("Webhook de comunicaciones", "Slack de comunicaciones", "Teams de comunicaciones"),
                names);
    }

    @Test
    void eachKindHasItsTemplateOncePerOrganization() {
        IntegrationTemplate first = channels.ensureTemplate(ConnectionChannel.WEBHOOK, TENANT);
        IntegrationTemplate again = channels.ensureTemplate(ConnectionChannel.WEBHOOK, TENANT);
        IntegrationTemplate other = channels.ensureTemplate(ConnectionChannel.WEBHOOK, "tenant-2");
        IntegrationTemplate slack = channels.ensureTemplate(ConnectionChannel.SLACK, TENANT);
        IntegrationTemplate teams = channels.ensureTemplate(ConnectionChannel.TEAMS, TENANT);

        assertEquals(first.id(), again.id());
        assertEquals(4, integrations.templates.size());
        assertEquals("tenant-2", other.tenantCode());
        assertNotEquals(first.id(), slack.id());
        for (IntegrationTemplate t : List.of(first, slack, teams)) {
            assertEquals(ProviderType.CUSTOM_HTTP, t.providerType());
            assertEquals("deliver", t.operationName());
            assertEquals("POST", t.method());
            assertEquals("", t.path());
        }
        assertEquals("Webhook de comunicaciones", first.name());
        assertEquals(ConnectionChannel.WEBHOOK.requestSchema(), first.requestSchema());
        assertEquals("Slack de comunicaciones", slack.name());
        assertEquals(ConnectionChannel.SLACK.requestSchema(), slack.requestSchema());
        assertEquals("Teams de comunicaciones", teams.name());
        assertEquals(ConnectionChannel.TEAMS.requestSchema(), teams.requestSchema());
    }

    @Test
    void connectionsAreTheOnesMadeFromTheKindsTemplate() {
        assertEquals(List.of(), channels.connections(ConnectionChannel.WEBHOOK, TENANT));
        assertTrue(integrations.templates.isEmpty(), "reading creates no template");

        IntegrationConnection made = channels.create(ConnectionChannel.WEBHOOK, TENANT, " Torre externa ",
                "https://hooks.example.com/miot", " ");
        IntegrationConnection slack = channels.create(ConnectionChannel.SLACK, TENANT, "Canal torre",
                "https://hooks.example.com/slack", null);
        integrations.connections.add(new IntegrationConnection("other", TENANT, "Otra", ProviderType.CUSTOM_HTTP,
                URI.create("https://other.example.com"), null, ConnectionStatus.ACTIVE, null, null, Map.of()));

        assertEquals("Torre externa", made.name());
        assertNull(made.credentialProfileId());
        assertEquals(channels.ensureTemplate(ConnectionChannel.WEBHOOK, TENANT).id(), made.templateId());
        assertEquals(List.of(made), channels.connections(ConnectionChannel.WEBHOOK, TENANT));
        assertEquals(List.of(slack), channels.connections(ConnectionChannel.SLACK, TENANT));
        assertEquals(List.of(), channels.connections(ConnectionChannel.TEAMS, TENANT));
        assertEquals(List.of(), channels.connections(ConnectionChannel.WEBHOOK, "tenant-2"));
        assertEquals(Optional.of("Canal torre"), channels.name(TENANT, slack.id()));
        assertEquals(Optional.empty(), channels.name("tenant-2", slack.id()));
    }

    @Test
    void aConnectionNeedsANameAndAnHttpUrl() {
        ConnectionChannel c = ConnectionChannel.SLACK;
        assertThrows(IllegalArgumentException.class, () -> channels.create(c, TENANT, null, "https://a.example.com",
                null));
        assertThrows(IllegalArgumentException.class, () -> channels.create(c, TENANT, "a", null, null));
        assertThrows(IllegalArgumentException.class, () -> channels.create(c, TENANT, "a", "hooks.example.com", null));
        assertThrows(IllegalArgumentException.class, () -> channels.create(c, TENANT, "a", "https://a b", null));
        assertTrue(integrations.connections.isEmpty());
    }

    @Test
    void theWebhookBodyCarriesTheEventRuleAndRun() {
        Map<String, Object> payload = ConnectionChannel.WEBHOOK.body(delivery("Asunto", "Texto"));

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
        assertNull(ConnectionChannel.WEBHOOK.body(delivery(null, null)).get("text"));
    }

    @Test
    void theSlackBodyIsTheTitleInBoldThenTheText() {
        assertEquals(Map.of("text", "*Asunto*\nTexto"), ConnectionChannel.SLACK.body(delivery("Asunto", "Texto")));
        assertEquals(Map.of("text", "Texto"), ConnectionChannel.SLACK.body(delivery(null, "Texto")));
        assertEquals(Map.of("text", "symptom.case.opened · symptom_case -7"),
                ConnectionChannel.SLACK.body(delivery(null, null)));
    }

    @Test
    void theTeamsBodyIsOneAdaptiveCard() {
        Map<String, Object> body = ConnectionChannel.TEAMS.body(delivery("Asunto", "Texto"));

        assertEquals("message", body.get("type"));
        List<?> attachments = (List<?>) body.get("attachments");
        assertEquals(1, attachments.size());
        Map<?, ?> attachment = (Map<?, ?>) attachments.get(0);
        assertEquals("application/vnd.microsoft.card.adaptive", attachment.get("contentType"));
        Map<?, ?> card = (Map<?, ?>) attachment.get("content");
        assertEquals("http://adaptivecards.io/schemas/adaptive-card.json", card.get("$schema"));
        assertEquals("AdaptiveCard", card.get("type"));
        assertEquals("1.4", card.get("version"));
        assertEquals(List.of(
                Map.of("type", "TextBlock", "weight", "Bolder", "text", "Asunto", "wrap", true),
                Map.of("type", "TextBlock", "text", "Texto", "wrap", true)), card.get("body"));

        Map<?, ?> untitled = (Map<?, ?>) ((Map<?, ?>) ((List<?>) ConnectionChannel.TEAMS.body(delivery(null, null))
                .get("attachments")).get(0)).get("content");
        assertEquals(List.of(Map.of("type", "TextBlock", "text", "symptom.case.opened · symptom_case -7",
                "wrap", true)), untitled.get("body"));
    }

    @Test
    void theSummaryLeavesOutAMissingContext() {
        StoredEvent bare = new StoredEvent("e-2", TENANT, "job.failed", "miot-jobs", null, null, Map.of(), false, AT,
                AT);
        assertEquals("job.failed", ConnectionChannel.summary(bare));
    }

    @Test
    void theSchemasNameTheBodiesFields() {
        assertEquals(Set.of("event", "at", "context", "rule", "run", "title", "text", "data"),
                properties(ConnectionChannel.WEBHOOK.requestSchema()).keySet());
        assertEquals(Set.of("text"), properties(ConnectionChannel.SLACK.requestSchema()).keySet());
        Map<?, ?> teams = properties(ConnectionChannel.TEAMS.requestSchema());
        assertEquals(Set.of("type", "attachments"), teams.keySet());
        Map<?, ?> attachment = (Map<?, ?>) ((Map<?, ?>) teams.get("attachments")).get("items");
        Map<?, ?> card = (Map<?, ?>) properties(attachment).get("content");
        Map<?, ?> block = (Map<?, ?>) ((Map<?, ?>) properties(card).get("body")).get("items");
        assertEquals(Set.of("type", "weight", "text", "wrap"), properties(block).keySet());
    }

    private static Map<?, ?> properties(Map<?, ?> schema) {
        return (Map<?, ?>) schema.get("properties");
    }
}
