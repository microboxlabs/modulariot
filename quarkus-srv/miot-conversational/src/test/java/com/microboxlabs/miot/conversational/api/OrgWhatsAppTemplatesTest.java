package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.accounts.InMemoryChannelAccounts;
import com.microboxlabs.miot.conversational.client.FakeMetaGraph;
import com.microboxlabs.miot.conversational.client.MetaTemplatesClient;
import com.microboxlabs.miot.conversational.rules.RulesFixtureAccess;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplateDraft;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The WhatsApp templates on Meta of the active scope's connection: shapes, status codes, and only owners write. */
class OrgWhatsAppTemplatesTest {

    private static final Duration WAIT = Duration.ofSeconds(5);
    private static final String SCOPE = PlatformScope.SLUG;

    private final FakeMetaGraph graph = new FakeMetaGraph();
    private final List<String> tenants = new ArrayList<>();
    private final RulesFixtureAccess fixture = new RulesFixtureAccess();
    private final WhatsAppTemplatesService whatsApp = new WhatsAppTemplatesService(tenant -> {
        tenants.add(tenant);
        return new ResolvedConnection("conn-1", graph.baseUrl(), Map.of("waba_id", "100000000000001"),
                Map.of("token", "EAAtest-token"));
    }, new MetaTemplatesClient());

    private final OrgConversationsResource owner = resource(BaseRole.OWNER, whatsApp);
    private final OrgConversationsResource member = resource(BaseRole.MEMBER, whatsApp);

    private OrgConversationsResource resource(BaseRole role, WhatsAppTemplatesService templates) {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId(SCOPE);
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode(PlatformScope.TENANT);
        Access access = new Access(PlatformScope.ORGANIZATION_ID, SCOPE, role, Set.of(), Set.of());
        return new OrgConversationsResource(tenant, org, o -> Uni.createFrom().item(access),
                () -> "owner@example.com", new OrgConversationsResource.Services(fixture.service(),
                        fixture.simulator(), fixture.templates(), fixture.runs(), fixture.channels(),
                        new InMemoryChannelAccounts().service, templates));
    }

    @AfterEach
    void stopGraph() {
        graph.close();
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

    private static WhatsAppTemplateDraft draft(String name) {
        return new WhatsAppTemplateDraft(name, null, "UTILITY", null, "Hola {{nombre}}, ¿todo bien?", null, null,
                Map.of("nombre", "Juan"));
    }

    @Test
    void shapesAndWritesOnTheScopesConnection() {
        graph.reply(200, """
                {"data": [{"id": "901", "name": "panic_check", "language": "es_CL", "status": "APPROVED",
                  "category": "UTILITY", "parameter_format": "NAMED",
                  "components": [{"type": "BODY", "text": "Hola {{nombre}}, ¿todo bien?"}]}]}
                """);
        JsonNode list = body(call(member.listWhatsAppTemplates(SCOPE)));
        assertEquals(new TreeSet<>(List.of("id", "name", "language", "category", "status", "rejectedReason",
                "parameterFormat", "headerFormat", "header", "body", "footer", "buttons", "params", "examples")),
                keys(list.get(0)));
        assertEquals("[\"nombre\"]", list.get(0).path("params").toString());
        assertEquals(List.of(PlatformScope.TENANT), tenants, "the platform's WhatsApp connection");

        graph.reply(200, "{\"id\": \"903\", \"status\": \"PENDING\", \"category\": \"UTILITY\"}");
        Response created = call(owner.createWhatsAppTemplate(SCOPE, draft("panic_check_v2")));
        assertEquals(201, created.getStatus());
        assertEquals("903", body(created).path("id").asText());

        graph.reply(200, "{\"success\": true}");
        assertEquals(204, call(owner.deleteWhatsAppTemplate(SCOPE, "panic_check_v2", "903")).getStatus());
        assertEquals("name=panic_check_v2&hsm_id=903", graph.last().query());
    }

    @Test
    void onlyOwnersWrite() {
        for (Uni<Response> refused : List.of(member.createWhatsAppTemplate(SCOPE, draft("x")),
                member.editWhatsAppTemplate(SCOPE, "901", draft(null)),
                member.deleteWhatsAppTemplate(SCOPE, "x", null))) {
            assertEquals(403, call(refused).getStatus());
        }
        assertTrue(graph.seen().isEmpty());
    }

    @Test
    void errorsMapToClearStatuses() {
        Response invalid = call(owner.createWhatsAppTemplate(SCOPE, draft("Bad Name")));
        assertEquals(400, invalid.getStatus());
        assertTrue(body(invalid).path("error").asText().contains("name"));

        graph.reply(400, """
                {"error": {"message": "Invalid parameter", "code": 100,
                 "error_user_title": "Duplicate", "error_user_msg": "The name is taken."}}
                """);
        Response refused = call(owner.createWhatsAppTemplate(SCOPE, draft("panic_check")));
        assertEquals(400, refused.getStatus());
        assertEquals("Meta: Duplicate: The name is taken.", body(refused).path("error").asText());

        graph.reply(400, "{\"error\": {\"message\": \"Error validating access token\", \"code\": 190}}");
        assertEquals(502, call(owner.listWhatsAppTemplates(SCOPE)).getStatus());

        graph.reply(404, "{\"error\": {\"message\": \"Unknown path\", \"code\": 803}}");
        assertEquals(404, call(owner.editWhatsAppTemplate(SCOPE, "901", draft(null))).getStatus());

        graph.reply(503, "upstream down");
        assertEquals(502, call(owner.listWhatsAppTemplates(SCOPE)).getStatus());
    }

    @Test
    void aScopeWithoutAWhatsAppConnectionIsAConflict() {
        WhatsAppTemplatesService none = new WhatsAppTemplatesService(t -> {
            throw new ConnectionResolutionException("No usable WHATSAPP connection is configured");
        }, new MetaTemplatesClient());

        Response response = call(resource(BaseRole.OWNER, none).listWhatsAppTemplates(SCOPE));

        assertEquals(409, response.getStatus());
        assertTrue(body(response).path("error").asText().contains("WHATSAPP"));
    }

    @Test
    void messageTemplatesAreSavedOnlyInThePlatformScope() {
        OrganizationContext org = new OrganizationContext();
        org.setOrganizationId("org-a");
        TenantContext tenant = new TenantContext();
        tenant.setTenantCode(RulesFixtureAccess.TENANT);
        Access access = new Access(1L, "org-a", BaseRole.OWNER, Set.of(), Set.of());
        OrgConversationsResource organization = new OrgConversationsResource(tenant, org,
                o -> Uni.createFrom().item(access), () -> "owner@example.com",
                new OrgConversationsResource.Services(fixture.service(), fixture.simulator(), fixture.templates(),
                        fixture.runs(), fixture.channels(), new InMemoryChannelAccounts().service, whatsApp));

        assertEquals(403, call(organization.saveTemplate("org-a", "panic-check", null)).getStatus());
        assertEquals(403, call(member.saveTemplate(SCOPE, "panic-check", null)).getStatus());
    }
}
