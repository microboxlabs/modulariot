package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import com.github.tomakehurst.wiremock.client.WireMock;
import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile;
import com.microboxlabs.miot.core.auth.HarnessProxyTestProfile.WireMockLifecycle;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Verifies {@code HarnessProxyResource#resolveApproval} forwards the decision
 * with the caller's identity headers and passes the harness status through.
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourceApprovalTest {

    private static final String ORG_SLUG = "harness-approval-test-org";
    private static final String ORG_GROUP = "GROUP_harness_approval_test";
    private static final String ORG_TENANT = "harness-approval-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String PENDING = "/runs/run_a/approvals/aid_ok";
    private static final String GONE = "/runs/run_a/approvals/aid_gone";
    private static final String BODY = "{\"decision\":\"deny\",\"comment\":\"not now\"}";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Approval Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        WireMockLifecycle.server().stubFor(WireMock.post(WireMock.urlEqualTo(PENDING))
                .willReturn(WireMock.aResponse().withStatus(204)));
        WireMockLifecycle.server().stubFor(WireMock.post(WireMock.urlEqualTo(GONE))
                .willReturn(WireMock.aResponse()
                        .withStatus(404)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"detail\":\"Approval not pending\"}")));
    }

    @AfterEach
    void cleanupOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "DELETE FROM miot_core.organizations WHERE slug = ?")) {
            st.setString(1, ORG_SLUG);
            st.executeUpdate();
        }
    }

    private int post(String token, String path) {
        var request = given().contentType("application/json").body(BODY);
        if (token != null) request = request.header("Authorization", "Bearer " + token);
        return request.when()
                .post("/api/v1/orgs/" + ORG_SLUG + "/harness" + path)
                .statusCode();
    }

    @Test
    void memberDecisionIsForwardedWithIdentity() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        assertThat(post(token, PENDING), is(204));
        WireMockLifecycle.server().verify(WireMock.postRequestedFor(WireMock.urlEqualTo(PENDING))
                .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                .withHeader("X-Miot-User-Email",
                        WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web"))
                .withRequestBody(WireMock.equalToJson(BODY)));
    }

    @Test
    void approvalNoLongerPendingPasses404Through() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        assertThat(post(token, GONE), is(404));
    }

    @Test
    void nonMemberHits403WithoutCallingUpstream() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        assertThat(post(token, PENDING), is(403));
        WireMockLifecycle.server().verify(0,
                WireMock.postRequestedFor(WireMock.urlEqualTo(PENDING)));
    }

    @Test
    void noTokenHits401() {
        assertThat(post(null, PENDING), is(401));
    }
}
