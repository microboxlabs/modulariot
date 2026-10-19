package com.microboxlabs.miot.integrations.api;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.common.http.TestHTTPResource;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import io.quarkus.test.junit.TestProfile;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

@QuarkusTest
@TestProfile(DashboardOperationsHttpTest.Profile.class)
class DashboardOperationsHttpTest {
    private static final String PATH = "/internal/dashboard-operations";
    @TestHTTPResource URI base;
    private static final String KEY = "dashboard-test-service-key-32-characters";

    @ParameterizedTest
    @ValueSource(strings = {PATH, PATH + "/resolve", PATH + "/catalog"})
    void authenticatesBeforeJsonDecodingOrBodySizeValidation(String path) {
        for (String body : new String[]{"not-json", "x".repeat(DashboardOperationsIngress.MAX_BODY_BYTES + 1)}) {
            given().contentType("application/json").body(body).post(path)
                    .then().statusCode(401).header("Cache-Control", "no-store");
        }
    }

    @ParameterizedTest
    @ValueSource(strings = {PATH, PATH + "/resolve", PATH + "/catalog"})
    void boundsDeclaredAndStreamingBodiesBeforeJsonDecoding(String path) {
        byte[] bytes = "x".repeat(DashboardOperationsIngress.MAX_BODY_BYTES + 1).getBytes(StandardCharsets.UTF_8);
        given().header("x-miot-proxy-key", KEY).contentType("application/json").body(bytes).post(path)
                .then().statusCode(413).header("Cache-Control", "no-store");
        given().header("x-miot-proxy-key", KEY).contentType("application/json")
                .body(new ByteArrayInputStream(bytes)).post(path)
                .then().statusCode(413).header("Cache-Control", "no-store");
    }

    @ParameterizedTest
    @ValueSource(strings = {PATH, PATH + "/resolve", PATH + "/catalog"})
    void frameworkErrorsAreNeverCached(String path) {
        given().header("x-miot-proxy-key", KEY).contentType("application/json").body("{").post(path)
                .then().statusCode(400).header("Cache-Control", "no-store");
        given().header("x-miot-proxy-key", KEY).contentType("text/plain").body("{}").post(path)
                .then().statusCode(415).header("Cache-Control", "no-store");
        given().header("x-miot-proxy-key", KEY).get(path)
                .then().statusCode(405).header("Cache-Control", "no-store");
    }

    @ParameterizedTest
    @ValueSource(strings = {PATH, PATH + "/resolve", PATH + "/catalog"})
    void validJsonReachesResourceValidation(String path) {
        given().header("x-miot-proxy-key", KEY).contentType("application/json").body("{}").post(path)
                .then().statusCode(400).header("Cache-Control", "no-store");
    }

    @ParameterizedTest
    @ValueSource(strings = {PATH, PATH + "/resolve", PATH + "/catalog"})
    void acceptsHttp2BodiesAndBoundsUnknownLengthStreams(String path) throws Exception {
        String valid = "{\"tenantId\":\"missing-dashboard-test-org\",\"scopeId\":\"default\",\"dashboardSlug\":\"costs\","
                + "\"userId\":\"test\",\"connectionId\":\"connection\",\"operationId\":\"operation\",\"parameters\":{},"
                + "\"limits\":{\"maxRows\":10,\"maxBytes\":10000}}";
        try (HttpClient client = HttpClient.newHttpClient()) {
            var request = HttpRequest.newBuilder(base.resolve(path)).header("x-miot-proxy-key", KEY)
                    .header("Content-Type", "application/json").POST(HttpRequest.BodyPublishers.ofString(valid)).build();
            var response = client.send(request, HttpResponse.BodyHandlers.ofString());
            assertEquals(HttpClient.Version.HTTP_2, response.version());
            assertEquals(404, response.statusCode());
            assertEquals("no-store", response.headers().firstValue("Cache-Control").orElse(""));
            byte[] bytes = (" ".repeat(DashboardOperationsIngress.MAX_BODY_BYTES) + valid).getBytes(StandardCharsets.UTF_8);
            for (var version : HttpClient.Version.values()) {
                var oversized = HttpRequest.newBuilder(base.resolve(path)).version(version)
                        .header("x-miot-proxy-key", KEY).header("Content-Type", "application/json")
                        .POST(HttpRequest.BodyPublishers.ofInputStream(() -> new ByteArrayInputStream(bytes))).build();
                var rejected = client.send(oversized, HttpResponse.BodyHandlers.discarding());
                assertEquals(version, rejected.version());
                assertEquals(413, rejected.statusCode());
                assertEquals("no-store", rejected.headers().firstValue("Cache-Control").orElse(""));
            }
        }
    }

    public static class Profile extends EventsEndpointM2mAuthBootTest.M2mBootProfile {
        @Override public Map<String, String> getConfigOverrides() {
            Map<String, String> config = super.getConfigOverrides();
            config.put("miot.dashboards.proxy-key", KEY);
            config.put("quarkus.http.auth.permission.dashboard-operations.paths", PATH + "," + PATH + "/resolve");
            config.put("miot.dashboards.plan-resolution.enabled", "true");
            config.put("quarkus.http.auth.permission.dashboard-operations.policy", "permit");
            return config;
        }
    }
}
