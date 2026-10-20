package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;

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

/** Moving organizations whose members came from Alfresco onto memberships. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class NativeMembershipMigrationTest {

    private static final String ORG = "bridge-org";
    private static final String NO_GROUP = "bridge-nogroup";
    private static final String MIGRATE = "/api/v1/platform/orgs/native-migration";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, alfresco_group_id, "
                + "membership_source) VALUES ('" + ORG + "', 'Bridge', 'bridge-client', true, 'GROUP_bridge', "
                + "'ALFRESCO'), ('" + NO_GROUP + "', 'No group', 'nogroup-client', true, null, 'ALFRESCO')");
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug IN ('" + ORG + "', '" + NO_GROUP + "')");
    }

    @Test
    void theGroupBecomesMembershipsAndTheOrganizationNative() throws SQLException {
        // Before the move, Alfresco no longer admits anyone.
        given().header("Authorization", bearer(StubAlfrescoMembershipClient.MEMBER_EMAIL))
                .when().get("/api/v1/me/scopes")
                .then().statusCode(200).body("slug", not(hasItem(ORG)));

        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.added", is(3))
                .body("find { it.organization == '" + NO_GROUP + "' }.added", is(0));

        assertEquals("NATIVE", source(ORG));
        assertEquals("NATIVE", source(NO_GROUP));
        given().header("Authorization", bearer("dev.user@example.com"))
                .when().get("/api/v1/orgs/" + ORG + "/team/members")
                .then().statusCode(200)
                .body("members.email", containsInAnyOrder("dev.user@example.com", "cris.perez@example.com",
                        "ana.soto@example.com"))
                .body("members.source", containsInAnyOrder("ALFRESCO", "ALFRESCO", "ALFRESCO"));

        // Nothing is left to move.
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(200)
                .body("findAll { it.organization == '" + ORG + "' }", empty());
    }

    @Test
    void onlyPlatformOwnersMayRunIt() {
        given().header("Authorization", bearer(PlatformTestProfile.NON_OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(403);
    }

    private String source(String slug) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                var rs = st.executeQuery("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                        + slug + "'")) {
            rs.next();
            return rs.getString(1);
        }
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
