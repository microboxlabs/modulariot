package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.notNullValue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
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

/** Moving an organization from Alfresco to native membership through the platform endpoints. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class AlfrescoBridgeTest {

    private static final String ORG = "bridge-org";
    private static final String PLATFORM = "/api/v1/platform/orgs/" + ORG;

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, alfresco_group_id, "
                + "membership_source) VALUES ('" + ORG + "', 'Bridge', 'bridge-client', true, 'GROUP_bridge', "
                + "'ALFRESCO')");
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
    }

    @Test
    void anAlfrescoMemberIsRecordedAtSignIn() {
        String member = StubAlfrescoMembershipClient.MEMBER_EMAIL;
        given().header("Authorization", bearer(member)).when().get("/api/v1/me/scopes")
                .then().statusCode(200).body("slug", hasItem(ORG));

        given().header("Authorization", bearer(member)).when().get("/api/v1/orgs/" + ORG + "/team/members")
                .then().statusCode(200)
                .body("membershipSource", is("ALFRESCO"))
                .body("members.find { it.email == '" + member + "' }.baseRole", is("ADMIN"))
                .body("members.find { it.email == '" + member + "' }.source", is("ALFRESCO"))
                .body("members.find { it.email == '" + member + "' }.lastSeenAt", notNullValue());

        // Alfresco decides who belongs, so the Team page cannot invite.
        given().header("Authorization", bearer(member)).contentType("application/json")
                .body("{\"emails\":[\"someone@bridge.test\"],\"baseRole\":\"MEMBER\"}")
                .when().post("/api/v1/orgs/" + ORG + "/team/invitations")
                .then().statusCode(409);

        // An Admin can rename the organization.
        given().header("Authorization", bearer(member)).contentType("application/json")
                .body("{\"displayName\":\"Puente\"}")
                .when().patch("/api/v1/orgs/" + ORG)
                .then().statusCode(200).body("displayName", is("Puente"));
    }

    @Test
    void anAdminImportsTheGroupFromTheTeamPage() {
        given().header("Authorization", bearer(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .when().post("/api/v1/orgs/" + ORG + "/team/alfresco-import")
                .then().statusCode(200)
                .body("added", is(3));
    }

    @Test
    void importCopiesTheGroupAndIsIdempotent() {
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(PLATFORM + "/alfresco-import")
                .then().statusCode(200)
                .body("groupId", is("GROUP_bridge"))
                .body("seen", is(3))
                .body("added", is(3));
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(PLATFORM + "/alfresco-import")
                .then().statusCode(200)
                .body("added", is(0))
                .body("alreadyMembers", is(3));

        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL)).contentType("application/json")
                .body("{\"membershipSource\":\"native\"}")
                .when().patch(PLATFORM + "/membership-source")
                .then().statusCode(200)
                .body("membershipSource", is("NATIVE"));

        given().header("Authorization", bearer("dev.user@example.com"))
                .when().get("/api/v1/orgs/" + ORG + "/team/members")
                .then().statusCode(200)
                .body("membershipSource", is("NATIVE"))
                .body("members.email", containsInAnyOrder("dev.user@example.com", "cris.perez@example.com",
                        "ana.soto@example.com"));
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().get(PLATFORM + "/alfresco-projection")
                .then().statusCode(200)
                .body("$", empty());
    }

    @Test
    void onlyPlatformOwnersMayCallThem() {
        given().header("Authorization", bearer(PlatformTestProfile.NON_OWNER_EMAIL))
                .when().post(PLATFORM + "/alfresco-import")
                .then().statusCode(403);
        given().header("Authorization", bearer(PlatformTestProfile.NON_OWNER_EMAIL)).contentType("application/json")
                .body("{\"membershipSource\":\"NATIVE\"}")
                .when().patch(PLATFORM + "/membership-source")
                .then().statusCode(403);
    }

    @Test
    void anUnknownSourceIsRejected() {
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL)).contentType("application/json")
                .body("{\"membershipSource\":\"LDAP\"}")
                .when().patch(PLATFORM + "/membership-source")
                .then().statusCode(400);
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
