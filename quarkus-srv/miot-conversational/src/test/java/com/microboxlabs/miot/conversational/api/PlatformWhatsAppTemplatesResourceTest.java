package com.microboxlabs.miot.conversational.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.client.FakeMetaGraph;
import com.microboxlabs.miot.conversational.client.MetaTemplatesClient;
import com.microboxlabs.miot.conversational.rules.RulesFixtureAccess;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplateDraft;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.smallrye.mutiny.Uni;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.core.Response;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** The platform's WhatsApp templates on Meta: shapes, status codes, and only platform owners. */
class PlatformWhatsAppTemplatesResourceTest {

    private static final Duration WAIT = Duration.ofSeconds(5);

    private final FakeMetaGraph graph = new FakeMetaGraph();
    private final List<String> tenants = new ArrayList<>();
    private final WhatsAppTemplatesService whatsApp = new WhatsAppTemplatesService(tenant -> {
        tenants.add(tenant);
        return new ResolvedConnection("conn-1", graph.baseUrl(), Map.of("waba_id", "100000000000001"),
                Map.of("token", "EAAtest-token"));
    }, new MetaTemplatesClient());

    private final PlatformWhatsAppTemplatesResource owner =
            new PlatformWhatsAppTemplatesResource(() -> Uni.createFrom().item("owner@example.com"), whatsApp);
    private final PlatformWhatsAppTemplatesResource stranger = new PlatformWhatsAppTemplatesResource(
            () -> Uni.createFrom().failure(new ForbiddenException("Platform owner role required")), whatsApp);

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
    void shapesAndWritesOnThePlatformConnection() {
        graph.reply(200, """
                {"data": [{"id": "901", "name": "panic_check", "language": "es_CL", "status": "APPROVED",
                  "category": "UTILITY", "parameter_format": "NAMED",
                  "components": [{"type": "BODY", "text": "Hola {{nombre}}, ¿todo bien?"}]}]}
                """);
        JsonNode list = body(call(owner.list()));
        assertEquals(new TreeSet<>(List.of("id", "name", "language", "category", "status", "rejectedReason",
                "parameterFormat", "headerFormat", "header", "body", "footer", "buttons", "params", "examples")),
                keys(list.get(0)));
        assertEquals("[\"nombre\"]", list.get(0).path("params").toString());
        assertEquals(List.of(PlatformMailService.PLATFORM_TENANT), tenants, "the platform's WhatsApp connection");

        graph.reply(200, "{\"id\": \"903\", \"status\": \"PENDING\", \"category\": \"UTILITY\"}");
        Response created = call(owner.create(draft("panic_check_v2")));
        assertEquals(201, created.getStatus());
        assertEquals("903", body(created).path("id").asText());

        graph.reply(200, "{\"success\": true}");
        assertEquals(204, call(owner.delete("panic_check_v2", "903")).getStatus());
        assertEquals("name=panic_check_v2&hsm_id=903", graph.last().query());
    }

    @Test
    void onlyPlatformOwners() {
        for (Uni<Response> refused : List.of(stranger.list(), stranger.create(draft("x")),
                stranger.edit("901", draft(null)), stranger.delete("x", null))) {
            assertThrows(ForbiddenException.class, () -> call(refused));
        }
        assertTrue(graph.seen().isEmpty());
    }

    @Test
    void errorsMapToClearStatuses() {
        Response invalid = call(owner.create(draft("Bad Name")));
        assertEquals(400, invalid.getStatus());
        assertTrue(body(invalid).path("error").asText().contains("name"));

        graph.reply(400, """
                {"error": {"message": "Invalid parameter", "code": 100,
                 "error_user_title": "Duplicate", "error_user_msg": "The name is taken."}}
                """);
        Response refused = call(owner.create(draft("panic_check")));
        assertEquals(400, refused.getStatus());
        assertEquals("Meta: Duplicate: The name is taken.", body(refused).path("error").asText());

        graph.reply(400, "{\"error\": {\"message\": \"Error validating access token\", \"code\": 190}}");
        assertEquals(502, call(owner.list()).getStatus());

        graph.reply(404, "{\"error\": {\"message\": \"Unknown path\", \"code\": 803}}");
        assertEquals(404, call(owner.edit("901", draft(null))).getStatus());

        graph.reply(503, "upstream down");
        assertEquals(502, call(owner.list()).getStatus());
    }

    @Test
    void aPlatformWithoutAWhatsAppConnectionIsAConflict() {
        WhatsAppTemplatesService none = new WhatsAppTemplatesService(t -> {
            throw new ConnectionResolutionException("No usable WHATSAPP connection is configured");
        }, new MetaTemplatesClient());
        PlatformWhatsAppTemplatesResource r =
                new PlatformWhatsAppTemplatesResource(() -> Uni.createFrom().item("owner@example.com"), none);

        Response response = call(r.list());

        assertEquals(409, response.getStatus());
        assertTrue(body(response).path("error").asText().contains("WHATSAPP"));
    }
}
