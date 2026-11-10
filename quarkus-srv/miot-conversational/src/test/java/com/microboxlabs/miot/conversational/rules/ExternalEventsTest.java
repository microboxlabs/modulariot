package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.jobs.ConversationEventJob;
import com.microboxlabs.miot.conversational.jobs.ConversationEventsDeclareJob;
import com.microboxlabs.miot.conversational.rules.ExternalEvents.Declaration;
import com.microboxlabs.miot.conversational.rules.ExternalEvents.FieldDeclaration;
import com.microboxlabs.miot.conversational.rules.ExternalEvents.TypeDeclaration;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * A system outside the modulith declares its event types and publishes events through jobs; the organization's
 * rules start on them, and a Teams step sends the template's card.
 */
class ExternalEventsTest {

    private static final ObjectMapper JSON = new ObjectMapper();
    private static final String SHIPPED = "erp.order.shipped";
    private static final Map<String, Object> DECLARATION = Map.of("source", "erp", "contextKind", "service",
            "types", List.of(Map.of("type", SHIPPED, "description", "An order left the warehouse",
                    "fields", List.of(Map.of("name", "order", "label", "Pedido"),
                            Map.of("name", "photos", "type", "array"))),
                    Map.of("type", "erp.order.cancelled", "description", "An order was cancelled")));

    private final RulesFixture f = new RulesFixture();
    private final ConversationEventsDeclareJob declare = new ConversationEventsDeclareJob(f.externalEvents);
    private final ConversationEventJob publish = new ConversationEventJob(f.engine, f.externalEvents, f.clock);

    @BeforeEach
    void declared() {
        JobOutcome outcome = declare.handle(TENANT, DECLARATION);
        assertEquals(JobOutcome.SUCCEEDED, outcome.outcome());
        assertEquals(List.of("erp.order.shipped", "erp.order.cancelled"), outcome.result().get("types"));
    }

    private static Map<String, Object> event(String key) {
        Map<String, Object> e = new LinkedHashMap<>();
        e.put("type", SHIPPED);
        e.put("source", "erp");
        e.put("key", key);
        e.put("at", "2026-10-23T15:00:00Z");
        e.put("context", Map.of("key", "4521"));
        e.put("data", Map.of("order", "4521", "photos",
                List.of(Map.of("name", "front.jpg", "url", "https://files.example.com/1"))));
        return e;
    }

    /** A Teams rule on the shipped order, with a template that has a card. */
    private String teamsRule() {
        String teams = f.integrations.channels.create(ConnectionChannel.TEAMS, TENANT, "Despacho",
                "https://hooks.example.com/teams", null).id();
        f.templates.save("order-shipped", new TemplatesService.TemplateRequest("Pedido despachado",
                "Pedido {{order}} despachado", null, null,
                new ConvTemplate.Teams("Pedido {{order}}", null, null, "Salió de bodega",
                        new ConvTemplate.Teams.Images("photos", "Foto {{n}}"),
                        List.of(new ConvTemplate.Teams.Fact("Pedido", "{{order}}")), List.of(),
                        List.of(new ConvTemplate.Teams.Action("Ver", "https://app.example.com/{{order}}")))),
                "owner@example.com");
        f.rule("shipped", """
                {"trigger": {"event": "erp.order.shipped"}, "groups": [],
                 "steps": [{"channel": "teams", "connection": "%s", "template": "order-shipped"}]}
                """.formatted(teams), Rule.State.ACTIVE);
        return teams;
    }

    @Test
    void theCatalogListsTheDeclaredTypesWithTheirFields() {
        List<EventCatalog.EventTypeView> events = f.service.events(TENANT);
        EventCatalog.EventTypeView shipped = events.stream().filter(e -> SHIPPED.equals(e.type())).findFirst()
                .orElseThrow();
        assertEquals("erp", shipped.source());
        assertEquals("service", shipped.contextKind());
        assertEquals(List.of("order", "photos"), shipped.fields().stream().map(EventCatalog.Field::name).toList());
        assertEquals("Pedido", shipped.fields().get(0).label());
        assertTrue(shipped.variables().stream().anyMatch(v -> "fecha".equals(v.name())));
        assertTrue(f.service.events(ConvTemplate.PLATFORM_TENANT).stream().noneMatch(e -> SHIPPED.equals(e.type())));
        assertTrue(f.service.events("other-tenant").stream().noneMatch(e -> SHIPPED.equals(e.type())));
    }

    @Test
    void aPublishedEventStartsTheRuleAndTeamsGetsTheCard() throws Exception {
        String teams = teamsRule();
        JobOutcome outcome = publish.handle(TENANT, event("shipment-4521"));
        assertEquals(JobOutcome.SUCCEEDED, outcome.outcome());
        assertEquals(1, ((List<?>) outcome.result().get("runs")).size());
        f.engine.runDue();

        assertEquals(1, f.integrations.calls.size());
        InMemoryIntegrations.Call call = f.integrations.calls.get(0);
        assertEquals(teams, call.connectionId());
        JsonNode card = JSON.valueToTree(call.body()).at("/attachments/0/content");
        assertEquals("Pedido 4521", card.at("/body/0/text").asText());
        assertEquals("Salió de bodega", card.at("/body/1/text").asText());
        assertEquals("Foto 1", card.at("/body/2/columns/0/items/0/text").asText());
        assertEquals("https://files.example.com/1", card.at("/body/2/columns/0/items/1/url").asText());
        assertEquals("4521", card.at("/body/3/facts/0/value").asText());
        assertEquals("https://app.example.com/4521", card.at("/actions/0/url").asText());

        StoredEvent stored = f.engine.event((String) outcome.result().get("eventId")).orElseThrow();
        assertEquals("erp", stored.source());
        assertEquals("service", stored.contextKind());
        assertEquals("4521", stored.contextKey());
    }

