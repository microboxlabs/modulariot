package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.client.FakeMetaGraph;
import com.microboxlabs.miot.conversational.client.MetaGraphException;
import com.microboxlabs.miot.conversational.client.MetaTemplatesClient;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplate.Button;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService.CopyResult;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService.CopyStatus;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import io.vertx.core.json.JsonObject;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class WhatsAppTemplatesServiceTest {

    static final String WABA = "100000000000001";
    static final String TOKEN = "EAAtest-token";

    /** One approved NAMED template and one rejected POSITIONAL one, as Meta lists them. */
    static final String LIST = """
            {"data": [
              {"id": "902", "name": "trip_reminder", "language": "en_US", "status": "REJECTED",
               "category": "MARKETING", "rejected_reason": "INVALID_FORMAT", "parameter_format": "POSITIONAL",
               "components": [{"type": "BODY", "text": "Trip {{1}} at {{2}}.",
                               "example": {"body_text": [["SRV-1", "10:00"]]}}]},
              {"id": "901", "name": "panic_check", "language": "es_CL", "status": "APPROVED",
               "category": "UTILITY", "rejected_reason": "NONE", "parameter_format": "NAMED",
               "components": [
                 {"type": "HEADER", "format": "TEXT", "text": "Alerta {{patente}}",
                  "example": {"header_text_named_params": [{"param_name": "patente", "example": "TEST01"}]}},
                 {"type": "BODY", "text": "Hola {{nombre}}, ¿estás bien? {{patente}} activó el botón.",
                  "example": {"body_text_named_params": [{"param_name": "nombre", "example": "Juan"},
                                                         {"param_name": "patente", "example": "TEST01"}]}},
                 {"type": "FOOTER", "text": "Operaciones"},
                 {"type": "BUTTONS", "buttons": [{"type": "QUICK_REPLY", "text": "Estoy bien"},
                   {"type": "PHONE_NUMBER", "text": "Llamar", "phone_number": "+15550000000"}]}]}
            ], "paging": {"cursors": {"before": "B", "after": "A"}}}
            """;

    private final FakeMetaGraph graph = new FakeMetaGraph();
    private Map<String, Object> metadata = Map.of("waba_id", WABA, "phone_number_id", "200000000000002");
    private Map<String, Object> secret = Map.of("token", TOKEN);
    private final WhatsAppTemplatesService service = new WhatsAppTemplatesService(
            tenant -> new ResolvedConnection("conn-1", graph.baseUrl(), metadata, secret),
            new MetaTemplatesClient());

    @AfterEach
    void tearDown() {
        graph.close();
    }

    @Test
    void listFlattensMetaComponentsAndSortsByName() {
        graph.reply(200, LIST);

        List<WhatsAppTemplate> list = service.list("tenant-a");

        assertEquals(List.of("panic_check", "trip_reminder"), list.stream().map(WhatsAppTemplate::name).toList());
        WhatsAppTemplate panic = list.get(0);
        assertEquals("901", panic.id());
        assertEquals("APPROVED", panic.status());
        assertNull(panic.rejectedReason());
        assertEquals("NAMED", panic.parameterFormat());
        assertEquals("TEXT", panic.headerFormat());
        assertEquals("Alerta {{patente}}", panic.header());
        assertEquals("Operaciones", panic.footer());
        assertEquals(List.of("nombre", "patente"), panic.params());
        assertEquals(Map.of("nombre", "Juan", "patente", "TEST01"), panic.examples());
        assertEquals(List.of(new Button("QUICK_REPLY", "Estoy bien", null, null),
                new Button("PHONE_NUMBER", "Llamar", null, "+15550000000")), panic.buttons());

        WhatsAppTemplate reminder = list.get(1);
        assertEquals("INVALID_FORMAT", reminder.rejectedReason());
        assertEquals(List.of("1", "2"), reminder.params());
        assertEquals(Map.of("1", "SRV-1", "2", "10:00"), reminder.examples());
        assertNull(reminder.headerFormat());
    }

    @Test
    void createValidatesBeforeCallingMeta() {
        WhatsAppTemplateDraft bad = new WhatsAppTemplateDraft("Bad Name", null, "UTILITY", null, "Hola", null,
                null, Map.of());

        assertThrows(IllegalArgumentException.class, () -> service.create("tenant-a", bad));
        assertThrows(IllegalArgumentException.class, () -> service.create("tenant-a", null));
        assertTrue(graph.seen().isEmpty());
    }

    @Test
    void createSubmitsAndReturnsThePendingTemplate() {
        graph.reply(200, "{\"id\": \"903\", \"status\": \"PENDING\", \"category\": \"MARKETING\"}");
        WhatsAppTemplateDraft draft = new WhatsAppTemplateDraft("panic_check_v2", null, "UTILITY", null,
                "Hola {{nombre}}, ¿todo bien?", null, List.of(), Map.of("nombre", "Juan", "unused", "x"));

        WhatsAppTemplate created = service.create("tenant-a", draft);

        assertEquals("903", created.id());
        assertEquals("PENDING", created.status());
        assertEquals("MARKETING", created.category());
        assertEquals("es_CL", created.language());
        assertEquals(List.of("nombre"), created.params());
        assertEquals(Map.of("nombre", "Juan"), created.examples());
        assertEquals("/v25.0/" + WABA + "/message_templates", graph.last().path());
        assertEquals("Bearer " + TOKEN, graph.last().auth());
        assertEquals("panic_check_v2", new JsonObject(graph.last().body()).getString("name"));
    }

    @Test
    void editPostsTheComponentsThenReadsTheTemplateBack() {
        graph.reply(200, LIST).reply(200, "{\"success\": true}").reply(200, """
                {"id": "901", "name": "panic_check", "language": "es_CL", "status": "PENDING",
                 "category": "UTILITY", "components": [{"type": "BODY", "text": "Hola {{nombre}}, ¿todo bien?"}]}
                """);
        WhatsAppTemplateDraft draft = new WhatsAppTemplateDraft(null, null, "UTILITY", null,
                "Hola {{nombre}}, ¿todo bien?", null, null, Map.of("nombre", "Juan"));

        WhatsAppTemplate edited = service.edit("tenant-a", "901", draft);

        assertEquals("PENDING", edited.status());
        assertEquals("/v25.0/" + WABA + "/message_templates", graph.seen().get(0).path());
        assertEquals("/v25.0/901", graph.seen().get(1).path());
        assertEquals("POST", graph.seen().get(1).method());
        assertTrue(new JsonObject(graph.seen().get(1).body()).containsKey("components"));
        assertEquals("GET", graph.seen().get(2).method());
        assertThrows(IllegalArgumentException.class, () -> service.edit("tenant-a", "../x", draft));
    }

    @Test
    void editRefusesATemplateOutsideTheConnectionsWaba() {
        graph.reply(200, LIST);
        WhatsAppTemplateDraft draft = new WhatsAppTemplateDraft(null, null, "UTILITY", null,
                "Hola {{nombre}}, ¿todo bien?", null, null, Map.of("nombre", "Juan"));

        assertThrows(NoSuchElementException.class, () -> service.edit("tenant-a", "999", draft));
        assertEquals(1, graph.seen().size());
        assertEquals("GET", graph.last().method());
    }

    @Test
    void deleteChecksTheNameAndId() {
        graph.reply(200, "{\"success\": true}");

        service.delete("tenant-a", "panic_check", "901");

        assertEquals("name=panic_check&hsm_id=901", graph.last().query());
        assertThrows(IllegalArgumentException.class, () -> service.delete("tenant-a", "Panic", null));
        assertThrows(IllegalArgumentException.class, () -> service.delete("tenant-a", "ok", "abc"));
        assertEquals(1, graph.seen().size());
    }

    @Test
    void aConnectionWithoutWabaIdOrTokenIsAConfigurationProblem() {
        metadata = Map.of("phone_number_id", "200000000000002");
        assertThrows(ConnectionResolutionException.class, () -> service.list("tenant-a"));
        metadata = Map.of("waba_id", WABA);
        secret = Map.of();
        assertThrows(ConnectionResolutionException.class, () -> service.list("tenant-a"));
        assertTrue(graph.seen().isEmpty());
    }

    private static final String ORG_WABA = "300000000000003";

    /** The platform's WABA is {@link #WABA}; any other tenant's is {@link #ORG_WABA}. */
    private final WhatsAppTemplatesService twoAccounts = new WhatsAppTemplatesService(
            tenant -> new ResolvedConnection("conn-" + tenant, graph.baseUrl(),
                    Map.of("waba_id", PlatformScope.TENANT.equals(tenant) ? WABA : ORG_WABA), secret),
            new MetaTemplatesClient());

    @Test
    void copyingSubmitsThePlatformsTemplatesToTheOrganizationsAccount() {
        graph.reply(200, "{\"data\": []}").reply(200, LIST)
                .reply(200, "{\"id\": \"903\", \"status\": \"PENDING\", \"category\": \"UTILITY\"}");

        List<CopyResult> results = twoAccounts.copyFromPlatform("tenant-a", null);

        // trip_reminder is REJECTED on the platform, so only panic_check is copied.
        assertEquals(List.of(new CopyResult("panic_check", "es_CL", CopyStatus.COPIED, null)), results);
        assertEquals(3, graph.seen().size());
        assertEquals("/v25.0/" + ORG_WABA + "/message_templates", graph.seen().get(0).path());
        assertEquals("/v25.0/" + WABA + "/message_templates", graph.seen().get(1).path());
        assertEquals("POST", graph.last().method());
        assertEquals("/v25.0/" + ORG_WABA + "/message_templates", graph.last().path());
        JsonObject created = new JsonObject(graph.last().body());
        assertEquals("panic_check", created.getString("name"));
        assertEquals("es_CL", created.getString("language"));
        assertEquals("UTILITY", created.getString("category"));
    }

    @Test
    void copyingLeavesTemplatesTheAccountHasAndNamesTheMissingOnes() {
        graph.reply(200, LIST).reply(200, LIST);

        List<CopyResult> results = twoAccounts.copyFromPlatform("tenant-a", List.of("panic_check", "nope"));

        assertEquals(new CopyResult("panic_check", "es_CL", CopyStatus.EXISTS, null), results.get(0));
        assertEquals("nope", results.get(1).name());
        assertEquals(CopyStatus.FAILED, results.get(1).status());
        assertEquals(2, graph.seen().size());
    }

    @Test
    void aNamedTemplateMetaHasNotApprovedIsNotCopied() {
        graph.reply(200, "{\"data\": []}").reply(200, LIST);

        List<CopyResult> results = twoAccounts.copyFromPlatform("tenant-a", List.of("trip_reminder"));

        assertEquals(1, results.size());
        assertEquals(CopyStatus.FAILED, results.get(0).status());
        assertTrue(results.get(0).error().contains("REJECTED"));
        assertEquals(2, graph.seen().size());
    }

    @Test
    void thePlatformDoesNotCopyToItself() {
        assertThrows(IllegalArgumentException.class, () -> twoAccounts.copyFromPlatform(PlatformScope.TENANT, null));
        assertTrue(graph.seen().isEmpty());
    }

    @Test
    void metaErrorsPassThrough() {
        graph.reply(400, "{\"error\": {\"message\": \"Invalid parameter\", \"code\": 100}}");
        assertThrows(MetaGraphException.class, () -> service.list("tenant-a"));
    }
}
