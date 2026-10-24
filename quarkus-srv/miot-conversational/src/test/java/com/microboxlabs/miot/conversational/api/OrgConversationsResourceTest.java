package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.CreateRuleRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.DraftRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.PublishRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.SimulateRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.StateRequest;
import com.microboxlabs.miot.conversational.client.FakeMetaGraph;
import com.microboxlabs.miot.conversational.client.MetaTemplatesClient;
import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.RulesFixtureAccess;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleContext;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import com.microboxlabs.miot.conversational.rules.TemplatesService.TemplateRequest;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplateDraft;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.WebApplicationException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/**
 * Every endpoint of {@code /conversations} over in-memory stores: status codes, who may write, and the exact JSON
 * keys the app reads.
 */
class OrgConversationsResourceTest {

    private static final String ORG = "org-a";
    private static final Duration WAIT = Duration.ofSeconds(5);

    private final RulesFixtureAccess fixture = new RulesFixtureAccess();
    private final FakeMetaGraph graph = new FakeMetaGraph();
    private final WhatsAppTemplatesService whatsApp = new WhatsAppTemplatesService(
            tenant -> new ResolvedConnection("conn-1", graph.baseUrl(), Map.of("waba_id", "100000000000001"),
                    Map.of("token", "EAAtest-token")),
            new MetaTemplatesClient());

    @AfterEach
    void stopGraph() {
        graph.close();
    }