    @Test
    void theSameKeyIsAcceptedOnce() {
        teamsRule();
        assertEquals(JobOutcome.SUCCEEDED, publish.handle(TENANT, event("shipment-4521")).outcome());
        JobOutcome again = publish.handle(TENANT, event("shipment-4521"));
        assertEquals(JobOutcome.SKIPPED, again.outcome());
        assertEquals(JobOutcome.SUCCEEDED, publish.handle(TENANT, event("shipment-4522")).outcome());
        f.engine.runDue();
        assertEquals(2, f.integrations.calls.size());
    }

    @Test
    void theSimulationShowsTheBodyTeamsWouldGet() {
        teamsRule();
        String id = f.service.list(TENANT).get(0).id();
        RuleSimulator.Simulation sim = f.simulator.simulate(TENANT, id, new RuleSimulator.SampleEvent(SHIPPED,
                new RuleSimulator.SampleContext("service", "4521"), Map.of("order", "4521"), false, T0));
        assertTrue(sim.matches());
        assertEquals(1, sim.messages().size());
        JsonNode body = JSON.valueToTree(sim.messages().get(0).body());
        assertEquals("Pedido 4521", body.at("/attachments/0/content/body/0/text").asText());
        assertTrue(f.integrations.calls.isEmpty());
    }

    @Test
    void anUndeclaredTypeRetriesAndABadEventParks() {
        Map<String, Object> unknown = event("k");
        unknown.put("type", "erp.order.lost");
        assertThrows(IllegalStateException.class, () -> publish.handle(TENANT, unknown));

        Map<String, Object> otherSource = event("k");
        otherSource.put("source", "crm");
        assertThrows(NonRetryableJobException.class, () -> publish.handle(TENANT, otherSource));

        Map<String, Object> badAt = event("k");
        badAt.put("at", "yesterday");
        assertThrows(NonRetryableJobException.class, () -> publish.handle(TENANT, badAt));

        Map<String, Object> badData = event("k");
        badData.put("data", "text");
        assertThrows(NonRetryableJobException.class, () -> publish.handle(TENANT, badData));
    }

    @Test
    void aDeclarationReplacesTheSourcesTypesAndCannotTakeOthers() {
        f.externalEvents.declare(TENANT, new Declaration("erp", null, List.of(new TypeDeclaration(SHIPPED, "v2",
                null, List.of(new FieldDeclaration("order", null, null, null))))));
        List<ExternalEventType> types = f.externalEvents.list(TENANT);
        assertEquals(List.of(SHIPPED), types.stream().map(ExternalEventType::type).toList());
        assertEquals("v2", types.get(0).description());
        assertEquals("order", types.get(0).fields().get(0).label());
        assertEquals("string", types.get(0).fields().get(0).type());

        assertThrows(IllegalArgumentException.class, () -> f.externalEvents.declare(TENANT,
                new Declaration("crm", null, List.of(new TypeDeclaration("erp.order.shipped", null, null, null)))));
        assertThrows(IllegalArgumentException.class, () -> f.externalEvents.declare(TENANT,
                new Declaration("symptom", null,
                        List.of(new TypeDeclaration("symptom.case.opened", null, null, null)))));
        assertThrows(IllegalArgumentException.class, () -> f.externalEvents.declare(TENANT,
                new Declaration("Bad Source", null, List.of())));
        assertThrows(IllegalArgumentException.class, () -> f.externalEvents.declare(TENANT,
                new Declaration("erp", null, List.of(new TypeDeclaration(SHIPPED, null, null,
                        List.of(new FieldDeclaration("a b", null, null, null)))))));
        assertThrows(NonRetryableJobException.class, () -> declare.handle(TENANT, Map.of("source", "erp",
                "types", List.of(Map.of("type", "other.thing")))));
        assertEquals(List.of(SHIPPED), f.externalEvents.list(TENANT).stream().map(ExternalEventType::type).toList());
    }

    @Test
    void aRuleOnAnUndeclaredTypeDoesNotValidate() {
        RuleSpec spec = RuleSpec.read(json("""
                {"trigger": {"event": "erp.order.lost"}, "groups": [], "steps": []}
                """));
        assertTrue(f.service.validate(TENANT, spec).stream().anyMatch(x -> "noEvent".equals(x.code())));
        RuleSpec ok = RuleSpec.read(json("""
                {"trigger": {"event": "erp.order.shipped"}, "groups": [], "steps": []}
                """));
        assertTrue(f.service.validate(TENANT, ok).stream().noneMatch(x -> "noEvent".equals(x.code())));
    }
}
