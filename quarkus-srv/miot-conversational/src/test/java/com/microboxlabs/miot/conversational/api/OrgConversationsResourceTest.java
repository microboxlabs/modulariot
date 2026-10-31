package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.access.ConversationsAccessCatalog;
import com.microboxlabs.miot.conversational.accounts.ChannelMode;
import com.microboxlabs.miot.conversational.accounts.InMemoryChannelAccounts;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.AccountModeRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.CreateRuleRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.CreateConnectionRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.DraftRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.InvokeRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.PublishRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.SimulateRequest;
import com.microboxlabs.miot.conversational.api.OrgConversationsResource.StateRequest;
import com.microboxlabs.miot.conversational.rules.Invocation;
import com.microboxlabs.miot.conversational.rules.Rule;
import com.microboxlabs.miot.conversational.rules.RuleBump;
import com.microboxlabs.miot.conversational.rules.RulesFixtureAccess;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleContext;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.integrations.domain.ProviderType;
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
import org.junit.jupiter.api.Test;

/**
 * Every endpoint of {@code /conversations} over in-memory stores: status codes, who may write, and the exact JSON
 * keys the app reads.
 */
class OrgConversationsResourceTest {

    private static final String ORG = "org-a";
    private static final Duration WAIT = Duration.ofSeconds(5);

    private final RulesFixtureAccess fixture = new RulesFixtureAccess();
    private final InMemoryChannelAccounts accounts = new InMemoryChannelAccounts();

