package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
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
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Moving organizations whose members came from Alfresco onto memberships. */
@QuarkusTest
@TestProfile(NativeMembershipMigrationTest.ImportStub.class)
class NativeMembershipMigrationTest {

    /** The platform profile, importing from the stub Alfresco clients. */
    public static class ImportStub extends PlatformTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            Map<String, String> overrides = new HashMap<>(super.getConfigOverrides());
            overrides.put(NativeMembershipMigration.IMPORT_STUB_PROPERTY, "true");
            return overrides;
        }
    }

    private static final String ORG = "bridge-org";
    private static final String NO_GROUP = "bridge-nogroup";
    private static final String MIGRATE = "/api/v1/platform/orgs/native-migration";
    private static final String LEFT = "left.the.group@bridge.test";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, alfresco_group_id, "
                + "membership_source) VALUES ('" + ORG + "', 'Bridge', 'bridge-client', true, 'GROUP_bridge', "
                + "'ALFRESCO'), ('" + NO_GROUP + "', 'No group', 'nogroup-client', true, null, 'ALFRESCO')");
        // Recorded at an earlier sign-in, when Alfresco decided membership; no longer in the group.
        exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + LEFT + "') ON CONFLICT DO NOTHING");
        exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role, source, created_by) "
                + "SELECT o.id, u.id, 'MEMBER', 'ALFRESCO', 'alfresco' FROM miot_core.organizations o, "
                + "miot_iam.iam_user u WHERE o.slug = '" + ORG + "' AND u.email = '" + LEFT + "'");
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
                .body("find { it.organization == '" + ORG + "' }.suspended", is(1))
                .body("find { it.organization == '" + ORG + "' }.error", nullValue())
                .body("find { it.organization == '" + NO_GROUP + "' }.added", is(0));

        assertEquals("NATIVE", source(ORG));
        assertEquals("NATIVE", source(NO_GROUP));
        given().header("Authorization", bearer("dev.user@example.com"))
                .when().get("/api/v1/orgs/" + ORG + "/team/members")
                .then().statusCode(200)
                .body("members.findAll { it.status == 'ACTIVE' }.email", containsInAnyOrder("dev.user@example.com",
                        "cris.perez@example.com", "ana.soto@example.com"))
                .body("members.find { it.email == '" + LEFT + "' }.status", is("SUSPENDED"));

        given().header("Authorization", bearer(LEFT))
                .when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(403);

        // Nothing is left to move.
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(200)
                .body("findAll { it.organization == '" + ORG + "' }", empty());
    }

    @Test
    void managersAreOwnersOnlyWhileTheOrganizationHasNone() {
        assertEquals(BaseRole.OWNER, AlfrescoBridge.baseRoleOf("SITE_MANAGER", true));
        assertEquals(BaseRole.ADMIN, AlfrescoBridge.baseRoleOf("GROUP_ADMIN", false));
        assertEquals(BaseRole.MEMBER, AlfrescoBridge.baseRoleOf("SITE_COLLABORATOR", true));
        assertEquals(BaseRole.MEMBER, AlfrescoBridge.baseRoleOf(null, true));
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
