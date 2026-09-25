package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

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
 * The datasource proxy sits behind the same membership chain as the
 * dashboard proxy, maps the org onto the upstream's tenant and scope, and
 * passes the upstream answer through.
 */
@QuarkusTest
@TestProfile(DashboardProxyTestProfile.class)
class DashboardDataSourceProxyResourceTest {

    private static final String SITE_ORG = "datasource-site-org";
    private static final String SITE_ID = "fleet-ops";
    private static final String SITE_GROUP = "GROUP_site_" + SITE_ID;
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String STORED =
            "{\"data\":{\"id\":\"ds-1\",\"name\":\"Fleet\",\"type\":\"POSTGREST\"}}";

    private static String upstream(String tail) {
        return "/tenants/" + SITE_ORG + "/scopes/" + SITE_ID + "/datasources" + tail;
    }

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, SITE_ORG);
            st.setString(2, SITE_ORG);
            st.setString(3, SITE_GROUP);
            st.setString(4, "datasource-site-tenant");
            st.executeUpdate();
        }

        DashboardWireMock.server().resetAll();
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(upstream("")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"data\":[]}")));
        DashboardWireMock.server().stubFor(
                WireMock.post(WireMock.urlEqualTo(upstream("")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(201)
                                .withHeader("Content-Type", "application/json")
                                .withBody(STORED)));
        DashboardWireMock.server().stubFor(
                WireMock.post(WireMock.urlEqualTo(upstream("/ds-1/test")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"data\":{\"ok\":true}}")));
        DashboardWireMock.server().stubFor(
                WireMock.delete(WireMock.urlEqualTo(upstream("/ds-1")))
                        .willReturn(WireMock.aResponse().withStatus(204)));
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(upstream("/missing")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(404)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"code\":\"NOT_FOUND\"}")));
    }

    @AfterEach
    void cleanupOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "DELETE FROM miot_core.organizations WHERE slug = ?")) {
            st.setString(1, SITE_ORG);
            st.executeUpdate();
        }
    }

    private static String memberToken() {
        return TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
    }

    @Test
    void memberListReachesTheSiteScope() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/datasources");

        assertThat(resp.statusCode(), is(200));
        DashboardWireMock.server().verify(
                WireMock.getRequestedFor(WireMock.urlEqualTo(upstream(""))));
    }

    @Test
    void createForwardsTheBodyAndKeepsTheCreatedStatus() {
        String body = "{\"name\":\"Fleet\",\"type\":\"POSTGREST\",\"isActive\":true,"
                + "\"target\":\"https://pgrest.example.com/api\",\"credentialRef\":\"cred-1\"}";
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .contentType("application/json")
                .body(body)
                .when()
                .post("/api/v1/orgs/" + SITE_ORG + "/datasources");

        assertThat(resp.statusCode(), is(201));
        assertThat(resp.body().asString(), containsString("\"id\":\"ds-1\""));
        DashboardWireMock.server().verify(
                WireMock.postRequestedFor(WireMock.urlEqualTo(upstream("")))
                        .withRequestBody(WireMock.equalToJson(body)));
    }

    @Test
    void testAndDeletePassStatusesThrough() {
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .post("/api/v1/orgs/" + SITE_ORG + "/datasources/ds-1/test")
                .then()
                .statusCode(200);

        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .delete("/api/v1/orgs/" + SITE_ORG + "/datasources/ds-1")
                .then()
                .statusCode(204);
    }

    @Test
    void upstreamNotFoundPassesThrough() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/datasources/missing");

        assertThat(resp.statusCode(), is(404));
        assertThat(resp.body().asString(), containsString("NOT_FOUND"));
    }

    @Test
    void nonMemberIsRefusedBeforeTheUpstream() {
        given().header("Authorization", "Bearer " + TestTokenFactory.signWebToken(NON_MEMBER))
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/datasources")
                .then()
                .statusCode(403);

        DashboardWireMock.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlEqualTo(upstream(""))));
    }

    @Test
    void noTokenIsUnauthorized() {
        given().when()
                .get("/api/v1/orgs/" + SITE_ORG + "/datasources")
                .then()
                .statusCode(401);
    }
}
