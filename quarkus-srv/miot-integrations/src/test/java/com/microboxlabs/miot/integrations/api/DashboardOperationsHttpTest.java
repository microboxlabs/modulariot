package com.microboxlabs.miot.integrations.api;

import static io.restassured.RestAssured.given;

import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import java.io.ByteArrayInputStream;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import org.junit.jupiter.api.Test;

@QuarkusTest
@TestProfile(DashboardOperationsHttpTest.Profile.class)
class DashboardOperationsHttpTest {
    private static final String PATH = "/internal/dashboard-operations";
    private static final String KEY = "dashboard-test-service-key-32-characters";

    @Test
    void authenticatesBeforeJsonDecodingOrBodySizeValidation() {
        for (String body : new String[]{"not-json", "x".repeat(DashboardOperationsIngress.MAX_BODY_BYTES + 1)}) {
            given().contentType("application/json").body(body).post(PATH)
                    .then().statusCode(401).header("Cache-Control", "no-store");
        }
    }

    @Test
    void boundsDeclaredAndStreamingBodiesBeforeJsonDecoding() {
        byte[] bytes = "x".repeat(DashboardOperationsIngress.MAX_BODY_BYTES + 1).getBytes(StandardCharsets.UTF_8);
        given().header("x-miot-proxy-key", KEY).contentType("application/json").body(bytes).post(PATH)
                .then().statusCode(413).header("Cache-Control", "no-store");
        given().header("x-miot-proxy-key", KEY).contentType("application/json")
                .body(new ByteArrayInputStream(bytes)).post(PATH)
                .then().statusCode(413).header("Cache-Control", "no-store");
    }

    @Test
    void frameworkErrorsAreNeverCached() {
        given().header("x-miot-proxy-key", KEY).contentType("application/json").body("{").post(PATH)
                .then().statusCode(400).header("Cache-Control", "no-store");
        given().header("x-miot-proxy-key", KEY).contentType("text/plain").body("{}").post(PATH)
                .then().statusCode(415).header("Cache-Control", "no-store");
        given().header("x-miot-proxy-key", KEY).get(PATH)
                .then().statusCode(405).header("Cache-Control", "no-store");
    }

    @Test
    void validJsonReachesResourceValidation() {
        given().header("x-miot-proxy-key", KEY).contentType("application/json").body("{}").post(PATH)
                .then().statusCode(400).header("Cache-Control", "no-store");
    }

    public static class Profile extends EventsEndpointM2mAuthBootTest.M2mBootProfile {
        @Override public Map<String, String> getConfigOverrides() {
            Map<String, String> config = super.getConfigOverrides();
            config.put("miot.dashboards.proxy-key", KEY);
            config.put("quarkus.http.auth.permission.dashboard-operations.paths", PATH);
            config.put("quarkus.http.auth.permission.dashboard-operations.policy", "permit");
            return config;
        }
    }
}