    private OrgConversationsResource resource(Access access) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode(RulesFixtureAccess.TENANT);
        return new OrgConversationsResource(tenant, org, o -> Uni.createFrom().item(access),
                () -> "owner@example.com", new OrgConversationsResource.Services(fixture.service(),
                        fixture.simulator(), fixture.templates(), fixture.runs(), whatsApp));
    }

    private final OrgConversationsResource owner = resource(access(BaseRole.OWNER, Set.of()));
    private final OrgConversationsResource member = resource(access(BaseRole.MEMBER, Set.of()));
    private final OrgConversationsResource maintainer =
            resource(access(BaseRole.MEMBER, Set.of(OrgConversationsResource.MAINTAINER_PERMISSION)));

    private static Access access(BaseRole role, Set<String> permissions) {
        return new Access(1L, ORG, role, Set.of(), permissions);
    }

    private static Response call(Uni<Response> uni) {
        return uni.await().atMost(WAIT);
    }

    private static JsonNode body(Response r) {
        return RulesFixtureAccess.JSON.valueToTree(r.getEntity());
    }

    private static Set<String> keys(JsonNode node) {
        Set<String> out = new TreeSet<>();
        node.fieldNames().forEachRemaining(out::add);
        return out;
    }

    private static Set<String> set(String... names) {
        return new TreeSet<>(List.of(names));
    }

    private String createPanicRule() {
        Response created = call(owner.createRule(ORG,
                new CreateRuleRequest("panic", "Botón de pánico", RulesFixtureAccess.json(RulesFixtureAccess.PANIC))));
        assertEquals(201, created.getStatus());
        return body(created).path("rule").path("id").asText();
    }

    @Test
    void rulesListShape() {
        String id = createPanicRule();
        call(owner.publish(ORG, id, new PublishRequest("first", null)));

        JsonNode list = body(call(member.listRules(ORG)));

        assertEquals(1, list.size());
        JsonNode r = list.get(0);
        assertEquals(set("id", "key", "name", "state", "currentVersion", "hasDraft", "trigger", "stepsCount",
                "channels", "symptomKey", "updatedAt"), keys(r));
        assertEquals("OFF", r.path("state").asText());
        assertEquals("0.1.0", r.path("currentVersion").asText());
        assertFalse(r.path("hasDraft").asBoolean());
        assertEquals(set("event", "when"), keys(r.path("trigger")));
        assertEquals("symptom.case.opened", r.path("trigger").path("event").asText());
        assertEquals(2, r.path("stepsCount").asInt());
        assertEquals("[\"whatsapp\",\"email\"]", r.path("channels").toString());
        assertEquals("panic-button", r.path("symptomKey").asText());
    }

    @Test
    void ruleDetailShapeAndDraftFindings() {
        String id = createPanicRule();
        JsonNode detail = body(call(member.getRule(ORG, id)));
        assertEquals(set("rule", "current", "draft", "versions", "plan"), keys(detail));
        assertEquals("MINOR", detail.path("plan").path("bump").asText());
        assertEquals("0.1.0", detail.path("plan").path("nextVersion").asText());
        assertEquals(set("id", "key", "name", "state", "currentVersion", "createdAt", "updatedAt"),
                keys(detail.path("rule")));
        assertTrue(detail.path("current").isNull());
        assertEquals(set("id", "version", "bump", "status", "spec", "reason", "createdAt", "createdBy"),
                keys(detail.path("draft")));
        assertEquals("DRAFT", detail.path("draft").path("status").asText());
        assertTrue(detail.path("draft").path("version").isNull());
        assertEquals("owner@example.com", detail.path("draft").path("createdBy").asText());
        assertEquals(0, detail.path("versions").size());

        Response saved = call(owner.saveDraft(ORG, id, new DraftRequest(RulesFixtureAccess.json("""
                {"trigger": {"event": "symptom.case.opened", "when": "event.data.level >="},
                 "audience": [], "steps": [], "note": "kept"}
                """))));
        assertEquals(200, saved.getStatus());
        JsonNode draft = body(saved);
        assertEquals(set("draft", "findings"), keys(draft));
        assertEquals("kept", draft.path("draft").path("spec").path("note").asText(), "the spec is stored as sent");
        JsonNode finding = draft.path("findings").get(0);
        assertEquals(set("section", "severity", "code", "params", "message", "position"), keys(finding));
        List<String> codes = new ArrayList<>();
        draft.path("findings").forEach(x -> codes.add(x.path("code").asText()));
        assertEquals(List.of("whenInvalid", "noSteps"), codes);

        Response refused = call(owner.publish(ORG, id, new PublishRequest("broken", null)));
        assertEquals(409, refused.getStatus());
        assertEquals(2, body(refused).path("findings").size());
    }

    @Test
    void publishAndState() {
        String id = createPanicRule();
        assertEquals(409, call(owner.setState(ORG, id, new StateRequest(Rule.State.ACTIVE))).getStatus(),
                "a rule without a published version cannot be switched on");

        Response published = call(owner.publish(ORG, id, new PublishRequest("first", null)));
        assertEquals(200, published.getStatus());
        JsonNode version = body(published);
        assertEquals(set("id", "version", "bump", "status", "spec", "reason", "createdAt", "createdBy"), keys(version));
        assertEquals("0.1.0", version.path("version").asText());
        assertEquals("MINOR", version.path("bump").asText());
        assertEquals("PUBLISHED", version.path("status").asText());
        assertEquals("first", version.path("reason").asText());
        assertEquals(409, call(owner.publish(ORG, id, new PublishRequest("again", null))).getStatus(), "no draft");

        Response state = call(owner.setState(ORG, id, new StateRequest(Rule.State.TEST)));
        assertEquals(200, state.getStatus());
        assertEquals(set("id", "key", "name", "state", "currentVersion", "createdAt", "updatedAt"),
                keys(body(state)));
        assertEquals("TEST", body(state).path("state").asText());
        assertEquals(400, call(owner.setState(ORG, id, new StateRequest(null))).getStatus());

        JsonNode detail = body(call(member.getRule(ORG, id)));
        assertEquals("0.1.0", detail.path("current").path("version").asText());
        assertTrue(detail.path("draft").isNull());
        assertTrue(detail.path("plan").isNull(), "no draft, no plan");
        assertEquals(1, detail.path("versions").size());
    }

    @Test
    void laterPublishesBumpByWhatChangedAndMayBeRaised() {
        String id = createPanicRule();
        call(owner.publish(ORG, id, new PublishRequest("first", null)));
        String same = RulesFixtureAccess.PANIC;
        call(owner.saveDraft(ORG, id, new DraftRequest(RulesFixtureAccess.json(same))));
        JsonNode unchanged = body(call(member.getRule(ORG, id)));
        assertTrue(unchanged.path("plan").path("bump").isNull(), "the same spec calls for no version");
        assertEquals(409, call(owner.publish(ORG, id, new PublishRequest("same", null))).getStatus());

        String later = same.replaceFirst("\"waitForReply\"\\s*:\\s*\\d+", "\"waitForReply\": 9");
        assertTrue(!later.equals(same), "the fixture has a waitForReply to change");
        call(owner.saveDraft(ORG, id, new DraftRequest(RulesFixtureAccess.json(later))));
        JsonNode plan = body(call(member.getRule(ORG, id))).path("plan");
        assertEquals("PATCH", plan.path("bump").asText());
        assertEquals("0.1.1", plan.path("nextVersion").asText());

        JsonNode raised = body(call(owner.publish(ORG, id, new PublishRequest("big change", RuleBump.MAJOR))));
        assertEquals("1.0.0", raised.path("version").asText());
        assertEquals("MAJOR", raised.path("bump").asText());
    }

    @Test
    void simulateShowsTheTimeline() {
        String id = createPanicRule();
        Instant at = Instant.parse("2026-10-23T15:04:00Z");
        SampleEvent sample = new SampleEvent("symptom.case.opened", new SampleContext("symptom_case", "-1"),
                Map.of("symptomKey", "panic-button", "level", 4, "assetId", "ABCD12"), false, at);

        JsonNode sim = body(call(member.simulate(ORG, id, new SimulateRequest(sample))));

        assertEquals(set("matches", "recipients", "messages", "findings"), keys(sim));
        assertTrue(sim.path("matches").asBoolean());
        assertEquals(set("address", "channel", "name", "role"), keys(sim.path("recipients").get(0)));
        assertEquals(RulesFixtureAccess.DRIVER, sim.path("recipients").get(0).path("address").asText());
        assertEquals(2, sim.path("messages").size());
        JsonNode first = sim.path("messages").get(0);
        assertEquals(set("step", "at", "channel", "to", "text"), keys(first));
        assertEquals(0, first.path("step").asInt());
        assertEquals("2026-10-23T15:04:00Z", first.path("at").asText());
        assertEquals("whatsapp", first.path("channel").asText());
        assertEquals(set("address", "channel", "name"), keys(first.path("to")));
        assertEquals("Hola Ana, se activó el botón de pánico en ABCD12 a las 12:04. ¿Estás bien?",
                first.path("text").asText());
        JsonNode second = sim.path("messages").get(1);
        assertEquals(1, second.path("step").asInt());
        assertEquals("2026-10-23T15:09:00Z", second.path("at").asText());
        assertEquals("tower@example.com", second.path("to").path("address").asText());

        SampleEvent other = new SampleEvent("symptom.case.opened", new SampleContext("symptom_case", "-1"),
                Map.of("symptomKey", "speeding", "level", 4), false, at);
        JsonNode none = body(call(member.simulate(ORG, id, new SimulateRequest(other))));
        assertFalse(none.path("matches").asBoolean());
        assertEquals(0, none.path("messages").size());
        assertEquals(400, call(member.simulate(ORG, id, new SimulateRequest(null))).getStatus());
        assertTrue(fixture.sentNothing(), "a simulation sends and stores nothing");
    }

    @Test
    void templatesWithUsedBy() {
        String id = createPanicRule();

        Response saved = call(owner.saveTemplate(ORG, "panic-check", new TemplateRequest("Pánico conductor",
                "Hola {{nombre}}", new ConvTemplate.WhatsApp("miot_panic_check_v2", "es_CL", List.of("nombre")),
                null)));
        assertEquals(200, saved.getStatus());
        JsonNode t = body(saved);
        assertEquals(set("id", "key", "name", "baseText", "whatsapp", "email", "updatedAt", "updatedBy", "usedBy"),
                keys(t));
        assertEquals(set("metaName", "language", "params"), keys(t.path("whatsapp")));
        assertTrue(t.path("email").isNull());
        assertEquals(set("id", "key", "name", "state"), keys(t.path("usedBy").get(0)));
        assertEquals(id, t.path("usedBy").get(0).path("id").asText());

        assertEquals(2, body(call(member.listTemplates(ORG))).size());
        JsonNode tower = body(call(member.getTemplate(ORG, "panic-tower")));
        assertEquals(set("subject", "body"), keys(tower.path("email")));
        assertEquals(404, call(member.getTemplate(ORG, "nope")).getStatus());
        assertEquals(400, call(owner.saveTemplate(ORG, "Bad Key", new TemplateRequest("x", null, null, null)))
                .getStatus());
        assertEquals(400, call(owner.saveTemplate(ORG, "ok", new TemplateRequest("x", null,
                new ConvTemplate.WhatsApp(null, null, null), null))).getStatus());
    }

    @Test
    void catalogAndRuns() {
        JsonNode catalog = body(call(member.catalog(ORG)));
        assertEquals(set("type", "source", "description", "contextKind", "fields", "variables"),
                keys(catalog.get(0)));
        assertEquals(set("name", "label", "description", "type"), keys(catalog.get(0).path("fields").get(0)));

        String id = createPanicRule();
        call(owner.publish(ORG, id, new PublishRequest("first", null)));
        call(owner.setState(ORG, id, new StateRequest(Rule.State.TEST)));
        fixture.openPanicCaseAndRun();

        JsonNode runs = body(call(member.listRuns(ORG, id, "waiting", 10)));
        assertEquals(1, runs.size());
        JsonNode run = runs.get(0);
        assertEquals(set("id", "ruleId", "ruleName", "ruleVersion", "eventId", "eventType", "contextKind",
                "contextKey", "symptomName", "assetId", "test", "status", "step", "nextAt", "lastError", "createdAt",
                "updatedAt", "messages"), keys(run));
        assertEquals("Botón de pánico", run.path("ruleName").asText());
        assertEquals("Botón de pánico", run.path("symptomName").asText());
        assertEquals("ABCD12", run.path("assetId").asText());
        assertEquals("symptom.case.opened", run.path("eventType").asText());
        assertTrue(run.path("test").asBoolean());
        JsonNode message = run.path("messages").get(0);
        assertEquals(set("id", "step", "channel", "to", "toName", "status", "text", "at"), keys(message));
        assertEquals("SIMULATED", message.path("status").asText());
        assertEquals("Ana", message.path("toName").asText());
        assertEquals(0, body(call(member.listRuns(ORG, null, "DONE", null))).size());
        assertEquals(400, call(member.listRuns(ORG, null, "LATER", null)).getStatus());
    }

    @Test
    void writesNeedAnOwnerOrTheMaintainer() {
        Response refused = call(member.createRule(ORG, new CreateRuleRequest("panic", "Pánico", null)));
        assertEquals(403, refused.getStatus());
        assertEquals(403, call(member.saveTemplate(ORG, "x", new TemplateRequest("x", null, null, null))).getStatus());

        assertEquals(201, call(maintainer.createRule(ORG, new CreateRuleRequest("panic", "Pánico", null)))
                .getStatus());
        assertEquals(409, call(owner.createRule(ORG, new CreateRuleRequest("panic", "Otra", null))).getStatus());
        assertEquals(400, call(owner.createRule(ORG, new CreateRuleRequest("Pánico!", "x", null))).getStatus());
        assertEquals(404, call(member.getRule(ORG, "missing")).getStatus());
        assertTrue(OrgConversationsResource.canWrite(access(BaseRole.ADMIN, Set.of())));
        assertFalse(OrgConversationsResource.canWrite(Access.none(1L, ORG)));
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        WebApplicationException e = assertThrows(WebApplicationException.class, () -> owner.listRules("org-b"));
        assertEquals(403, e.getResponse().getStatus());
    }

    private static WhatsAppTemplateDraft whatsAppDraft(String name) {
        return new WhatsAppTemplateDraft(name, null, "UTILITY", null, "Hola {{nombre}}, ¿todo bien?", null, null,
                Map.of("nombre", "Juan"));
    }

    @Test
    void whatsAppTemplatesShapeAndWrites() {
        graph.reply(200, """
                {"data": [{"id": "901", "name": "panic_check", "language": "es_CL", "status": "APPROVED",
                  "category": "UTILITY", "parameter_format": "NAMED",
                  "components": [{"type": "BODY", "text": "Hola {{nombre}}, ¿todo bien?"}]}]}
                """);
        JsonNode list = body(call(member.listWhatsAppTemplates(ORG)));
        assertEquals(set("id", "name", "language", "category", "status", "rejectedReason", "parameterFormat",
                "headerFormat", "header", "body", "footer", "buttons", "params", "examples"), keys(list.get(0)));
        assertEquals("[\"nombre\"]", list.get(0).path("params").toString());

        graph.reply(200, "{\"id\": \"903\", \"status\": \"PENDING\", \"category\": \"UTILITY\"}");
        Response created = call(maintainer.createWhatsAppTemplate(ORG, whatsAppDraft("panic_check_v2")));
        assertEquals(201, created.getStatus());
        assertEquals("903", body(created).path("id").asText());

        graph.reply(200, "{\"success\": true}");
        assertEquals(204, call(owner.deleteWhatsAppTemplate(ORG, "panic_check_v2", "903")).getStatus());
        assertEquals("name=panic_check_v2&hsm_id=903", graph.last().query());
    }

    @Test
    void whatsAppTemplateWritesNeedAnOwnerOrTheMaintainer() {
        assertEquals(403, call(member.createWhatsAppTemplate(ORG, whatsAppDraft("x"))).getStatus());
        assertEquals(403, call(member.editWhatsAppTemplate(ORG, "901", whatsAppDraft(null))).getStatus());
        assertEquals(403, call(member.deleteWhatsAppTemplate(ORG, "x", null)).getStatus());
        assertTrue(graph.seen().isEmpty());
    }

    @Test
    void whatsAppTemplateErrorsMapToClearStatuses() {
        Response invalid = call(owner.createWhatsAppTemplate(ORG, whatsAppDraft("Bad Name")));
        assertEquals(400, invalid.getStatus());
        assertTrue(body(invalid).path("error").asText().contains("name"));

        graph.reply(400, """
                {"error": {"message": "Invalid parameter", "code": 100,
                 "error_user_title": "Duplicate", "error_user_msg": "The name is taken."}}
                """);
        Response refused = call(owner.createWhatsAppTemplate(ORG, whatsAppDraft("panic_check")));
        assertEquals(400, refused.getStatus());
        assertEquals("Meta: Duplicate: The name is taken.", body(refused).path("error").asText());

        graph.reply(400, "{\"error\": {\"message\": \"Error validating access token\", \"code\": 190}}");
        assertEquals(502, call(member.listWhatsAppTemplates(ORG)).getStatus());

        graph.reply(404, "{\"error\": {\"message\": \"Unknown path\", \"code\": 803}}");
        assertEquals(404, call(owner.editWhatsAppTemplate(ORG, "901", whatsAppDraft(null))).getStatus());

        graph.reply(503, "upstream down");
        assertEquals(502, call(member.listWhatsAppTemplates(ORG)).getStatus());
    }

    @Test
    void aMissingWhatsAppConnectionIsAConflict() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode(RulesFixtureAccess.TENANT);
        WhatsAppTemplatesService none = new WhatsAppTemplatesService(t -> {
            throw new ConnectionResolutionException("No usable WHATSAPP connection is configured");
        }, new MetaTemplatesClient());
        OrgConversationsResource r = new OrgConversationsResource(tenant, org,
                o -> Uni.createFrom().item(access(BaseRole.OWNER, Set.of())), () -> "owner@example.com",
                new OrgConversationsResource.Services(fixture.service(), fixture.simulator(), fixture.templates(),
                        fixture.runs(), none));

        Response response = call(r.listWhatsAppTemplates(ORG));

        assertEquals(409, response.getStatus());
        assertTrue(body(response).path("error").asText().contains("WHATSAPP"));
    }
}
