package com.microboxlabs.miot.core.gps;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import com.microboxlabs.miot.core.auth0.FakeAuth0Api;
import com.microboxlabs.miot.core.auth0.FakeAuth0Management;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Organizations linked to Auth0 M2M applications, the GPS integration page and API keys on the ingest. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class GpsAccessApiTest {

    private static final String ORG = "gps-org";
    private static final String CLIENT = "gps-org-client";
    private static final String OWNER = "owner@gps.test";
    private static final String ADMIN = "admin@gps.test";
    private static final String MEMBER = "member@gps.test";
    private static final String GPS = "/api/v1/orgs/" + ORG + "/gps/integration";
    private static final String PLATFORM_ORGS = "/api/v1/platform/orgs";

    @Inject
    AgroalDataSource ds;

    @Inject
    FakeAuth0Management auth0;

    private FakeAuth0Api api;

    @BeforeEach
    void seed() throws SQLException {
        api = auth0.api();
        api.reset();
        api.add(CLIENT, "test:gps-org", "non_interactive");
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'GPS Org', '" + CLIENT + "', true, 'NATIVE')");
        for (String[] m : new String[][] {{OWNER, "OWNER"}, {ADMIN, "ADMIN"}, {MEMBER, "MEMBER"}}) {
            exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + m[0] + "') ON CONFLICT DO NOTHING");
            exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                    + "SELECT o.id, u.id, '" + m[1] + "' FROM miot_core.organizations o, miot_iam.iam_user u "
                    + "WHERE o.slug = '" + ORG + "' AND u.email = '" + m[0] + "'");
        }
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug IN ('" + ORG + "', 'gps-new', 'gps-dup')");
    }

    @Test
    void anOrganizationCreatedWithoutAClientIdGetsANewM2mApplication() throws SQLException {
        String clientId = given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .contentType("application/json")
                .body("{\"slug\":\"gps-new\",\"name\":\"New Provider\"}")
                .when().post(PLATFORM_ORGS)
                .then().statusCode(201).body("tenantClientId", not(nullValue()))
                .extract().path("tenantClientId");

        assertEquals("test:gps-new", api.client(clientId).name());
        assertEquals(clientId, api.grants().get(0).clientId());
        assertEquals(FakeAuth0Management.AUDIENCE, api.grants().get(0).audience());
        assertEquals(clientId, scalar("SELECT tenant_client_id FROM miot_core.organizations WHERE slug = 'gps-new'"));
    }

    @Test
    void aClientIdIsUsedByOneTopLevelOrganization() {
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL)).contentType("application/json")
                .body("{\"slug\":\"gps-dup\",\"name\":\"Dup\",\"tenantClientId\":\"" + CLIENT + "\"}")
                .when().post(PLATFORM_ORGS)
                .then().statusCode(409);
    }

    @Test
    void anApplicationWhoseGrantFailsLeavesNoOrganization() throws SQLException {
        api.failGrants(true);
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL)).contentType("application/json")
                .body("{\"slug\":\"gps-new\",\"name\":\"New Provider\"}")
                .when().post(PLATFORM_ORGS)
                .then().statusCode(502);

        assertEquals(1, api.clientCount());
        assertEquals(null, scalar("SELECT slug FROM miot_core.organizations WHERE slug = 'gps-new'"));
    }

    @Test
    void platformOwnersSeeWhichApplicationsHaveNoOrganization() {
        api.add("unlinked-client", "test:other", "non_interactive");

        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().get("/api/v1/platform/auth0-clients")
                .then().statusCode(200)
                .body("find { it.clientId == '" + CLIENT + "' }.organization", is(ORG))
                .body("find { it.clientId == 'unlinked-client' }.organization", nullValue());
        given().header("Authorization", bearer(OWNER)).when().get("/api/v1/platform/auth0-clients")
                .then().statusCode(403);
    }

    @Test
    void membersSeeTheIntegrationAndOnlyOwnersTheSecret() throws SQLException {
        given().header("Authorization", bearer(ADMIN)).when().get(GPS)
                .then().statusCode(200)
                .body("clientId", is(CLIENT))
                .body("audience", is(FakeAuth0Management.AUDIENCE))
                .body("tokenUrl", is("https://tenant.auth0.test/oauth/token"))
                .body("secretAvailable", is(true));
        given().header("Authorization", bearer(MEMBER)).when().get(GPS).then().statusCode(403);

        given().header("Authorization", bearer(ADMIN)).when().post(GPS + "/secret").then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).when().post(GPS + "/secret")
                .then().statusCode(200)
                .header("Cache-Control", "no-store")
                .body("clientSecret", is("secret-" + CLIENT));

        String rotated = given().header("Authorization", bearer(OWNER)).when().post(GPS + "/secret/rotate")
                .then().statusCode(200).extract().path("clientSecret");
        assertTrue(rotated.startsWith("rotated-"), rotated);
        assertEquals("2", scalar("SELECT count(*) FROM miot_iam.iam_audit_event e JOIN miot_core.organizations o "
                + "ON o.id = e.organization_id WHERE o.slug = '" + ORG + "' AND e.action LIKE 'gps-secret-%'"));
    }

    @Test
    void anApiKeySendsPositionsForItsOwnOrganizationWithThePublisherRole() {
        String publisher = key("[\"GPS_PUBLISHER\"]");
        String other = key("[]");

        given().header("Authorization", publisher).when().post("/api/v1/gps-probe")
                .then().statusCode(200).body(is(CLIENT));
        given().header("Authorization", other).when().post("/api/v1/gps-probe").then().statusCode(403);
    }

    private String key(String roles) {
        return "Bearer " + given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"name\":\"Feed " + roles.length() + "\",\"roles\":" + roles + "}")
                .when().post("/api/v1/orgs/" + ORG + "/team/service-accounts")
                .then().statusCode(201).extract().path("secret");
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }

    private String scalar(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); ResultSet rs = c.createStatement().executeQuery(sql)) {
            return rs.next() ? rs.getString(1) : null;
        }
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection()) {
            c.createStatement().execute(sql);
        }
    }
}