    private OrgConversationsResource resource(Access access) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(ORG);
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode(RulesFixtureAccess.TENANT);
        return new OrgConversationsResource(tenant, org, o -> Uni.createFrom().item(access),
                () -> "owner@example.com", new OrgConversationsResource.Services(fixture.service(),
                        fixture.simulator(), fixture.templates(), fixture.runs(), fixture.channels(),
                        accounts.service, null, fixture.invocations()));
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
        assertEquals(set("rule", "current", "draft", "versions", "plan", "findings"), keys(detail));
        assertEquals(0, detail.path("findings").size(), "the new rule's draft has no findings");
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
        assertEquals(2, body(call(member.getRule(ORG, id))).path("findings").size(),
                "the detail carries the saved draft's findings");

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
        assertTrue(detail.path("findings").isNull(), "no draft, no findings");
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
        assertNotEquals(same, later, "the fixture has a waitForReply to change");
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
    void theOrganizationReadsThePlatformTemplatesWithItsOwnRules() {
        String id = createPanicRule();

        JsonNode t = body(call(member.getTemplate(ORG, "panic-check")));
        assertEquals(set("id", "key", "name", "baseText", "whatsapp", "email", "version", "updatedAt", "updatedBy",
                "usedBy"), keys(t));
        assertEquals("0.1.0", t.path("version").asText());
        assertEquals(set("metaName", "language", "params"), keys(t.path("whatsapp")));
        assertTrue(t.path("email").isNull());
        assertEquals(set("id", "key", "name", "state"), keys(t.path("usedBy").get(0)),
                "an organization does not see whose rules they are");
        assertEquals(id, t.path("usedBy").get(0).path("id").asText());

        assertEquals(2, body(call(member.listTemplates(ORG))).size());
        JsonNode tower = body(call(member.getTemplate(ORG, "panic-tower")));
        assertEquals(set("subject", "body"), keys(tower.path("email")));
        assertEquals(404, call(member.getTemplate(ORG, "nope")).getStatus());
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
    void anIntegrationInvokesThePublishedRuleAndOnlyAWriterTheDraft() {
        String id = createPanicRule();
        OrgConversationsResource integration =
                resource(access(BaseRole.MEMBER, Set.of(ConversationsAccessCatalog.RULE_INVOKE)));
        InvokeRequest current = new InvokeRequest(null, null, null, "OT-1-salida");
        assertEquals(409, call(integration.invoke(ORG, id, current)).getStatus(), "never published");
        call(owner.publish(ORG, id, new PublishRequest("first", null)));
        assertEquals(409, call(integration.invoke(ORG, id, current)).getStatus(), "the rule is OFF");
        call(owner.setState(ORG, id, new StateRequest(Rule.State.ACTIVE)));

        assertEquals(403, call(member.invoke(ORG, id, current)).getStatus());
        Response started = call(integration.invoke(ORG, id, current));
        assertEquals(200, started.getStatus());
        assertEquals("0.1.0", body(started).path("ruleVersion").asText());
        assertEquals(body(started).path("id"), body(call(integration.invoke(ORG, id, current))).path("id"),
                "the same key starts nothing new");

        InvokeRequest draft = new InvokeRequest("draft", null, null, null);
        assertEquals(403, call(integration.invoke(ORG, id, draft)).getStatus());
        assertEquals("draft", body(call(maintainer.invoke(ORG, id, draft))).path("ruleVersion").asText());
        assertEquals(400, call(owner.invoke(ORG, id, new InvokeRequest("0.1.0", null, null, null))).getStatus());
        assertEquals(400, call(owner.invoke(ORG, id, new InvokeRequest(null, null,
                Map.of("nope", List.of(new Invocation.Person("A", "a@example.com", null))), null))).getStatus());
    }

    @Test
    void writesNeedAnOwnerOrTheMaintainer() {
        Response refused = call(member.createRule(ORG, new CreateRuleRequest("panic", "Pánico", null)));
        assertEquals(403, refused.getStatus());

        assertEquals(201, call(maintainer.createRule(ORG, new CreateRuleRequest("panic", "Pánico", null)))
                .getStatus());
        assertEquals(409, call(owner.createRule(ORG, new CreateRuleRequest("panic", "Otra", null))).getStatus());
        assertEquals(400, call(owner.createRule(ORG, new CreateRuleRequest("Pánico!", "x", null))).getStatus());
        assertEquals(404, call(member.getRule(ORG, "missing")).getStatus());
        assertTrue(OrgConversationsResource.canWrite(access(BaseRole.ADMIN, Set.of())));
        assertFalse(OrgConversationsResource.canWrite(Access.none(1L, ORG)));
    }

    @Test
    void theWebhookChannelListsItsContractAndConnections() {
        JsonNode empty = body(call(member.connectionChannel(ORG, "webhook")));
        assertEquals(set("operation", "requestSchema", "connections"), keys(empty));
        assertEquals("deliver", empty.path("operation").asText());
        assertEquals(set("event", "at", "context", "rule", "run", "title", "text", "data"),
                keys(empty.path("requestSchema").path("properties")));
        assertEquals(0, empty.path("connections").size());

        CreateConnectionRequest request =
                new CreateConnectionRequest("Torre externa", "https://hooks.example.com/miot", null);
        assertEquals(403, call(member.createChannelConnection(ORG, "webhook", request)).getStatus());
        Response created = call(maintainer.createChannelConnection(ORG, "webhook", request));
        assertEquals(201, created.getStatus());
        JsonNode connection = body(created);
        assertEquals(set("id", "name", "host", "status", "lastTestedAt", "lastTestResult"), keys(connection));
        assertEquals("hooks.example.com", connection.path("host").asText());
        assertEquals("ACTIVE", connection.path("status").asText(), "the status the store gave it");

        JsonNode listed = body(call(member.connectionChannel(ORG, "webhook"))).path("connections");
        assertEquals(1, listed.size());
        assertEquals(connection.path("id").asText(), listed.get(0).path("id").asText());
        assertEquals("hooks.example.com", listed.get(0).path("host").asText());

        assertEquals(400, call(owner.createChannelConnection(ORG, "webhook",
                new CreateConnectionRequest("x", "ftp://hooks.example.com", null))).getStatus());
        assertEquals(400, call(owner.createChannelConnection(ORG, "webhook",
                new CreateConnectionRequest(" ", "https://hooks.example.com", null))).getStatus());
        assertEquals(400, call(owner.createChannelConnection(ORG, "webhook", null)).getStatus());
    }

    @Test
    void slackAndTeamsListOnlyTheirOwnConnections() {
        CreateConnectionRequest slack =
                new CreateConnectionRequest("Canal torre", "https://hooks.example.com/slack", null);
        assertEquals(201, call(owner.createChannelConnection(ORG, "slack", slack)).getStatus());

        JsonNode slackView = body(call(member.connectionChannel(ORG, "Slack")));
        assertEquals(set("text"), keys(slackView.path("requestSchema").path("properties")));
        assertEquals(1, slackView.path("connections").size());
        assertEquals("Canal torre", slackView.path("connections").get(0).path("name").asText());

        JsonNode teamsView = body(call(member.connectionChannel(ORG, "teams")));
        assertEquals(set("type", "attachments"), keys(teamsView.path("requestSchema").path("properties")));
        assertEquals(0, teamsView.path("connections").size());
        assertEquals(0, body(call(member.connectionChannel(ORG, "webhook"))).path("connections").size());
    }

    @Test
    void anUnknownChannelIs404() {
        assertEquals(404, call(member.connectionChannel(ORG, "sms")).getStatus());
        assertEquals(404, call(owner.createChannelConnection(ORG, "sms",
                new CreateConnectionRequest("x", "https://hooks.example.com", null))).getStatus());
        assertEquals(404, call(member.createChannelConnection(ORG, "whatsapp",
                new CreateConnectionRequest("x", "https://hooks.example.com", null))).getStatus());
    }

    @Test
    void anOwnerChoosesTheOrganizationsOwnAccountOnceItIsConnected() {
        JsonNode list = body(call(member.listAccounts(ORG)));
        assertEquals("whatsapp", list.get(0).path("channel").asText());
        assertEquals("PLATFORM", list.get(0).path("mode").asText());
        assertFalse(list.get(0).path("ownConnected").asBoolean());

        AccountModeRequest own = new AccountModeRequest(ChannelMode.OWN);
        assertEquals(403, call(member.setAccountMode(ORG, "whatsapp", own)).getStatus());
        assertEquals(403, call(maintainer.setAccountMode(ORG, "whatsapp", own)).getStatus());
        assertEquals(403, call(resource(access(BaseRole.ADMIN, Set.of())).setAccountMode(ORG, "whatsapp", own))
                .getStatus());
        assertEquals(409, call(owner.setAccountMode(ORG, "whatsapp", own)).getStatus());
        assertEquals(400, call(owner.setAccountMode(ORG, "sms", own)).getStatus());

        accounts.connect(RulesFixtureAccess.TENANT, ProviderType.WHATSAPP);
        JsonNode set = body(call(owner.setAccountMode(ORG, "whatsapp", own)));
        assertEquals("OWN", set.path("mode").asText());
        assertEquals("owner@example.com", set.path("updatedBy").asText());
        assertEquals("OWN", body(call(member.listAccounts(ORG))).get(0).path("mode").asText());
    }

    @Test
    void anotherOrganizationInThePathIsRefused() {
        WebApplicationException e = assertThrows(WebApplicationException.class, () -> owner.listRules("org-b"));
        assertEquals(403, e.getResponse().getStatus());
    }
}
