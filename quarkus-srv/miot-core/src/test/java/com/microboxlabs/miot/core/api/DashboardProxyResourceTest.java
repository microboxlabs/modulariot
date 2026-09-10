package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;

import com.github.tomakehurst.wiremock.client.WireMock;
import com.microboxlabs.miot.core.auth.DashboardProxyTestProfile;
import com.microboxlabs.miot.core.auth.DashboardProxyTestProfile.DashboardWireMock;
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
 * Verifies {@code DashboardProxyResource} sits behind the same
 * {@code DualJwtAuthMechanism} + {@code OrganizationRequestFilter} chain as
 * the harness proxy, maps the organization onto the dashboard server's
 * tenant + scope address space, and passes upstream responses through
 * unchanged — statuses, body and headers alike.
 *
 * <p>The {@code ETag} stub below is deliberate even though the dashboard
 * server does not currently set one: it pins that this proxy does not drop a
 * response header if it ever does. The precondition that is real today is
 * {@code If-Match} carrying an integer revision, and a stale write is a 409.
 */
@QuarkusTest
@TestProfile(DashboardProxyTestProfile.class)
class DashboardProxyResourceTest {

    /** Backed by an Alfresco site, so the scope is the site id. */
    private static final String SITE_ORG = "dashboard-site-org";
    private static final String SITE_ID = "fleet-ops";
    private static final String SITE_GROUP = "GROUP_site_" + SITE_ID;

    /** No site behind it, so the scope falls back to the configured default. */
    private static final String PLAIN_ORG = "dashboard-plain-org";
    private static final String PLAIN_GROUP = "GROUP_dashboard_plain";

    private static final String NON_MEMBER = "intruder@test.example";
    private static final String LISTING = "{\"data\":[{\"slug\":\"fleet\",\"name\":\"Fleet\"}]}";

