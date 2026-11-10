package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.anyOf;
import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertSame;

import com.microboxlabs.miot.core.alfresco.AlfrescoPerson;
import com.microboxlabs.miot.core.alfresco.IAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.alfresco.StubAlfrescoDirectoryClient;
import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.smallrye.common.vertx.VertxContext;
import io.quarkus.vertx.core.runtime.context.VertxContextSafetyToggle;
import io.vertx.core.Vertx;
import io.quarkus.test.junit.QuarkusMock;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.config.HttpClientConfig;
import io.restassured.config.RestAssuredConfig;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.SqlConnection;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.time.Duration;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.hibernate.reactive.mutiny.Mutiny;
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
            overrides.put("miot.iam.native-migration.every", "1m");
            overrides.put("quarkus.scheduler.enabled", "false");
            overrides.put(NativeMembershipMigration.TIMEOUT_PROPERTY, "5s");
            overrides.put("quarkus.datasource.reactive.max-size", "2");
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

    @Inject
    NativeMembershipMigration migration;

    @Inject
    Mutiny.SessionFactory sessionFactory;

    @Inject
    Vertx vertx;

    @Inject
    Pool pool;

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
        exec("DROP FUNCTION IF EXISTS miot_iam.slow_default_binding() CASCADE");
        exec("DELETE FROM miot_iam.iam_user WHERE email LIKE 'member%@defaults.test' OR email = 'remote@migration.test'");
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
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("findAll { it.organization == '" + ORG + "' }", empty());
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
                    .body("find { it.organization == '" + ORG + "' }.error", anyOf(
                            containsString("Not done after"), containsString("lock timeout"),
                            containsString("statement timeout")));
            assertEquals("ALFRESCO", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                    + ORG + "'"));
            holder.rollback();
        }
        assertLockReleased();
        assertPending();

        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE)
                .then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", nullValue());
        assertEquals("NATIVE", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                + ORG + "'"));
    }

    @Test
    void anAlfrescoTimeoutRollsBackAndContinuesWithTheNextOrganization() throws SQLException {
        exec("UPDATE miot_core.organizations SET alfresco_group_id = 'GROUP_timeout' WHERE slug = '" + ORG + "'");
        QuarkusMock.installMockForType(new StubAlfrescoDirectoryClient() {
            @Override
            public Uni<List<AlfrescoPerson>> listAllGroupMembers(String groupId) {
                assertNoOpenTransaction();
                return Uni.createFrom().nothing();
            }
        }, IAlfrescoDirectoryClient.class);
        String next = "zz-defaults-next";
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + next + "', 'Next', 'next-client', true, 'ALFRESCO')");
        try {
            given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                    .when().post(MIGRATE).then().statusCode(200)
                    .body("find { it.organization == '" + ORG + "' }.error", containsString("Not done after"))
                    .body("find { it.organization == '" + next + "' }.error", nullValue());
            assertEquals("NATIVE", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                    + next + "'"));
            assertPending();
            assertLockReleased();
            exec("UPDATE miot_core.organizations SET alfresco_group_id = null WHERE slug = '" + ORG + "'");
            given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                    .when().post(MIGRATE).then().statusCode(200)
                    .body("find { it.organization == '" + ORG + "' }.error", nullValue());
        } finally {
            exec("DELETE FROM miot_core.organizations WHERE slug = '" + next + "'");
        }
    }

    @Test
    void remoteMemberRolesAreReadBeforeTheTransactionAndConcurrentRunsShareThePool() throws SQLException {
        exec("UPDATE miot_core.organizations SET alfresco_group_id = 'GROUP_roles' WHERE slug = '" + ORG + "'");
        CompletableFuture<List<AlfrescoPerson>> people = new CompletableFuture<>();
        CompletableFuture<Void> reading = new CompletableFuture<>();
        QuarkusMock.installMockForType(new StubAlfrescoDirectoryClient() {
            @Override
            public Uni<List<AlfrescoPerson>> listAllGroupMembers(String groupId) {
                assertNoOpenTransaction();
                reading.complete(null);
                return Uni.createFrom().completionStage(people);
            }
        }, IAlfrescoDirectoryClient.class);
        QuarkusMock.installMockForType(new StubAlfrescoMembershipClient() {
            @Override
            public Uni<String> getRole(String personId, String groupId) {
                assertNoOpenTransaction();
                return Uni.createFrom().item("SITE_MANAGER");
            }
        }, IAlfrescoMembershipClient.class);
        Runnable migrate = () -> given().config(BOUNDED)
                .header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", nullValue());
        CompletableFuture<Void> first = CompletableFuture.runAsync(migrate);
        reading.orTimeout(10, java.util.concurrent.TimeUnit.SECONDS).join();
        assertSame(migration.migrateAll(), migration.migrateAll());
        CompletableFuture<Void> second = CompletableFuture.runAsync(migrate);
        people.complete(List.of(new AlfrescoPerson("remote@migration.test", "remote@migration.test",
                "Remote", "Member", "Remote Member")));
        CompletableFuture.allOf(first, second).orTimeout(15, java.util.concurrent.TimeUnit.SECONDS).join();
        assertLockReleased();
    }

    @Test
    void aGroupChangedDuringTheRemoteReadIsNotImported() throws SQLException {
        changeOrganizationDuringRead("alfresco_group_id = 'GROUP_changed'");
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", containsString("Alfresco group changed"));
        assertPending();
        assertNoMigrationBindings();
        assertLockReleased();
    }

    @Test
    void anOrganizationMovedByAnotherPodDuringTheRemoteReadIsNotImportedAgain() throws SQLException {
        changeOrganizationDuringRead("membership_source = 'NATIVE'");
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.added", is(0))
                .body("find { it.organization == '" + ORG + "' }.defaultsBound", is(0))
                .body("find { it.organization == '" + ORG + "' }.error", nullValue());
        assertNoMigrationBindings();
        assertEquals("0", query("SELECT count(*) FROM miot_iam.iam_audit_event "
                + "WHERE actor = 'native-migration' AND organization_id = "
                + "(SELECT id FROM miot_core.organizations WHERE slug = '" + ORG + "')"));
        assertLockReleased();
    }

    private void changeOrganizationDuringRead(String update) throws SQLException {
        exec("UPDATE miot_core.organizations SET alfresco_group_id = 'GROUP_before' WHERE slug = '" + ORG + "'");
        QuarkusMock.installMockForType(new StubAlfrescoDirectoryClient() {
            @Override
            public Uni<List<AlfrescoPerson>> listAllGroupMembers(String groupId) {
                assertNoOpenTransaction();
                try {
                    exec("UPDATE miot_core.organizations SET " + update + " WHERE slug = '" + ORG + "'");
                } catch (SQLException e) {
                    return Uni.createFrom().failure(e);
                }
                return Uni.createFrom().item(List.of(new AlfrescoPerson("remote@migration.test",
                        "remote@migration.test", "Remote", "Member", "Remote Member")));
            }
        }, IAlfrescoDirectoryClient.class);
    }

    @Test
    void readinessObservesAnotherPodsMigrationWithLocalMigrationDisabled() throws SQLException {
        NativeMembershipReadiness observer = new NativeMembershipReadiness(migration, true);
        refreshOnly();
        assertEquals(org.eclipse.microprofile.health.HealthCheckResponse.Status.DOWN,
                observer.call().await().atMost(Duration.ofSeconds(1)).getStatus());
        exec("UPDATE miot_core.organizations SET membership_source = 'NATIVE' WHERE slug = '" + ORG + "'");
        refreshOnly();
        assertEquals(org.eclipse.microprofile.health.HealthCheckResponse.Status.UP,
                observer.call().await().atMost(Duration.ofSeconds(1)).getStatus());
    }

    @Test
    void anActiveStatementCannotKeepTheMigrationLockAfterTimeout() throws SQLException {
        slowBindings(30);
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", anyOf(
                        containsString("Not done after"), containsString("statement timeout")));
        assertPending();
        assertLockReleased();
        assertNoMigrationBindings();
    }

    @Test
    void aTimeoutDuringTheFlushCommitsNoneOfItsRows() throws Exception {
        // Each insert is short, but the 449 of them outlast the timeout.
        slowBindings(0.03);
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", containsString("Not done after"));
        // Until no connection is still inserting a binding, had the flush gone on after the rollback.
        await().atMost(Duration.ofSeconds(30)).pollInterval(Duration.ofMillis(200)).until(() -> "0".equals(query(
                "SELECT count(*) FROM pg_stat_activity WHERE pid <> pg_backend_pid() AND state = 'active' "
                        + "AND query ILIKE 'insert into %iam_role_binding%'")));
        assertNoMigrationBindings();
        assertPending();
        assertLockReleased();
    }

    @Test
    void aTimeoutRollsBackImportedMembersAndAuditAlongWithDefaultBindings() throws SQLException {
        exec("UPDATE miot_core.organizations SET alfresco_group_id = 'GROUP_atomic' WHERE slug = '" + ORG + "'");
        List<AlfrescoPerson> people = new java.util.ArrayList<>();
        for (int i = 1; i <= MEMBERS; i++) {
            String email = "member" + i + "@defaults.test";
            people.add(new AlfrescoPerson(email, email, "Member", "Existing", "Existing Member"));
        }
        people.add(new AlfrescoPerson("remote@migration.test", "remote@migration.test",
                "Remote", "Member", "Remote Member"));
        QuarkusMock.installMockForType(new StubAlfrescoDirectoryClient() {
            @Override
            public Uni<List<AlfrescoPerson>> listAllGroupMembers(String groupId) {
                return Uni.createFrom().item(people);
            }
        }, IAlfrescoDirectoryClient.class);
        slowBindings(0.03);
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", containsString("Not done after"));
        assertEquals("0", query("SELECT count(*) FROM miot_iam.iam_user WHERE email = 'remote@migration.test'"));
        assertEquals("0", query("SELECT count(*) FROM miot_iam.iam_audit_event "
                + "WHERE actor = 'native-migration' AND organization_id = "
                + "(SELECT id FROM miot_core.organizations WHERE slug = '" + ORG + "')"));
        assertNoMigrationBindings();
        assertPending();
        assertLockReleased();
    }

    @Test
    void aLostControlConnectionStillDrainsTheFlushBeforeRollback() throws SQLException {
        slowBindings(0.02);
        CompletableFuture<Void> run = CompletableFuture.runAsync(() -> given().config(BOUNDED)
                .header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", containsString("Not done after")));
        await().atMost(Duration.ofSeconds(3)).until(() -> "1".equals(query(
                "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() AND state = 'active' "
                        + "AND query ILIKE 'insert into %iam_role_binding%'")));
        // Both reactive leases are occupied: one flush, one idle control connection. End the latter.
        assertEquals("t", query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity "
                + "WHERE datname = current_database() AND application_name = 'vertx-pg-client' "
                + "AND state = 'idle' AND query = 'SELECT 1'"));
        run.orTimeout(30, java.util.concurrent.TimeUnit.SECONDS).join();
        assertNoMigrationBindings();
        assertPending();
        assertLockReleased();
    }

    @Test
    void aNewPendingOrganizationKeepsReadinessDownEvenAfterAnEarlierSuccessfulRun() throws SQLException {
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200)
                .body("find { it.organization == '" + ORG + "' }.error", nullValue());
        given().when().get("/q/health/ready").then().statusCode(200)
                .body("checks.find { it.name == 'native-membership-migration' }.status", is("UP"));
        String pending = "defaults-created-later";
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + pending + "', 'Pending', 'pending-client', true, 'ALFRESCO')");
        try {
            refreshOnly();
            given().when().get("/q/health/ready").then().statusCode(503)
                    .body("checks.find { it.name == 'native-membership-migration' }.status", is("DOWN"));
        } finally {
            exec("DELETE FROM miot_core.organizations WHERE slug = '" + pending + "'");
        }
    }

    @Test
    void repeatedReadinessCallsUseNoDatabaseConnection() {
        given().config(BOUNDED).header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().post(MIGRATE).then().statusCode(200);
        var stats = sessionFactory.getStatistics();
        long queries = stats.getQueryExecutionCount();
        SqlConnection first = pool.getConnection().await().atMost(Duration.ofSeconds(2));
        SqlConnection second = pool.getConnection().await().atMost(Duration.ofSeconds(2));
        try {
            NativeMembershipReadiness readiness = new NativeMembershipReadiness(migration, true);
            for (int i = 0; i < 1000; i++) {
                assertEquals(org.eclipse.microprofile.health.HealthCheckResponse.Status.UP,
                        readiness.call().await().atMost(Duration.ofSeconds(1)).getStatus());
            }
            assertEquals(queries, stats.getQueryExecutionCount());
        } finally {
            second.close().await().atMost(Duration.ofSeconds(2));
            first.close().await().atMost(Duration.ofSeconds(2));
        }
    }

    private void refreshOnly() {
        CompletableFuture<Void> refreshed = new CompletableFuture<>();
        var context = VertxContext.getOrCreateDuplicatedContext(vertx.getOrCreateContext());
        VertxContextSafetyToggle.setContextSafe(context, true);
        context.runOnContext(ignored -> new NativeMembershipReadiness(migration, true).refresh().subscribe()
                .with(refreshed::complete, refreshed::completeExceptionally));
        refreshed.orTimeout(10, java.util.concurrent.TimeUnit.SECONDS).join();
    }

    private void assertNoOpenTransaction() {
        try {
            assertEquals("0", query("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() "
                    + "AND state LIKE 'idle in transaction%'"));
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
    }

    private void slowBindings(double seconds) throws SQLException {
        exec("CREATE FUNCTION miot_iam.slow_default_binding() RETURNS trigger LANGUAGE plpgsql AS $$ "
                + "BEGIN PERFORM pg_sleep(" + seconds + "); RETURN NEW; END $$");
        exec("CREATE TRIGGER slow_default_binding BEFORE INSERT ON miot_iam.iam_role_binding "
                + "FOR EACH ROW EXECUTE FUNCTION miot_iam.slow_default_binding()");
    }

    private void assertNoMigrationBindings() throws SQLException {
        assertEquals("0", query("SELECT count(*) FROM miot_iam.iam_role_binding WHERE created_by = '"
                + NativeMembershipMigration.ACTOR + "'"));
    }

    private void assertPending() throws SQLException {
        assertEquals("ALFRESCO", query("SELECT membership_source FROM miot_core.organizations WHERE slug = '"
                + ORG + "'"));
        given().when().get("/q/health/ready").then().statusCode(503)
                .body("checks.find { it.name == 'native-membership-migration' }.status", is("DOWN"));
    }

    private void assertLockReleased() throws SQLException {
        assertEquals("t", query("SELECT pg_try_advisory_xact_lock(hashtext('iam-alfresco-import:" + ORG + "'))"));
        assertEquals("0", query("SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() "
                + "AND state LIKE 'idle in transaction%'"));
        // This profile has exactly two leases: both the transaction and its reserved control must be returned.
        SqlConnection first = pool.getConnection().await().atMost(Duration.ofSeconds(2));
        try {
            SqlConnection second = pool.getConnection().await().atMost(Duration.ofSeconds(2));
            second.close().await().atMost(Duration.ofSeconds(2));
        } finally {
            first.close().await().atMost(Duration.ofSeconds(2));
        }
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
