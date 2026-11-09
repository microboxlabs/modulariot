package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.config.HttpClientConfig;
import io.restassured.config.RestAssuredConfig;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Binding legacy-default roles when an organization with many members moves to native membership. */
@QuarkusTest
@TestProfile(NativeMembershipMigrationDefaultsTest.LegacyDefaults.class)
class NativeMembershipMigrationDefaultsTest {

    /**
     * Imports from the stub clients, with three modules that have a legacy-default role; no scheduled runs, and a
     * short timeout.
     */
    public static class LegacyDefaults extends NativeMembershipMigrationTest.ImportStub {
        @Override
        public Map<String, String> getConfigOverrides() {
            Map<String, String> overrides = new HashMap<>(super.getConfigOverrides());
            overrides.put(LegacyDefaultsTestCatalog.PROPERTY, "true");
            overrides.put("miot.iam.native-migration.every", "off");
            overrides.put(NativeMembershipMigration.TIMEOUT_PROPERTY, "5s");
            return overrides;
        }
    }

    private static final String ORG = "defaults-org";
    private static final int MEMBERS = 150;
    private static final String MIGRATE = "/api/v1/platform/orgs/native-migration";
    private static final RestAssuredConfig BOUNDED = RestAssuredConfig.config().httpClient(HttpClientConfig
            .httpClientConfig().setParam("http.socket.timeout", 60_000).setParam("http.connection.timeout", 5_000));

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, alfresco_group_id, "
                + "membership_source) VALUES ('" + ORG + "', 'Defaults', 'defaults-client', true, null, 'ALFRESCO')");
        exec("INSERT INTO miot_iam.iam_user (email) SELECT 'member' || g || '@defaults.test' "
                + "FROM generate_series(1, " + MEMBERS + ") g ON CONFLICT DO NOTHING");
        exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role, source, created_by) "
                + "SELECT o.id, u.id, 'MEMBER', 'ALFRESCO', 'test' FROM miot_core.organizations o, "
                + "miot_iam.iam_user u WHERE o.slug = '" + ORG + "' AND u.email LIKE 'member%@defaults.test'");
        // member1 already holds a role of module A and member2 one of a module this modulith does not have; one user
        // binding names a principal that is not a UUID, and one the organization's client.
        exec("INSERT INTO miot_iam.iam_role_binding (id, organization_id, principal_kind, principal_id, role_key, "
                + "created_by) SELECT gen_random_uuid(), o.id, 'USER', u.id::text, '"
                + LegacyDefaultsTestCatalog.OTHER_ROLE + "', 'test' FROM miot_core.organizations o, "
                + "miot_iam.iam_user u WHERE o.slug = '" + ORG + "' AND u.email = 'member1@defaults.test'");
        exec("INSERT INTO miot_iam.iam_role_binding (id, organization_id, principal_kind, principal_id, role_key, "
                + "created_by) SELECT gen_random_uuid(), o.id, 'USER', u.id::text, 'GONE_MODULE_VIEWER', 'test' "
                + "FROM miot_core.organizations o, miot_iam.iam_user u WHERE o.slug = '" + ORG
                + "' AND u.email = 'member2@defaults.test'");
        exec("INSERT INTO miot_iam.iam_role_binding (id, organization_id, principal_kind, principal_id, role_key, "
                + "created_by) SELECT gen_random_uuid(), o.id, 'USER', 'not-a-uuid', '"
                + LegacyDefaultsTestCatalog.viewer("legacyb") + "', 'test' FROM miot_core.organizations o "
                + "WHERE o.slug = '" + ORG + "'");
        exec("INSERT INTO miot_iam.iam_role_binding (id, organization_id, principal_kind, principal_id, role_key, "
                + "created_by) SELECT gen_random_uuid(), o.id, 'CLIENT', 'defaults-client', '"
                + LegacyDefaultsTestCatalog.viewer("legacyc") + "', 'test' FROM miot_core.organizations o "
                + "WHERE o.slug = '" + ORG + "'");
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_iam.iam_role_binding WHERE organization_id IN (SELECT id FROM "
                + "miot_core.organizations WHERE slug = '" + ORG + "')");
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
        exec("DELETE FROM miot_iam.iam_user WHERE email LIKE 'member%@defaults.test'");
    }

    @Test
    void everyMemberGetsTheDefaultRolesOfTheModulesTheyLack() throws SQLException {
        // member1 holds a module A role already, so it gets only B and C.
        int expected = MEMBERS * LegacyDefaultsTestCatalog.MODULES.size() - 1;
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", nullValue())
                .body("find { it.organization == '" + ORG + "' }.defaultsBound", is(expected));

        assertEquals("NATIVE", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                + ORG + "'"));
        assertEquals(String.valueOf(expected), query("SELECT count(*) FROM miot_iam.iam_role_binding b "
                + "JOIN miot_core.organizations o ON o.id = b.organization_id WHERE o.slug = '" + ORG
                + "' AND b.created_by = '" + NativeMembershipMigration.ACTOR + "'"));
    }

    @Test
    void aRunThatDoesNotFinishFailsAndTheNextOneMovesTheOrganization() throws SQLException {
        try (Connection holder = ds.getConnection()) {
            // Another run holds the organization's lock.
            holder.setAutoCommit(false);
            try (var st = holder.createStatement()) {
                st.execute("SELECT pg_advisory_xact_lock(hashtext('iam-alfresco-import:" + ORG + "'))");
            }
            given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                    .when().post(MIGRATE)
                    .then().statusCode(200)
                    .body("find { it.organization == '" + ORG + "' }.error", containsString("Not done after"));
            assertEquals("ALFRESCO", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                    + ORG + "'"));
            holder.rollback();
        }

        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", nullValue());
        assertEquals("NATIVE", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                + ORG + "'"));
    }

    private String query(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement(); var rs = st.executeQuery(sql)) {
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
