package com.microboxlabs.miot.integrations.retransmit;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.sun.net.httpserver.HttpServer;
import io.vertx.core.json.JsonObject;
import java.net.InetSocketAddress;
import java.net.http.HttpClient;
import java.nio.charset.StandardCharsets;
import java.time.Clock;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Optional;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

class GaussHeartbeatJobTest {

    private static final Instant NOW = Instant.parse("2026-11-17T13:00:00Z");

    private HttpServer server;
    private final List<Received> received = new CopyOnWriteArrayList<>();
    private int status = 200;

    record Received(String path, String apiKey, String tenant, JsonObject body) {}

    @BeforeEach
    void startServer() throws Exception {
        server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
        server.createContext("/", exchange -> {
            String body = new String(exchange.getRequestBody().readAllBytes(), StandardCharsets.UTF_8);
            received.add(new Received(
                    exchange.getRequestURI().getPath(),
                    exchange.getRequestHeaders().getFirst("X-Provider-Api-Key"),
                    exchange.getRequestHeaders().getFirst("X-Target-Tenant"),
                    new JsonObject(body)));
            byte[] out = "{\"status\":\"success\"}".getBytes(StandardCharsets.UTF_8);
            exchange.sendResponseHeaders(status, out.length);
            exchange.getResponseBody().write(out);
            exchange.close();
        });
        server.start();
    }

    @AfterEach
    void stopServer() {
        server.stop(0);
    }

    private String base() {
        return "http://127.0.0.1:" + server.getAddress().getPort();
    }

    private GaussHeartbeatJob job(boolean enabled, Optional<String> url) {
        GaussAuthClient auth = new GaussAuthClient(
                Optional.of("gck_test"), Optional.of("site-a"), Optional.empty(), Optional.empty(),
                Optional.empty(), Optional.empty(), Optional.empty(), Optional.empty());
        return new GaussHeartbeatJob(
                auth, enabled, url, Duration.ofMinutes(30), Duration.ofMinutes(10), "streamhub", false,
                Clock.fixed(NOW, ZoneOffset.UTC), HttpClient.newHttpClient());
    }

    private static JsonObject position(String deviceId, String start, String driverCode) {
        JsonObject p = new JsonObject()
                .put("start", start)
                .put("vehicleCode", "ABCD12")
                .put("deviceId", deviceId)
                .put("deviceType", "GPS")
                .put("deviceModel", "streamhub-miot");
        p.put("driverCode", driverCode);
        return p;
    }

    @Test
    void sendsOneHeartbeatPerAcceptedDeviceToTheHeartbeatPath() {
        GaussHeartbeatJob job = job(true, Optional.empty());
        String upload = base() + "/v3/processor/events/positionupdate/upload";
        job.record(position("acme-gps-ABCD12", "2026-11-17 12:58:00", "15343634"), upload);
        job.record(position("acme-gps-ABCD12", "2026-11-17 12:55:00", null), upload); // older: ignored
        job.record(position("beta-ABCD34", "2026-11-17 12:40:00", null), upload);

        job.sendHeartbeats();

        assertEquals(2, received.size());
        Received fresh = received.stream()
                .filter(r -> r.body().getString("deviceId").equals("acme-gps-ABCD12"))
                .findFirst()
                .orElseThrow();
        assertEquals("/v1/processor/events/heartbeat", fresh.path());
        assertEquals("gck_test", fresh.apiKey());
        assertEquals("site-a", fresh.tenant());
        JsonObject body = fresh.body();
        assertEquals("2026-11-17 13:00:00", body.getString("timestamp"));
        assertEquals("GPS", body.getString("deviceType"));
        assertEquals("streamhub-miot", body.getString("deviceModel"));
        assertEquals("streamhub", body.getString("deviceBrand"));
        JsonObject context = body.getJsonObject("context");
        assertEquals("ABCD12", context.getString("vehicleCode"));
        assertEquals("15343634", context.getString("driverCode"));
        assertEquals("ok", context.getString("message"));
        assertTrue(context.size() <= 5);

        JsonObject stale = received.stream()
                .filter(r -> r.body().getString("deviceId").equals("beta-ABCD34"))
                .findFirst()
                .orElseThrow()
                .body()
                .getJsonObject("context");
        assertEquals("stale", stale.getString("message"));
        assertFalse(stale.containsKey("driverCode"));
    }

    @Test
    void rejectionsDoNotDropTheDevice() {
        status = 422;
        GaussHeartbeatJob job = job(true, Optional.of(base() + "/custom/heartbeat"));
        job.record(position("d1", "2026-11-17 12:59:00", null), "https://ignored.example/upload");

        job.sendHeartbeats();

        assertEquals(1, received.size());
        assertEquals("/custom/heartbeat", received.get(0).path());
        assertEquals(1, job.trackedDevices());
    }

    @Test
    void disabledJobRecordsNothing() {
        GaussHeartbeatJob job = job(false, Optional.empty());
        job.record(position("d1", "2026-11-17 12:59:00", null), base() + "/upload");
        job.sendHeartbeats();
        assertEquals(0, job.trackedDevices());
        assertTrue(received.isEmpty());
    }

    @Test
    void derivesHeartbeatUrlFromPositionUrl() {
        GaussHeartbeatJob job = job(true, Optional.empty());
        assertEquals(
                "https://testing-api.gausscontrol.com/v1/processor/events/heartbeat",
                job.heartbeatUrl("https://testing-api.gausscontrol.com/v3/processor/events/positionupdate/upload"));
        assertNull(job.heartbeatUrl("not a url"));
        assertNull(job.heartbeatUrl(null));
    }
}
