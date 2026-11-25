package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;

import com.github.tomakehurst.wiremock.client.WireMock;
import com.microboxlabs.miot.core.auth.DashboardProxyTestProfile;
import com.microboxlabs.miot.core.auth.DashboardProxyTestProfile.DashboardWireMock;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.TestMembers;
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
 * The folder proxy sits behind the same membership chain as the dashboard
 * proxy, maps the org onto the upstream's tenant and scope, and passes the
 * upstream answer through, including the dashboard filing route.
 */
@QuarkusTest
@TestProfile(DashboardProxyTestProfile.class)
class DashboardFolderProxyResourceTest {

    private static final String SITE_ORG = "folder-site-org";
    private static final String SITE_ID = "fleet-ops";
    private static final String SITE_GROUP = "GROUP_site_" + SITE_ID;
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String FOLDER =
            "{\"data\":{\"id\":\"f1\",\"name\":\"Ops\",\"parentId\":null}}";

    private static String scope(String tail) {
        return "/tenants/" + SITE_ORG + "/scopes/" + SITE_ID + tail;
    }

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrgAndStubs() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active, membership_source) "
                        + "VALUES (?, ?, ?, ?, true, 'NATIVE')")) {
            st.setString(1, SITE_ORG);
            st.setString(2, SITE_ORG);
            st.setString(3, SITE_GROUP);
            st.setString(4, "folder-site-tenant");
            st.executeUpdate();
            TestMembers.addMember(c, SITE_ORG, StubAlfrescoMembershipClient.MEMBER_EMAIL, "OWNER");
        }

        DashboardWireMock.server().resetAll();
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(scope("/folders")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"data\":[]}")));
        DashboardWireMock.server().stubFor(
                WireMock.post(WireMock.urlEqualTo(scope("/folders")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(201)
                                .withHeader("Content-Type", "application/json")
                                .withBody(FOLDER)));
        DashboardWireMock.server().stubFor(
                WireMock.patch(WireMock.urlEqualTo(scope("/folders/f1")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(409)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"code\":\"CONFLICT\"}")));
        DashboardWireMock.server().stubFor(
                WireMock.delete(WireMock.urlEqualTo(scope("/folders/f1")))
                        .willReturn(WireMock.aResponse().withStatus(204)));
        DashboardWireMock.server().stubFor(
                WireMock.put(WireMock.urlEqualTo(scope("/dashboards/fleet/folder")))
                        .willReturn(WireMock.aResponse().withStatus(204)));
        DashboardWireMock.server().stubFor(
                WireMock.get(WireMock.urlEqualTo(scope("/folders/f1/permissions")))
                        .willReturn(WireMock.aResponse()
                                .withStatus(200)
                                .withHeader("Content-Type", "application/json")
                                .withBody("{\"assignments\":[{\"authorityId\":\"team:7\",\"role\":\"Editor\"}]}")));
        DashboardWireMock.server().stubFor(
                WireMock.put(WireMock.urlEqualTo(scope("/folders/f1/permissions")))
                        .willReturn(WireMock.aResponse().withStatus(204)));
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
        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders")
                .then()
                .statusCode(200);
        DashboardWireMock.server().verify(
                WireMock.getRequestedFor(WireMock.urlEqualTo(scope("/folders"))));
    }

    @Test
    void createForwardsTheBodyAndKeepsTheCreatedStatus() {
        String body = "{\"name\":\"Ops\",\"parentId\":null}";
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .contentType("application/json")
                .body(body)
                .when()
                .post("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders");

        assertThat(resp.statusCode(), is(201));
        assertThat(resp.body().asString(), containsString("\"id\":\"f1\""));
        DashboardWireMock.server().verify(
                WireMock.postRequestedFor(WireMock.urlEqualTo(scope("/folders")))
                        .withRequestBody(WireMock.equalToJson(body)));
    }

    @Test
    void updateConflictAndDeletePassStatusesThrough() {
        Response resp = given()
                .header("Authorization", "Bearer " + memberToken())
                .contentType("application/json")
                .body("{\"name\":\"Taken\"}")
                .when()
                .patch("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders/f1");
        assertThat(resp.statusCode(), is(409));
        assertThat(resp.body().asString(), containsString("CONFLICT"));

        given().header("Authorization", "Bearer " + memberToken())
                .when()
                .delete("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders/f1")
                .then()
                .statusCode(204);
    }

    @Test
    void filingADashboardForwardsTheBody() {
        String body = "{\"folderId\":\"f1\"}";
        given().header("Authorization", "Bearer " + memberToken())
                .contentType("application/json")
                .body(body)
                .when()
                .put("/api/v1/orgs/" + SITE_ORG + "/dashboards/fleet/folder")
                .then()
                .statusCode(204);
        DashboardWireMock.server().verify(
                WireMock.putRequestedFor(WireMock.urlEqualTo(scope("/dashboards/fleet/folder")))
                        .withRequestBody(WireMock.equalToJson(body)));
    }

    @Test
    void nonMemberIsRefusedBeforeTheUpstream() {
        given().header("Authorization", "Bearer " + TestTokenFactory.signWebToken(NON_MEMBER))
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders")
                .then()
                .statusCode(403);

        DashboardWireMock.server().verify(0,
                WireMock.getRequestedFor(WireMock.urlEqualTo(scope("/folders"))));
    }

    @Test
    void folderPermissionsAreReadAndReplacedThroughTheProxy() {
        Response read = given()
                .header("Authorization", "Bearer " + memberToken())
                .when()
                .get("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders/f1/permissions");
        assertThat(read.statusCode(), is(200));
        assertThat(read.body().asString(), containsString("team:7"));

        String body = "{\"assignments\":[{\"authorityId\":\"ana@test.example\",\"role\":\"Consumer\"}]}";
        given().header("Authorization", "Bearer " + memberToken())
                .contentType("application/json")
                .body(body)
                .when()
                .put("/api/v1/orgs/" + SITE_ORG + "/dashboard-folders/f1/permissions")
                .then()
                .statusCode(204);
        DashboardWireMock.server().verify(
                WireMock.putRequestedFor(WireMock.urlEqualTo(scope("/folders/f1/permissions")))
                        .withRequestBody(WireMock.equalToJson(body)));
    }
}
