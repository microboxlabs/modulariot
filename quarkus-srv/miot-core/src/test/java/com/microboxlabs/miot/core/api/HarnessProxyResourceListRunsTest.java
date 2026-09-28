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
 * Verifies {@code HarnessProxyResource#listRuns} forwards the harness
 * {@code GET /runs} response unchanged, passes the filter query params and the
 * caller identity headers, drops a caller-supplied {@code user_id}, and sits
 * behind the same auth + membership chain as the other run routes.
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourceListRunsTest {

    private static final String ORG_SLUG = "harness-list-runs-test-org";
    private static final String ORG_GROUP = "GROUP_harness_list_runs_test";
    private static final String ORG_TENANT = "harness-list-runs-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String FAKE_RUNS =
            "[{\"run_id\":\"run_1\",\"status\":\"running\",\"conversation_id\":\"c1\"}]";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness List Runs Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlPathEqualTo("/runs"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody(FAKE_RUNS)));
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
    void memberListsRunsWithFiltersAndIdentity() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        Response resp = given()
                .header("Authorization", "Bearer " + token)
                .queryParam("conversation_id", "c1")
                .queryParam("status", "running,completed")
                .queryParam("limit", 10)
                .queryParam("user_id", "someone-else@test.example")
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs");
        assertThat(resp.statusCode(), is(200));
        assertThat(resp.body().asString(), containsString("\"run_id\":\"run_1\""));
        WireMockLifecycle.server().verify(WireMock.getRequestedFor(
                WireMock.urlPathEqualTo("/runs"))
                .withQueryParam("conversation_id", WireMock.equalTo("c1"))
                .withQueryParam("status", WireMock.equalTo("running,completed"))
                .withQueryParam("limit", WireMock.equalTo("10"))
                .withoutQueryParam("user_id")
                .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                .withHeader("X-Miot-User-Email",
                        WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web")));
    }

    @Test
    void upstreamErrorStatusPassesThrough() {
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlPathEqualTo("/runs"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(422)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"detail\":\"bad limit\"}")));
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .queryParam("limit", 1000)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs")
                .statusCode();
        assertThat(status, is(422));
    }

    @Test
    void nonMemberHits403WithoutCallingUpstream() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs")
                .statusCode();
        assertThat(status, is(403));
        WireMockLifecycle.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlPathEqualTo("/runs")));
    }

    @Test
    void noTokenHits401() {
        int status = given()
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/runs")
                .statusCode();
        assertThat(status, is(401));
    }
}
