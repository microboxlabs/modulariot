package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

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
 * Verifies {@code HarnessProxyResource#getRun} forwards the upstream
 * harness response (body + status) unchanged, and sits behind the
 * same {@code DualJwtAuthMechanism} + {@code OrganizationRequestFilter}
 * chain Q1 already exercises on the POST path.
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourceGetTest {

    private static final String ORG_SLUG = "harness-get-test-org";
    private static final String ORG_GROUP = "GROUP_harness_get_test";
    private static final String ORG_TENANT = "harness-get-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String RUN_ID_OK = "run_ok";
    private static final String RUN_ID_MISSING = "run_missing";
    private static final String FAKE_RECORD =
            "{\"run_id\":\"run_ok\",\"status\":\"completed\",\"answer\":\"42\"}";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Get Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlEqualTo("/runs/" + RUN_ID_OK))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody(FAKE_RECORD)));
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlEqualTo("/runs/" + RUN_ID_MISSING))
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
    void memberGetRunReturnsProxiedBody() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        Response resp = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_OK);
        assertThat(resp.statusCode(), is(200));
        assertThat(resp.body().asString(), containsString("\"run_id\":\"run_ok\""));
        assertThat(resp.body().asString(), containsString("\"status\":\"completed\""));
        WireMockLifecycle.server().verify(WireMock.getRequestedFor(
                WireMock.urlEqualTo("/runs/" + RUN_ID_OK))
                .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                .withHeader("X-Miot-User-Email",
                        WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web")));
    }

    @Test
    void memberGetMissingRunPasses404Through() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_MISSING)
                .statusCode();
        assertThat("upstream 404 must pass through the proxy", status, is(404));
    }

    @Test
    void nonMemberHits403WithoutCallingUpstream() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_OK)
                .statusCode();
        assertThat(status, is(403));
        WireMockLifecycle.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlEqualTo("/runs/" + RUN_ID_OK)));
    }

    @Test
    void noTokenHits401() {
        int status = given()
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs/" + RUN_ID_OK)
                .statusCode();
        assertThat(status, is(401));
    }
}
