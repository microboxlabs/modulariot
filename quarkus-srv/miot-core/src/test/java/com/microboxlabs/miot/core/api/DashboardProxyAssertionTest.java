package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import com.github.tomakehurst.wiremock.client.WireMock;
import com.github.tomakehurst.wiremock.verification.LoggedRequest;
import com.microboxlabs.miot.core.auth.DashboardAssertionTestProfile;
import com.microboxlabs.miot.core.auth.DashboardProxyTestProfile.DashboardWireMock;
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
 * With {@code miot.dashboards.proxy-key} set, the proxy sends the membership
 * it already resolved so the dashboard server does not call Alfresco back for
 * the same answer.
 *
 * <p>These assert what leaves this service. What the dashboard server does
 * with the headers — refusing an assertion that names anyone but the token
 * holder, refusing one whose tenant or scope disagrees with the path — is
 * covered by that package's own tests.
 */
@QuarkusTest
@TestProfile(DashboardAssertionTestProfile.class)
class DashboardProxyAssertionTest {

    private static final String SITE_ORG = "assert-site-org";
    private static final String SITE_ID = "fleet-ops";
    private static final String SITE_GROUP = "GROUP_site_" + SITE_ID;

    /** No site behind it, so the role the filter resolves is null. */
    private static final String PLAIN_ORG = "assert-plain-org";

    private static String listPath(String org, String scope) {
        return "/tenants/" + org + "/scopes/" + scope + "/dashboards";
    }

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgsAndStubs() throws SQLException {
        insertOrg(SITE_ORG, SITE_GROUP, "assert-site-tenant");
        insertOrg(PLAIN_ORG, null, "assert-plain-tenant");

        DashboardWireMock.server().resetAll();
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlMatching("/tenants/.*/dashboards"))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"data\":[]}")));
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

    private static LoggedRequest sentTo(String path) {
        var sent = DashboardWireMock.server()
                .findAll(WireMock.getRequestedFor(WireMock.urlEqualTo(path)));
        assertThat("one upstream call", sent.size(), is(1));
        return sent.get(0);
    }

    @Test
    void sendsTheKeyAndTheResolvedRole() {
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards")
                .then()
                .statusCode(200);

        LoggedRequest sent = sentTo(listPath(SITE_ORG, SITE_ID));
        assertThat(sent.getHeader(DashboardClient.PROXY_KEY_HEADER),
                is(DashboardAssertionTestProfile.PROXY_KEY));
        assertThat(sent.getHeader(DashboardClient.ASSERTED_USER_HEADER),
                is(StubAlfrescoMembershipClient.MEMBER_EMAIL));
        assertThat(sent.getHeader(DashboardClient.ASSERTED_TENANT_HEADER), is(SITE_ORG));
        assertThat(sent.getHeader(DashboardClient.ASSERTED_SCOPE_HEADER), is(SITE_ID));
        // The stub resolves SITE_MANAGER, which is the upstream's Coordinator.
        assertThat(sent.getHeader(DashboardClient.ASSERTED_ROLE_HEADER), is("Coordinator"));
    }

    @Test
    void stillForwardsTheBearerToken() {
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards")
                .then()
                .statusCode(200);

        // The assertion raises a role. It never stands in for the credential:
        // the upstream matches the asserted user against the token it verified,
        // and has nothing to match without this.
        assertThat(sentTo(listPath(SITE_ORG, SITE_ID)).getHeader("Authorization")
                .startsWith("Bearer "), is(true));
    }

    @Test
    void assertsTheTenantAndScopeThatAreInTheUpstreamPath() {
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboards")
                .then()
                .statusCode(200);

        // The upstream compares these against the path it parsed. They have to
        // be the same two values this proxy put in the URL, or every request
        // is refused.
        LoggedRequest sent = sentTo(listPath(SITE_ORG, SITE_ID));
        assertThat(sent.getUrl(), is(listPath(SITE_ORG, SITE_ID)));
        assertThat(sent.getHeader(DashboardClient.ASSERTED_TENANT_HEADER), is(SITE_ORG));
        assertThat(sent.getHeader(DashboardClient.ASSERTED_SCOPE_HEADER), is(SITE_ID));
    }

    @Test
    void anOrgWithNoSiteAssertsTheLowestRole() {
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + PLAIN_ORG + "/dashboards")
                .then()
                .statusCode(200);

        // The filter lets an org with no Alfresco group through with a null
        // role. Asserting Coordinator there would hand out editing rights
        // nobody granted.
        assertThat(sentTo(listPath(PLAIN_ORG, "default"))
                .getHeader(DashboardClient.ASSERTED_ROLE_HEADER), is("Consumer"));
    }
}
