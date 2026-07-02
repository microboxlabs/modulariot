package com.microboxlabs.miot.conversational.client;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.io.IOException;
import java.net.InetSocketAddress;
import java.net.URI;
import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.concurrent.atomic.AtomicReference;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

class MetaWhatsAppClientTest {

    private static final String PHONE_NUMBER_ID = "1188646904321987";
    private static final String TOKEN = "EAAtest-token";
    private static final String WAMID = "wamid.HBgLtest";
    private static final String TO = "+56912345678";
    private static final String OK_RESPONSE = "{\"messages\":[{\"id\":\"" + WAMID + "\"}]}";

    private final MetaWhatsAppClient client = new MetaWhatsAppClient();

    private HttpServer server;
    private final AtomicReference<String> seenAuth = new AtomicReference<>();
    private final AtomicReference<String> seenPath = new AtomicReference<>();
    private final AtomicReference<String> seenBody = new AtomicReference<>();

    @AfterEach
    void tearDown() {
        if (server != null) {
            server.stop(0);
        }
    }

    @Test
    void sendTextPostsTextPayloadAndReturnsWamid() throws IOException {
        startServer(200, OK_RESPONSE);

        String id = client.sendText(URI.create(baseUrl()), PHONE_NUMBER_ID, TOKEN, TO, "Hola");

        assertEquals(WAMID, id);
        assertEquals("Bearer " + TOKEN, seenAuth.get());
        assertEquals("/" + PHONE_NUMBER_ID + "/messages", seenPath.get());
        JsonObject body = new JsonObject(seenBody.get());
        assertEquals("whatsapp", body.getString("messaging_product"));
        assertEquals(TO, body.getString("to"));
        assertEquals("text", body.getString("type"));
        assertEquals("Hola", body.getJsonObject("text").getString("body"));
    }

    @Test
    void sendTemplateBuildsTemplatePayloadWithNamedBodyParams() throws IOException {
        startServer(200, OK_RESPONSE);
        Map<String, String> namedParams = new LinkedHashMap<>();
        namedParams.put("driver_name", "Juan");
        namedParams.put("trip_reference", "SRV-123");

        String id = client.sendTemplate(URI.create(baseUrl()), PHONE_NUMBER_ID, TOKEN, TO,
                "trip_detention_alert_v1", "es_CL", namedParams);

        assertEquals(WAMID, id);
        JsonObject body = new JsonObject(seenBody.get());
        assertEquals("template", body.getString("type"));
        JsonObject template = body.getJsonObject("template");
        assertEquals("trip_detention_alert_v1", template.getString("name"));
        assertEquals("es_CL", template.getJsonObject("language").getString("code"));
        JsonArray params = template.getJsonArray("components").getJsonObject(0).getJsonArray("parameters");
        assertEquals(2, params.size());
        assertEquals("driver_name", params.getJsonObject(0).getString("parameter_name"));
        assertEquals("Juan", params.getJsonObject(0).getString("text"));
        assertEquals("trip_reference", params.getJsonObject(1).getString("parameter_name"));
        assertEquals("SRV-123", params.getJsonObject(1).getString("text"));
    }

    @Test
    void throwsWithHttpStatusAndMetaMessageWhenRejected() throws IOException {
        startServer(400, "{\"error\":{\"message\":\"Invalid parameter\",\"code\":100}}");
        URI uri = URI.create(baseUrl());

        WhatsAppSendException ex = assertThrows(WhatsAppSendException.class,
                () -> client.sendText(uri, PHONE_NUMBER_ID, TOKEN, TO, "Hola"));

        assertEquals(400, ex.httpStatus());
        assertTrue(ex.getMessage().contains("Invalid parameter"));
    }

    private void startServer(int status, String responseBody) throws IOException {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            seenAuth.set(exchange.getRequestHeaders().getFirst("Authorization"));
            seenPath.set(exchange.getRequestURI().getPath());
            seenBody.set(new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8));
            byte[] payload = responseBody.getBytes(StandardCharsets.UTF_8);
            exchange.getResponseHeaders().add("Content-Type", "application/json");
            exchange.sendResponseHeaders(status, payload.length);
            exchange.getResponseBody().write(payload);
            exchange.close();
        });
        server.start();
    }

    private String baseUrl() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }
}
