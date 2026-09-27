package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

import com.github.tomakehurst.wiremock.client.WireMock;
import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile.WireMockLifecycle;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import com.microboxlabs.miot.core.harness.HarnessPlanGateTestProfile;
import com.microboxlabs.miot.core.harness.RefusingHarnessPlanGate;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.http.ContentType;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** {@code HarnessProxyResource} asks the plan gate before a run starts and before listing models. */
@QuarkusTest
@TestProfile(HarnessPlanGateTestProfile.class)
class HarnessProxyResourcePlanGateTest {

    private static final String ORG_SLUG = "harness-plan-gate-test-org";
    private static final String ORG_GROUP = "GROUP_harness_plan_gate_test";
    private static final String ORG_TENANT = "harness-plan-gate-tenant";
    private static final String RUNS_PATH = "/api/v1/orgs/" + ORG_SLUG + "/harness/runs";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Plan Gate Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        WireMockLifecycle.server().stubFor(WireMock.post(WireMock.urlEqualTo("/runs"))
                .willReturn(WireMock.aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"run_id\":\"run_fake_create\"}")));
        WireMockLifecycle.server().stubFor(WireMock.get(WireMock.urlPathEqualTo("/models"))
                .willReturn(WireMock.aResponse()
                        .withStatus(200)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"default\":\"claude-opus-4-8\","
                                + "\"models\":[\"claude-opus-4-8\",\"claude-sonnet-4-6\"]}")));
    }

    @AfterEach
    void cleanupOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "DELETE FROM miot_core.organizations WHERE slug = ?")) {
            st.setString(1, ORG_SLUG);
            st.executeUpdate();
        }
    }

    private static String memberToken() {
        return TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
    }

    @Test
    void aRefusedRunNeverReachesTheHarness() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .contentType(ContentType.JSON)
                .body("{\"message\":\"hi\",\"model\":\"" + RefusingHarnessPlanGate.BLOCKED + "\"}")
                .when()
                .post(RUNS_PATH);
        assertThat(resp.statusCode(), is(402));
        assertThat(resp.body().asString(), containsString("\"error\":\"plan_pool_exhausted\""));
        WireMockLifecycle.server().verify(0, WireMock.postRequestedFor(WireMock.urlEqualTo("/runs")));
    }

    @Test
    void anAllowedRunIsForwarded() {
        int status = given()
                .header("Authorization", "Bearer " + memberToken())
                .contentType(ContentType.JSON)
                .body("{\"message\":\"hi\"}")
                .when()
                .post(RUNS_PATH)
                .statusCode();
        assertThat(status, is(200));
        WireMockLifecycle.server().verify(1, WireMock.postRequestedFor(WireMock.urlEqualTo("/runs")));
    }

    @Test
    void theModelListIsTheGatesVersion() {
        String body = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/models")
                .then()
                .statusCode(200)
                .extract().body().asString();
        assertThat(body, containsString("\"multipliers\":{\"claude-opus-4-8\":3}"));
        assertThat(body, not(containsString("claude-sonnet-4-6")));
    }
}
