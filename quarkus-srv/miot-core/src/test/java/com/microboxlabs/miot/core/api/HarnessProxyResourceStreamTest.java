package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

import com.github.tomakehurst.wiremock.client.WireMock;
import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile;
import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile.WireMockLifecycle;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Verifies {@code HarnessProxyResource#streamRun} (Q3, #582) relays the
 * harness SSE stream byte-for-byte, behind the same
 * {@code DualJwtAuthMechanism} + {@code OrganizationRequestFilter} chain
 * the other proxy routes use, and forwards the caller's identity +
 * {@code Last-Event-ID} to the harness.
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourceStreamTest {

    private static final String ORG_SLUG = "harness-stream-test-org";
    private static final String ORG_GROUP = "GROUP_harness_stream_test";
    private static final String ORG_TENANT = "harness-stream-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String RUN_ID_OK = "run_stream_ok";
    private static final String RUN_ID_MISSING = "run_stream_missing";
    private static final String LAST_EVENT_ID = "evt-5";

    // The exact frames the harness emits: id:/event:/data:, double-newline
    // separated. The relay must pass these through unchanged.
    private static final String SSE_BODY =
            "id: 1\nevent: step_started\ndata: {\"step\":\"plan\"}\n\n"
                    + "id: 2\nevent: step_completed\ndata: {\"answer\":\"42\"}\n\n";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Stream Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlEqualTo("/runs/" + RUN_ID_OK + "/stream"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "text/event-stream")
                                .withBody(SSE_BODY)));
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlEqualTo("/runs/" + RUN_ID_MISSING + "/stream"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(404)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"detail\":\"Run not found\"}")));
    }

    @AfterEach
    void cleanupOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "DELETE FROM miot_core.organizations WHERE slug = ?")) {
            st.setString(1, ORG_SLUG);
            st.executeUpdate();
        }
    }

    @Test
    void memberStreamRelaysEventStreamUnchanged() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        Response resp = given()
                .header("Authorization", "Bearer " + token)
                .header("Accept", "text/event-stream")
                .header("Last-Event-ID", LAST_EVENT_ID)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_OK + "/stream");

        assertThat(resp.statusCode(), is(200));
        assertThat(resp.getContentType(), containsString("text/event-stream"));
        String body = resp.body().asString();
        // Frames passed through intact.
        assertThat(body, containsString("id: 1"));
        assertThat(body, containsString("event: step_started"));
        assertThat(body, containsString("data: {\"answer\":\"42\"}"));
        // Guard against SSE re-wrapping: a framework that re-encoded each
        // chunk as its own event would produce "data: id: 1", destroying the
        // original framing. Assert that did NOT happen.
        assertThat(body, not(containsString("data: id:")));

        // Identity + resume cursor forwarded to the harness.
        WireMockLifecycle.server().verify(WireMock.getRequestedFor(
                WireMock.urlEqualTo("/runs/" + RUN_ID_OK + "/stream"))
                .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                .withHeader("X-Miot-User-Email",
                        WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web"))
                .withHeader("Last-Event-ID", WireMock.equalTo(LAST_EVENT_ID)));
    }

    @Test
    void memberStreamMissingRunPasses404Through() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .header("Accept", "text/event-stream")
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_MISSING + "/stream")
                .statusCode();
        assertThat("upstream 404 must pass through the relay", status, is(404));
    }

    @Test
    void nonMemberHits403WithoutCallingUpstream() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .header("Accept", "text/event-stream")
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_OK + "/stream")
                .statusCode();
        assertThat(status, is(403));
        WireMockLifecycle.server().verify(0,
                WireMock.getRequestedFor(
                        WireMock.urlEqualTo("/runs/" + RUN_ID_OK + "/stream")));
    }

    @Test
    void noTokenHits401() {
        int status = given()
                .header("Accept", "text/event-stream")
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_OK + "/stream")
                .statusCode();
        assertThat(status, is(401));
    }
}
