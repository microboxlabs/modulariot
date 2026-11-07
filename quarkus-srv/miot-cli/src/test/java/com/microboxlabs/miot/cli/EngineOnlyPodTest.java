package com.microboxlabs.miot.cli;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.test.common.http.TestHTTPResource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.QuarkusTestProfile;
import io.quarkus.test.junit.TestProfile;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.time.Duration;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Starts the modulith with the symptom engine's environment (docs/deployment.md in miot-symptoms): only the symptoms
 * component and no API. Without a database, broker or Docker, so the Pulsar channels are off here.
 */
@QuarkusTest
@TestProfile(EngineOnlyPodTest.Profile.class)
class EngineOnlyPodTest {

    @TestHTTPResource
    URI baseUri;

    @Test
    void theApiAnswers404() throws Exception {
        assertEquals(404, get("/api/v1/orgs/test-org/control-tower/device-events", "POST"));
        assertEquals(404, get("/api/v1/platform/orgs", "GET"));
        assertEquals(404, get("/webhooks/whatsapp/1", "GET"));
    }

    @Test
    void healthIsServed() throws Exception {
        assertEquals(200, get("/q/health/live", "GET"));
    }

    private int get(String path, String method) throws Exception {
        try (HttpClient client = HttpClient.newHttpClient()) {
            HttpRequest request = HttpRequest.newBuilder(baseUri.resolve(path))
                    .timeout(Duration.ofSeconds(10))
                    .header("Content-Type", "application/json")
                    .method(method, "POST".equals(method)
                            ? HttpRequest.BodyPublishers.ofString("{}") : HttpRequest.BodyPublishers.noBody())
                    .build();
            return client.send(request, HttpResponse.BodyHandlers.ofString()).statusCode();
        }
    }

    public static class Profile implements QuarkusTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            return Map.ofEntries(
                    Map.entry("miot.component.all.enabled", "false"),
                    Map.entry("miot.component.fleet.enabled", "false"),
                    Map.entry("miot.component.tracking.enabled", "false"),
                    Map.entry("miot.component.gateway.enabled", "false"),
                    Map.entry("miot.component.integrations.enabled", "false"),
                    Map.entry("miot.component.conversational.enabled", "false"),
                    Map.entry("miot.component.trips.enabled", "false"),
                    Map.entry("miot.component.places.enabled", "false"),
                    Map.entry("miot.component.symptoms.enabled", "true"),
                    Map.entry("miot.api.enabled", "false"),
                    Map.entry("miot.conversational.rules.events.enabled", "true"),
                    // No broker in tests: the engine's channels follow these.
                    Map.entry("miot.symptoms.cdc.enabled", "false"),
                    Map.entry("miot.symptoms.signal-builder.enabled", "false"),
                    Map.entry("quarkus.devservices.enabled", "false"),
                    Map.entry("quarkus.datasource.jdbc.url", "jdbc:postgresql://127.0.0.1:1/engine_test"),
                    Map.entry("quarkus.datasource.reactive.url", "postgresql://127.0.0.1:1/engine_test"),
                    Map.entry("quarkus.datasource.username", "test"),
                    Map.entry("quarkus.datasource.password", "test"),
                    Map.entry("quarkus.datasource.jdbc.initial-size", "0"),
                    Map.entry("quarkus.datasource.jdbc.min-size", "0"),
                    Map.entry("quarkus.datasource.health.enabled", "false"),
                    Map.entry("quarkus.datasource.gps.active", "false"),
                    Map.entry("quarkus.datasource.\"gps-read\".active", "false"),
                    Map.entry("quarkus.hibernate-orm.active", "false"),
                    Map.entry("miot.flyway.enabled", "false"),
                    Map.entry("quarkus.arc.exclude-types", "com.microboxlabs.miot.symptoms.cases.StaleCaseSweep"),
                    Map.entry("quarkus.scheduler.enabled", "false"),
                    Map.entry("quarkus.http.test-port", "0"));
        }
    }
}