    private static String siteScopePath(String tail) {
        return "/tenants/" + SITE_ORG + "/scopes/" + SITE_ID + "/dashboards" + tail;
    }

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgsAndStubs() throws SQLException {
        insertOrg(SITE_ORG, SITE_GROUP, "dashboard-site-tenant");
        insertOrg(PLAIN_ORG, PLAIN_GROUP, "dashboard-plain-tenant");

        DashboardWireMock.server().resetAll();
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(siteScopePath("")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody(LISTING)));
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(
                        "/tenants/" + PLAIN_ORG + "/scopes/default/dashboards"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"data\":[]}")));
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(siteScopePath("/missing")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(404)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"code\":\"NOT_FOUND\"}")));
        DashboardWireMock.server().stubFor(
                WireMock.put(WireMock.urlEqualTo(siteScopePath("/fleet")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withHeader("ETag", "\"7\"")
                                .withBody("{\"data\":{\"revision\":7}}")));
        DashboardWireMock.server().stubFor(
                WireMock.put(WireMock.urlEqualTo(siteScopePath("/stale")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(409)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"code\":\"CONFLICT\"}")));
    }

    @AfterEach
    void cleanupOrgs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "DELETE FROM miot_core.organizations WHERE slug IN (?, ?)")) {
            st.setString(1, SITE_ORG);
            st.setString(2, PLAIN_ORG);
            st.executeUpdate();
        }
    }

    private void insertOrg(String slug, String groupId, String tenantClientId)
            throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, slug);
            st.setString(2, slug);
            st.setString(3, groupId);
            st.setString(4, tenantClientId);
            st.executeUpdate();
        }
    }

    private static String memberToken() {
        return TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
    }

    @Test
    void memberListReachesTheSiteScopeAndGetsTheUpstreamBody() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards");

        assertThat(resp.statusCode(), is(200));
        assertThat(resp.body().asString(), containsString("\"slug\":\"fleet\""));
        // The mapping is the point of this proxy: org slug becomes the tenant,
        // the org's Alfresco site becomes the scope.
        DashboardWireMock.server().verify(
                WireMock.getRequestedFor(WireMock.urlEqualTo(siteScopePath(""))));
    }

    @Test
    void orgWithoutASiteFallsBackToTheDefaultScope() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + PLAIN_ORG + "/dashboards");

        assertThat(resp.statusCode(), is(200));
        DashboardWireMock.server().verify(WireMock.getRequestedFor(WireMock.urlEqualTo(
                "/tenants/" + PLAIN_ORG + "/scopes/default/dashboards")));
    }

    @Test
    void nonMemberIsRefusedAndTheUpstreamIsNeverCalled() {
        Response resp = given()
                .header("Authorization", "Bearer " + TestTokenFactory.signWebToken(NON_MEMBER))
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards");

        assertThat(resp.statusCode(), is(403));
        // The filter runs before the handler, so a refusal costs no upstream call.
        DashboardWireMock.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlEqualTo(siteScopePath(""))));
    }

    @Test
    void noTokenIsUnauthorized() {
        Response resp = given()
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards");

        assertThat(resp.statusCode(), is(401));
    }

    @Test
    void upstreamNotFoundPassesThroughRatherThanBecomingA500() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards/missing");

        assertThat(resp.statusCode(), is(404));
        assertThat(resp.body().asString(), containsString("NOT_FOUND"));
    }

    @Test
    void saveForwardsIfMatchAndReturnsTheEtag() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .header("If-Match", "\"6\"")
                .contentType("application/json")
                .body("{\"version\":2,\"name\":\"Fleet\",\"widgets\":[]}")
                .when()
                .put("/api/v1/orgs/" + SITE_ORG + "/dashboards/fleet");

        assertThat(resp.statusCode(), is(200));
        // Without the ETag the browser cannot send the next If-Match, and every
        // write after the first would be unconditional.
        assertThat(resp.header("ETag"), is("\"7\""));
        DashboardWireMock.server().verify(
                WireMock.putRequestedFor(WireMock.urlEqualTo(siteScopePath("/fleet")))
                        .withHeader("If-Match", WireMock.equalTo("\"6\"")));
    }

    @Test
    void staleWriteKeepsTheUpstreamConflictStatus() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .header("If-Match", "\"1\"")
                .contentType("application/json")
                .body("{\"version\":2,\"name\":\"Stale\",\"widgets\":[]}")
                .when()
                .put("/api/v1/orgs/" + SITE_ORG + "/dashboards/stale");

        // 409, the status a stale write actually gets from the dashboard
        // server — verified against a running one, not assumed.
        assertThat(resp.statusCode(), is(409));
    }

    @Test
    void writeWithoutIfMatchSendsNoPrecondition() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .contentType("application/json")
                .body("{\"version\":2,\"name\":\"Fleet\",\"widgets\":[]}")
                .when()
                .put("/api/v1/orgs/" + SITE_ORG + "/dashboards/fleet");

        assertThat(resp.statusCode(), is(200));
        // A proxy that invented a precondition here would turn a first write
        // into a conflict, or a conflict into a silent overwrite.
        DashboardWireMock.server().verify(
                WireMock.putRequestedFor(WireMock.urlEqualTo(siteScopePath("/fleet")))
                        .withoutHeader("If-Match"));
    }

    @Test
    void theProxyAssertsNoIdentityOfItsOwn() {
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards")
                .then()
                .statusCode(200);

        // The upstream verifies the forwarded token itself. If this proxy ever
        // starts asserting the caller instead, that is a deliberate change with
        // a credential behind it — not something to acquire by accident.
        var sent = DashboardWireMock.server()
                .findAll(WireMock.getRequestedFor(WireMock.urlEqualTo(siteScopePath(""))))
                .get(0);
        assertThat(sent.getHeader("Authorization"), containsString("Bearer "));
        assertThat(sent.getHeader("X-Dev-User"), is(nullValue()));
    }
}
