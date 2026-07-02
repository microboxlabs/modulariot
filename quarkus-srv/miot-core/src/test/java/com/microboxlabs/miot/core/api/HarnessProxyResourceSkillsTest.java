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
 * Verifies {@code HarnessProxyResource#listSkills} forwards the upstream
 * harness {@code GET /skills} response (body + status) unchanged, forwards
 * the caller identity headers plus the optional {@code tenant} query param,
 * and sits behind the same {@code DualJwtAuthMechanism} +
 * {@code OrganizationRequestFilter} chain as the run routes.
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class HarnessProxyResourceSkillsTest {

    private static final String ORG_SLUG = "harness-skills-test-org";
    private static final String ORG_GROUP = "GROUP_harness_skills_test";
    private static final String ORG_TENANT = "harness-skills-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String FAKE_SKILLS =
            "[{\"id\":\"demo-skill\",\"name\":\"Demo Skill\",\"description\":\"d\","
                    + "\"when_to_use\":\"\",\"scope\":\"tenant\",\"source\":\"skill_md\"}]";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Harness Skills Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
        WireMockLifecycle.server().resetAll();
        // urlPathEqualTo so the stub matches whether or not the proxy appends
        // a ?tenant query string.
        WireMockLifecycle.server().stubFor(
                WireMock.get(WireMock.urlPathEqualTo("/skills"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody(FAKE_SKILLS)));
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
    void memberListsSkillsReturnsProxiedBodyAndForwardsIdentity() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        Response resp = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/skills");
        assertThat(resp.statusCode(), is(200));
        assertThat(resp.body().asString(), containsString("\"id\":\"demo-skill\""));
        WireMockLifecycle.server().verify(WireMock.getRequestedFor(
                WireMock.urlPathEqualTo("/skills"))
                .withHeader("X-Miot-Tenant-Client-Id", WireMock.equalTo(ORG_TENANT))
                .withHeader("X-Miot-User-Email",
                        WireMock.equalTo(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .withHeader("X-Miot-Auth-Mode", WireMock.equalTo("web")));
    }

    @Test
    void tenantQueryParamIsForwardedUpstream() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        given()
                .header("Authorization", "Bearer " + token)
                .queryParam("tenant", "mintral")
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/skills")
                .then()
                .statusCode(200);
        WireMockLifecycle.server().verify(WireMock.getRequestedFor(
                WireMock.urlPathEqualTo("/skills"))
                .withQueryParam("tenant", WireMock.equalTo("mintral")));
    }

    @Test
    void nonMemberHits403WithoutCallingUpstream() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/skills")
                .statusCode();
        assertThat(status, is(403));
        WireMockLifecycle.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlPathEqualTo("/skills")));
    }

    @Test
    void noTokenHits401() {
        int status = given()
                .when()
                .get("/api/v1/orgs/" + ORG_SLUG + "/harness/skills")
                .statusCode();
        assertThat(status, is(401));
    }
}
