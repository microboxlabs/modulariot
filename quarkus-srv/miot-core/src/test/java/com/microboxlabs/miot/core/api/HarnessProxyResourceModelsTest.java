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
 * Verifies {@code HarnessProxyResource#listModels} forwards the upstream
 * harness {@code GET /models} response unchanged with the caller identity
 * headers, behind the same auth + org-membership chain as the run routes.
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourceModelsTest {

    private static final String ORG_SLUG = "harness-models-test-org";
    private static final String ORG_GROUP = "GROUP_harness_models_test";
    private static final String ORG_TENANT = "harness-models-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String FAKE_MODELS =
            "{\"default\":\"claude-opus-4-8\",\"models\":[\"claude-opus-4-8\",\"claude-sonnet-4-6\"]}";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Models Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlPathEqualTo("/models"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody(FAKE_MODELS)));
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
    void memberListsModelsReturnsProxiedBodyAndForwardsIdentity() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        Response resp = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/models");
        assertThat(resp.statusCode(), is(200));
        assertThat(resp.body().asString(), containsString("\"default\":\"claude-opus-4-8\""));
        WireMockLifecycle.server().verify(WireMock.getRequestedFor(
                WireMock.urlPathEqualTo("/models"))
                .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                .withHeader("X-Miot-User-Email",
                        WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web")));
    }

    @Test
    void nonMemberHits403WithoutCallingUpstream() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/models")
                .statusCode();
        assertThat(status, is(403));
        WireMockLifecycle.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlPathEqualTo("/models")));
    }
}
