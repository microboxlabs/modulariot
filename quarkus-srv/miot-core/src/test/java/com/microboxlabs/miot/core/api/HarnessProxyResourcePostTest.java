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
 * Verifies {@code HarnessProxyResource}'s POST endpoints sit behind the
 * {@code DualJwtAuthMechanism} + {@code OrganizationRequestFilter}
 * chain and forward the {@code X-Miot-*} identity headers to the harness.
 *
 * <p>Stubs the upstream harness with WireMock (started by
 * {@link WireMockLifecycle} from Q0) and asserts:
 * <ul>
 *   <li>member POST {@code /runs} → 200 + WireMock saw the right tenant header</li>
 *   <li>member POST {@code /runs:start} → 202 (upstream status passes through)</li>
 *   <li>non-member → 403 (filter denies before reaching WireMock)</li>
 *   <li>no token / expired token → 401 (mechanism denies)</li>
 * </ul>
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourcePostTest {

    private static final String ORG_SLUG = "harness-post-test-org";
    private static final String ORG_GROUP = "GROUP_harness_post_test";
    private static final String ORG_TENANT = "harness-post-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String RUNS_PATH = "/api/v1/orgs/" + ORG_SLUG + "/harness/runs";
    private static final String RUNS_START_PATH =
            "/api/v1/orgs/" + ORG_SLUG + "/harness/runs:start";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Post Test Org");
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
        WireMockLifecycle.server().stubFor(WireMock.post(WireMock.urlEqualTo("/runs:start"))
                .willReturn(WireMock.aResponse()
                        .withStatus(202)
                        .withHeader("Content-Type", "application/json")
                        .withBody("{\"run_id\":\"run_fake_start\"}")));
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
    void memberPostRunsHits200AndForwardsTenantHeader() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .body("{\"prompt\":\"hello\"}")
                .when()
                .post(RUNS_PATH)
                .statusCode();
        assertThat(status, is(200));
        WireMockLifecycle.server().verify(
                WireMock.postRequestedFor(WireMock.urlEqualTo("/runs"))
                        .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                        .withHeader("X-Miot-User-Email",
                                WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                        .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web"))
                        .withHeader("Authorization", WireMock.equalTo("Bearer " + token)));
    }

    @Test
    void memberPostRunsStartHits202() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .urlEncodingEnabled(false)
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .body("{\"prompt\":\"hello\"}")
                .when()
                .post(RUNS_START_PATH)
                .statusCode();
        assertThat("upstream 202 must pass through the proxy", status, is(202));
        WireMockLifecycle.server().verify(
                WireMock.postRequestedFor(WireMock.urlEqualTo("/runs:start"))
                        .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                        .withHeader("X-Miot-User-Email",
                                WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                        .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web"))
                        .withHeader("Authorization", WireMock.equalTo("Bearer " + token)));
    }

    @Test
    void nonMemberHits403() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .body("{}")
                .when()
                .post(RUNS_PATH)
                .statusCode();
        assertThat(status, is(403));
        WireMockLifecycle.server().verify(0, WireMock.postRequestedFor(WireMock.urlEqualTo("/runs")));
    }

    @Test
    void noTokenHits401() {
        int status = given()
                .contentType("application/json")
                .body("{}")
                .when()
                .post(RUNS_PATH)
                .statusCode();
        assertThat(status, is(401));
    }

    @Test
    void expiredTokenHits401() {
        String token = TestTokenFactory.signExpiredWebToken(
                StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .contentType("application/json")
                .body("{}")
                .when()
                .post(RUNS_PATH)
                .statusCode();
        assertThat(status, is(401));
    }
}
