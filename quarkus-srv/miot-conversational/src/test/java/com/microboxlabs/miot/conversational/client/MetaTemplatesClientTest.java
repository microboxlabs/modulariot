package com.microboxlabs.miot.conversational.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.core.json.JsonObject;
import java.net.URI;
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class MetaTemplatesClientTest {

    private static final String WABA = "100000000000001";
    private static final String TOKEN = "EAAtest-token";

    private final FakeMetaGraph graph = new FakeMetaGraph();
    private final MetaTemplatesClient client = new MetaTemplatesClient();

    @AfterEach
    void tearDown() {
        graph.close();
    }

    @Test
    void listFollowsTheAfterCursorUntilTheLastPage() {
        graph.reply(200, """
                {"data": [{"name": "a"}, {"name": "b"}],
                 "paging": {"cursors": {"before": "B1", "after": "A1"}, "next": "https://graph.facebook.com/x"}}
                """).reply(200, """
                {"data": [{"name": "c"}], "paging": {"cursors": {"before": "B2", "after": "A2"}}}
                """);

        List<JsonObject> all = client.list(graph.baseUrl(), WABA, TOKEN);

        assertEquals(List.of("a", "b", "c"), all.stream().map(t -> t.getString("name")).toList());
        assertEquals(2, graph.seen().size());
        FakeMetaGraph.Seen first = graph.seen().get(0);
        assertEquals("GET", first.method());
        assertEquals("/v25.0/" + WABA + "/message_templates", first.path());
        assertEquals("Bearer " + TOKEN, first.auth());
        assertTrue(first.query().contains("fields=" + MetaTemplatesClient.FIELDS));
        assertTrue(first.query().contains("limit=100"));
        assertFalse(first.query().contains("after="));
        assertTrue(graph.seen().get(1).query().endsWith("&after=A1"));
    }

    @Test
    void createPostsTheTemplateToTheWaba() {
        graph.reply(200, "{\"id\": \"900\", \"status\": \"PENDING\", \"category\": \"UTILITY\"}");

        JsonObject out = client.create(graph.baseUrl(), WABA, TOKEN, new JsonObject().put("name", "x"));

        assertEquals("900", out.getString("id"));
        assertEquals("POST", graph.last().method());
        assertEquals("/v25.0/" + WABA + "/message_templates", graph.last().path());
        assertEquals("x", new JsonObject(graph.last().body()).getString("name"));
    }

    @Test
    void editPostsToTheTemplateId() {
        graph.reply(200, "{\"success\": true}");

        client.edit(graph.baseUrl(), "900", TOKEN, new JsonObject().put("category", "UTILITY"));

        assertEquals("POST", graph.last().method());
        assertEquals("/v25.0/900", graph.last().path());
    }

    @Test
    void deleteSendsTheNameAndTheIdWhenGiven() {
        graph.reply(200, "{\"success\": true}").reply(200, "{\"success\": true}");

        client.delete(graph.baseUrl(), WABA, TOKEN, "trip_alert", null);
        assertEquals("DELETE", graph.last().method());
        assertEquals("name=trip_alert", graph.last().query());

        client.delete(graph.baseUrl(), WABA, TOKEN, "trip_alert", "900");
        assertEquals("name=trip_alert&hsm_id=900", graph.last().query());
    }

    @Test
    void errorsCarryMetaTextForPeopleAndItsCode() {
        graph.reply(400, """
                {"error": {"message": "Invalid parameter", "code": 100, "error_subcode": 2388023,
                 "error_user_title": "Language already exists", "error_user_msg": "Try another name."}}
                """);
        URI base = graph.baseUrl();
        JsonObject empty = new JsonObject();

        MetaGraphException e = assertThrows(MetaGraphException.class,
                () -> client.create(base, WABA, TOKEN, empty));

        assertEquals("Meta: Language already exists: Try another name.", e.getMessage());
        assertEquals(400, e.httpStatus());
        assertEquals(100, e.code());
        assertTrue(e.isClientError());
    }

    @Test
    void anInvalidTokenIsNotTheCallersError() {
        MetaGraphException e = MetaTemplatesClient.error(
                "{\"error\": {\"message\": \"Error validating access token\", \"code\": 190}}", 400);
        assertEquals("Meta: Error validating access token", e.getMessage());
        assertFalse(e.isClientError());

        MetaGraphException plain = MetaTemplatesClient.error("<html>", 503);
        assertEquals("Meta Graph API returned HTTP 503", plain.getMessage());
        assertNull(plain.code());
        assertFalse(plain.isClientError());
    }
}
