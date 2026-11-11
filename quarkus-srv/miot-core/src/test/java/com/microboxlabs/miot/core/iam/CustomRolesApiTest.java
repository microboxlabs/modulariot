package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.response.ValidatableResponse;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.time.Duration;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.TimeUnit;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

/** Custom roles end to end on a native organization with one sub-account, and a second organization. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class CustomRolesApiTest {

    private static final String ORG = "custom-roles-org";
    private static final String SUB = "custom-roles-north";
    private static final String OTHER = "custom-roles-other";
    private static final String OWNER = "owner@roles.test";
    private static final String ADMIN = "admin@roles.test";
    private static final String ANA = "ana@roles.test";
    private static final String BASE = "/api/v1/orgs/" + ORG + "/team";
    private static final String ROLES = BASE + "/custom-roles";
    private static final String ACCESS = "/api/v1/orgs/" + ORG + "/me/access";
    private static final String GEOGRAPHIC = CoordinatorAccessCatalog.GEOGRAPHIC_VIEW;

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'Roles', 'roles-client', true, 'NATIVE')");
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + OTHER + "', 'Other', 'roles-other-client', true, 'NATIVE')");
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, parent_id) "
                + "SELECT '" + SUB + "', 'North', 'roles-client', true, id FROM miot_core.organizations WHERE slug = '"
                + ORG + "'");
        for (String[] m : new String[][] {{OWNER, "OWNER", ORG}, {ADMIN, "ADMIN", ORG}, {ANA, "MEMBER", ORG},
                {OWNER, "OWNER", OTHER}}) {
            exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + m[0] + "') ON CONFLICT DO NOTHING");
            exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                    + "SELECT o.id, u.id, '" + m[1] + "' FROM miot_core.organizations o, miot_iam.iam_user u "
                    + "WHERE o.slug = '" + m[2] + "' AND u.email = '" + m[0] + "'");
        }
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug IN ('" + SUB + "', '" + ORG + "', '" + OTHER + "')");
    }

    @Test
    void anOwnerCreatesListsEditsAndDeletesACustomRole() {
        String id = create(OWNER, ROLES, "Supervisor de ruta", GEOGRAPHIC, CoreAccessCatalog.AUDIT_READ)
                .statusCode(201)
                .body("key", is("custom:supervisor-de-ruta"))
                .body("label.es", is("Supervisor de ruta"))
                .body("label.en", is("Supervisor de ruta"))
                .body("permissions", contains(CoreAccessCatalog.AUDIT_READ, GEOGRAPHIC))
                .body("createdBy", is(OWNER))
                .body("holders.members", is(0))
                .extract().path("id");

        given().header("Authorization", bearer(ANA)).when().get(ROLES)
                .then().statusCode(200).body("key", contains("custom:supervisor-de-ruta"));

        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("label", Map.of("es", "Supervisor", "en", "Supervisor EN"),
                        "description", Map.of("es", "Ve el mapa."), "permissions", List.of(GEOGRAPHIC)))
                .when().put(ROLES + "/" + id)
                .then().statusCode(200)
                .body("key", is("custom:supervisor-de-ruta"))
                .body("label.en", is("Supervisor EN"))
                .body("description.es", is("Ve el mapa."))
                .body("permissions", contains(GEOGRAPHIC))
                .body("updatedBy", is(ADMIN));

        given().header("Authorization", bearer(OWNER)).when().delete(ROLES + "/" + id)
                .then().statusCode(200).body("removedBindings", is(0));
        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200).body("$", empty());
        given().header("Authorization", bearer(OWNER)).when().delete(ROLES + "/" + id).then().statusCode(404);

        assertEquals(List.of("custom-role.created", "custom-role.updated", "custom-role.deleted"),
                auditActions("custom:supervisor-de-ruta"));
    }

    @Test
    void aRequestIsValidated() {
        create(OWNER, ROLES, "Sin permisos").statusCode(400);
        create(OWNER, ROLES, "Desconocido", "platform:owners.manage").statusCode(400);
        create(OWNER, ROLES, " ", GEOGRAPHIC).statusCode(400);
        create(OWNER, ROLES, "x".repeat(81), GEOGRAPHIC).statusCode(400);

        create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).body("key", is("custom:mapa"));
        // The name is unique in the organization, whatever the case.
        create(OWNER, ROLES, "MAPA", GEOGRAPHIC).statusCode(409);
        // Another name with the same slug gets its own key.
        create(OWNER, ROLES, "Mapa!", GEOGRAPHIC).statusCode(201).body("key", is("custom:mapa-2"));
        // Another organization may use the same name.
        create(OWNER, "/api/v1/orgs/" + OTHER + "/team/custom-roles", "Mapa", GEOGRAPHIC).statusCode(201);
    }

    @Test
    void onlyAnOwnerOrAdminChangesCustomRoles() {
        String id = create(ADMIN, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract().path("id");
        // A member holding members:update through a custom role is still not an administrator.
        String manager = create(OWNER, ROLES, "Gestor", CoreAccessCatalog.MEMBERS_UPDATE,
                CoreAccessCatalog.TEAMS_MANAGE).statusCode(201).extract().path("key");
        bind(OWNER, "USER", userId(ANA), manager, null).statusCode(201);

        create(ANA, ROLES, "Otro", GEOGRAPHIC).statusCode(403);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("label", Map.of("es", "Mapa"), "permissions", List.of(GEOGRAPHIC)))
                .when().put(ROLES + "/" + id).then().statusCode(403);
        given().header("Authorization", bearer(ANA)).when().delete(ROLES + "/" + id).then().statusCode(403);
        given().when().get(ROLES).then().statusCode(401);
        // Not a member of the other organization.
        create(ADMIN, "/api/v1/orgs/" + OTHER + "/team/custom-roles", "Mapa", GEOGRAPHIC).statusCode(403);

        // An admin does not hold owner-only permissions, so cannot put them in a role or grant such a role.
        create(ADMIN, ROLES, "Dueños", CoreAccessCatalog.OWNERS_MANAGE).statusCode(403);
        String owners = create(OWNER, ROLES, "Dueños", CoreAccessCatalog.OWNERS_MANAGE)
                .statusCode(201).extract().path("key");
        bind(ADMIN, "USER", userId(ANA), owners, null).statusCode(403);
    }

    @Test
    void anEditWaitingForTheLockCannotRestoreTheActorsRevokedPermission()
            throws SQLException, InterruptedException, ExecutionException, TimeoutException {
        var role = create(OWNER, ROLES, "Gestor anterior", CoreAccessCatalog.OWNERS_MANAGE, GEOGRAPHIC)
                .statusCode(201).extract();
        String id = role.path("id");
        bind(OWNER, "USER", userId(ADMIN), role.path("key"), null).statusCode(201);
        CompletableFuture<io.restassured.response.Response> change = null;
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try (var lock = c.prepareStatement("SELECT id FROM miot_core.organizations WHERE slug = ? FOR UPDATE");
                    var update = c.prepareStatement(
                            "UPDATE miot_iam.iam_custom_role SET permission_keys = ? WHERE id = ?::uuid")) {
                lock.setString(1, ORG);
                try (var rows = lock.executeQuery()) {
                    rows.next();
                }
                update.setString(1, GEOGRAPHIC);
                update.setString(2, id);
                update.executeUpdate();
                change = CompletableFuture.supplyAsync(() -> given().header("Authorization", bearer(ADMIN))
                        .contentType("application/json").body(Map.of("label", Map.of("es", "Gestor anterior"),
                                "permissions", List.of(CoreAccessCatalog.OWNERS_MANAGE, GEOGRAPHIC)))
                        .when().put(ROLES + "/" + id));
                await().atMost(Duration.ofSeconds(15)).until(() -> count(
                        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() "
                                + "AND wait_event_type = 'Lock' AND query LIKE '%organizations%'") > 0);
                c.commit();
            } finally {
                c.rollback();
            }
        } finally {
            if (change != null) {
                assertEquals(403, change.get(30, TimeUnit.SECONDS).statusCode());
            }
        }
        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200)
                .body("[0].permissions", contains(GEOGRAPHIC));
    }

    @Test
    void aGrantWaitingForTheLockCannotUseARevokedPermission()
            throws SQLException, InterruptedException, ExecutionException, TimeoutException {
        String ana = userId(ANA);
        var manager = create(OWNER, ROLES, "Gestor limitado", CoreAccessCatalog.MEMBERS_UPDATE, GEOGRAPHIC)
                .statusCode(201).extract();
        String managerId = manager.path("id");
        bind(OWNER, "USER", ana, manager.path("key"), null).statusCode(201);
        String wanted = create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract().path("key");
        CompletableFuture<io.restassured.response.Response> change = null;
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try (var lock = c.prepareStatement("SELECT id FROM miot_core.organizations WHERE slug = ? FOR UPDATE");
                    var update = c.prepareStatement(
                            "UPDATE miot_iam.iam_custom_role SET permission_keys = ? WHERE id = ?::uuid")) {
                lock.setString(1, ORG);
                try (var rows = lock.executeQuery()) {
                    rows.next();
                }
                update.setString(1, CoreAccessCatalog.MEMBERS_UPDATE);
                update.setString(2, managerId);
                update.executeUpdate();
                change = CompletableFuture.supplyAsync(() -> given().header("Authorization", bearer(ANA))
                        .contentType("application/json").body(Map.of("principalKind", "USER", "principalId", ana,
                                "role", wanted)).when().post(BASE + "/bindings"));
                await().atMost(Duration.ofSeconds(15)).until(() -> count(
                        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() "
                                + "AND wait_event_type = 'Lock' AND query LIKE '%organizations%'") > 0);
                c.commit();
            } finally {
                c.rollback();
            }
        } finally {
            if (change != null) {
                assertEquals(403, change.get(30, TimeUnit.SECONDS).statusCode());
            }
        }
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", not(hasItem(GEOGRAPHIC)));
    }

    @Test
    void aGrantWaitingForTheLockCannotReuseADemotedMembership()
            throws SQLException, InterruptedException, ExecutionException, TimeoutException {
        String ana = userId(ANA);
        exec("UPDATE miot_iam.iam_membership SET base_role = 'OWNER' WHERE user_id = '" + ana + "'");
        String wanted = create(OWNER, ROLES, "Propietarios delegados", CoreAccessCatalog.MEMBERS_UPDATE,
                CoreAccessCatalog.OWNERS_MANAGE).statusCode(201).extract().path("key");
        CompletableFuture<io.restassured.response.Response> change = null;
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try (var lock = c.prepareStatement("SELECT id FROM miot_core.organizations WHERE slug = ? FOR UPDATE");
                    var update = c.prepareStatement(
                            "UPDATE miot_iam.iam_membership SET base_role = 'MEMBER' WHERE user_id = ?::uuid")) {
                lock.setString(1, ORG);
                try (var rows = lock.executeQuery()) {
                    rows.next();
                }
                update.setString(1, ana);
                update.executeUpdate();
                change = CompletableFuture.supplyAsync(() -> given().header("Authorization", bearer(ANA))
                        .contentType("application/json").body(Map.of("principalKind", "USER", "principalId", ana,
                                "role", wanted)).when().post(BASE + "/bindings"));
                await().atMost(Duration.ofSeconds(15)).until(() -> count(
                        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() "
                                + "AND wait_event_type = 'Lock' AND query LIKE '%organizations%'") > 0);
                c.commit();
            } finally {
                c.rollback();
            }
        } finally {
            if (change != null) {
                assertEquals(403, change.get(30, TimeUnit.SECONDS).statusCode());
            }
        }
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("baseRole", is("MEMBER"))
                .body("permissions", not(hasItem(CoreAccessCatalog.OWNERS_MANAGE)));
    }

    @ParameterizedTest
    @CsvSource({"true,true", "true,false", "false,true", "false,false"})
    void memberMutationsUseCurrentAuthorityAndTargetRole(boolean revokeActor, boolean remove)
            throws SQLException, InterruptedException, ExecutionException, TimeoutException {
        String ana = userId(ANA);
        String actor = revokeActor ? ANA : ADMIN;
        String target = revokeActor ? userId(ADMIN) : ana;
        String changedId = target;
        String value = "OWNER";
        String updateSql = "UPDATE miot_iam.iam_membership SET base_role = ? WHERE user_id = ?::uuid";
        if (revokeActor) {
            var manager = create(OWNER, ROLES, "Gestor de miembros", CoreAccessCatalog.MEMBERS_UPDATE,
                    CoreAccessCatalog.MEMBERS_REMOVE, CoreAccessCatalog.OWNERS_MANAGE).statusCode(201).extract();
            bind(OWNER, "USER", ana, manager.path("key"), null).statusCode(201);
            changedId = manager.path("id");
            value = GEOGRAPHIC;
            updateSql = "UPDATE miot_iam.iam_custom_role SET permission_keys = ? WHERE id = ?::uuid";
        }
        CompletableFuture<io.restassured.response.Response> change = null;
        try (Connection c = ds.getConnection()) {
            c.setAutoCommit(false);
            try (var lock = c.prepareStatement("SELECT id FROM miot_core.organizations WHERE slug = ? FOR UPDATE");
                    var update = c.prepareStatement(updateSql)) {
                lock.setString(1, ORG);
                try (var rows = lock.executeQuery()) {
                    rows.next();
                }
                update.setString(1, value);
                update.setString(2, changedId);
                update.executeUpdate();
                change = CompletableFuture.supplyAsync(() -> {
                    var request = given().header("Authorization", bearer(actor));
                    if (remove) {
                        return request.when().delete(BASE + "/members/" + target);
                    }
                    return request.contentType("application/json").body(Map.of("baseRole", "MEMBER"))
                            .when().patch(BASE + "/members/" + target);
                });
                await().atMost(Duration.ofSeconds(15)).until(() -> count(
                        "SELECT count(*) FROM pg_stat_activity WHERE datname = current_database() "
                                + "AND wait_event_type = 'Lock' AND query LIKE '%organizations%'") > 0);
                c.commit();
            } finally {
                c.rollback();
            }
        } finally {
            if (change != null) {
                assertEquals(403, change.get(30, TimeUnit.SECONDS).statusCode());
            }
        }
        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/members").then().statusCode(200)
                .body("members.find { it.userId == '" + target + "' }.baseRole", is(revokeActor ? "ADMIN" : "OWNER"));
    }

    @Test
    void aSubAccountAdministratorCannotChangeRootRolesOrServiceAccounts() throws SQLException {
        String childAdmin = "child.admin@roles.test";
        exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + childAdmin + "') ON CONFLICT DO NOTHING");
        exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                + "SELECT o.id, u.id, 'ADMIN' FROM miot_core.organizations o, miot_iam.iam_user u "
                + "WHERE o.slug = '" + SUB + "' AND u.email = '" + childAdmin + "'");
        String childBase = "/api/v1/orgs/" + SUB + "/team";
        given().header("Authorization", bearer(childAdmin)).when().get(childBase + "/custom-roles/management")
                .then().statusCode(200).body("canManage", is(false));
        given().header("Authorization", bearer(OWNER)).when().get(childBase + "/custom-roles/management")
                .then().statusCode(200).body("canManage", is(true));
        String roleId = create(OWNER, ROLES, "Mapa raíz", GEOGRAPHIC).statusCode(201).extract().path("id");
        create(childAdmin, childBase + "/custom-roles", "No permitido", GEOGRAPHIC).statusCode(403);
        given().header("Authorization", bearer(childAdmin)).contentType("application/json")
                .body(Map.of("label", Map.of("es", "No permitido"), "permissions", List.of(GEOGRAPHIC)))
                .when().put(childBase + "/custom-roles/" + roleId).then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).when()
                .delete(childBase + "/custom-roles/" + roleId).then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of(ANA)))
                .when().put("/api/v1/orgs/" + SUB + "/roles/custom:mapa-raiz").then().statusCode(403);

        var account = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Integrador raíz", "roles", List.of())).when().post(BASE + "/service-accounts")
                .then().statusCode(201).extract();
        String accountId = account.path("serviceAccount.id");
        String keyId = account.path("serviceAccount.keys[0].id");
        String accounts = childBase + "/service-accounts";
        given().header("Authorization", bearer(childAdmin)).when().get(accounts).then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).contentType("application/json")
                .body(Map.of("name", "No permitido", "roles", List.of(CoreAccessCatalog.HARNESS_TRAINER)))
                .when().post(accounts).then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).contentType("application/json")
                .body(Map.of("roles", List.of())).when().put(accounts + "/" + accountId + "/roles")
                .then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).contentType("application/json")
                .body("{\"credentialRef\":null}").when().put(accounts + "/" + accountId + "/token-credential")
                .then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).contentType("application/json")
                .body(Map.of("name", "No permitido")).when().post(accounts + "/" + accountId + "/keys")
                .then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).when()
                .delete(accounts + "/" + accountId + "/keys/" + keyId).then().statusCode(403);
        given().header("Authorization", bearer(childAdmin)).when().delete(accounts + "/" + accountId)
                .then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200)
                .body("[0].label.es", is("Mapa raíz"));
    }

    @Test
    void childPermissionsCannotBeGrantedAsRootBindings() throws SQLException {
        String ana = userId(ANA);
        exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                + "SELECT id, '" + ana + "', 'ADMIN' FROM miot_core.organizations WHERE slug = '" + SUB + "'");
        String manager = create(OWNER, ROLES, "Gestor raíz", CoreAccessCatalog.MEMBERS_UPDATE,
                CoreAccessCatalog.TEAMS_MANAGE, CoreAccessCatalog.APIKEYS_MANAGE)
                .statusCode(201).extract().path("key");
        bind(OWNER, "USER", ana, manager, null).statusCode(201);
        String geographic = create(OWNER, ROLES, "Mapa raíz", GEOGRAPHIC).statusCode(201).extract().path("key");
        String childBase = "/api/v1/orgs/" + SUB + "/team";
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("principalKind", "USER", "principalId", ana, "role", geographic))
                .when().post(childBase + "/bindings").then().statusCode(403);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("roles", List.of(manager, geographic))).when().put(childBase + "/members/" + ana + "/roles")
                .then().statusCode(403);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("name", "No permitido", "roles", List.of(geographic)))
                .when().post(childBase + "/service-accounts").then().statusCode(403);
        String team = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Mapa raíz")).when().post(BASE + "/teams")
                .then().statusCode(201).extract().path("id");
        bind(OWNER, "TEAM", team, geographic, null).statusCode(201);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("roles", List.of(geographic))).when().put(childBase + "/teams/" + team + "/roles")
                .then().statusCode(403);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("userIds", List.of(ana))).when().put(childBase + "/teams/" + team + "/members")
                .then().statusCode(403);
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", not(hasItem(GEOGRAPHIC)));
    }

    @Test
    void replacingPersonHoldersPreservesTeamsAndServiceAccounts() {
        String key = create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract().path("key");
        String team = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Equipo mapa")).when().post(BASE + "/teams")
                .then().statusCode(201).extract().path("id");
        bind(OWNER, "TEAM", team, key, null).statusCode(201);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Integrador mapa", "roles", List.of(key))).when().post(BASE + "/service-accounts")
                .then().statusCode(201);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of(ANA))).when().put("/api/v1/orgs/" + ORG + "/roles/" + key)
                .then().statusCode(200);
        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200)
                .body("[0].holders.members", is(1)).body("[0].holders.teams", is(1))
                .body("[0].holders.serviceAccounts", is(1));
    }

    @Test
    void expiredBindingsAreDeletedButDoNotCountAsHolders() throws SQLException {
        var role = create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract();
        String key = role.path("key");
        bind(OWNER, "USER", userId(ANA), key, null).statusCode(201);
        exec("UPDATE miot_iam.iam_role_binding SET expires_at = now() - interval '1 day' WHERE role_key = '"
                + key + "'");
        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200)
                .body("[0].holders.members", is(0));
        given().header("Authorization", bearer(OWNER)).when().delete(ROLES + "/" + role.path("id"))
                .then().statusCode(200).body("holders.members", is(0)).body("removedBindings", is(1));
    }

    @Test
    void aBoundCustomRoleGivesItsPermissionsToMembersTeamsAndServiceAccounts() {
        String ana = userId(ANA);
        String key = create(OWNER, ROLES, "Invitador", CoreAccessCatalog.MEMBERS_INVITE, GEOGRAPHIC)
                .statusCode(201).extract().path("key");
        String probe = "/api/v1/orgs/" + ORG + "/iam-probe";
        given().header("Authorization", bearer(ANA)).when().get(probe).then().statusCode(403);

        // A member, through the roles editor.
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("roles", List.of(key, CoordinatorAccessCatalog.KANBAN_USER)))
                .when().put(BASE + "/members/" + ana + "/roles")
                .then().statusCode(200).body("roles", containsInAnyOrder(key, CoordinatorAccessCatalog.KANBAN_USER));
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("roles", hasItem(key))
                .body("permissions", hasItems(CoreAccessCatalog.MEMBERS_INVITE, GEOGRAPHIC,
                        CoordinatorAccessCatalog.TASK_COMPLETE));
        // The permission check on an endpoint sees it too.
        given().header("Authorization", bearer(ANA)).when().get(probe).then().statusCode(200);

        // Editing the role changes what its holders may do at once.
        String id = given().header("Authorization", bearer(OWNER)).when().get(ROLES)
                .then().statusCode(200).body("[0].holders.members", is(1)).extract().path("[0].id");
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("label", Map.of("es", "Invitador"), "permissions", List.of(GEOGRAPHIC)))
                .when().put(ROLES + "/" + id).then().statusCode(200);
        given().header("Authorization", bearer(ANA)).when().get(probe).then().statusCode(403);
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", hasItem(GEOGRAPHIC))
                .body("permissions", not(hasItem(CoreAccessCatalog.MEMBERS_INVITE)));

        // A team.
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("roles", List.of())).when().put(BASE + "/members/" + ana + "/roles")
                .then().statusCode(200);
        String team = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"name\":\"Turno A\"}").when().post(BASE + "/teams")
                .then().statusCode(201).extract().path("id");
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("userIds", List.of(ana))).when().put(BASE + "/teams/" + team + "/members")
                .then().statusCode(200);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("roles", List.of(key))).when().put(BASE + "/teams/" + team + "/roles")
                .then().statusCode(200).body("roles", contains(key));
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", hasItem(GEOGRAPHIC));

        // A service account, with its API key.
        String secret = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Integrador", "roles", List.of(key))).when().post(BASE + "/service-accounts")
                .then().statusCode(201).body("serviceAccount.roles", contains(key)).extract().path("secret");
        given().header("Authorization", "Bearer " + secret).when().get(ACCESS).then().statusCode(200)
                .body("permissions", hasItem(GEOGRAPHIC));

        // M2M clients retain module roles until explicit-mode resolution is supported.
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of("some-client")))
                .when().put("/api/v1/orgs/" + ORG + "/roles/" + key)
                .then().statusCode(400);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of("some-client")))
                .when().put("/api/v1/orgs/" + ORG + "/roles/custom:missing").then().statusCode(400);
    }

    @Test
    void aCustomRoleBelongsToItsOrganization() {
        String ana = userId(ANA);
        String foreign = create(OWNER, "/api/v1/orgs/" + OTHER + "/team/custom-roles", "Ajeno", GEOGRAPHIC)
                .statusCode(201).extract().path("key");
        bind(OWNER, "USER", ana, foreign, null).statusCode(400);
        bind(OWNER, "USER", ana, "custom:missing", null).statusCode(400);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("emails", List.of("new@roles.test"), "baseRole", "MEMBER", "roles", List.of(foreign)))
                .when().post(BASE + "/invitations").then().statusCode(400);

        // A sub-account uses its parent's roles; a binding scoped to it applies there only.
        String key = create(OWNER, "/api/v1/orgs/" + SUB + "/team/custom-roles", "Mapa norte", GEOGRAPHIC)
                .statusCode(201).extract().path("key");
        given().header("Authorization", bearer(OWNER)).when().get(ROLES)
                .then().statusCode(200).body("key", contains(key));
        bind(OWNER, "USER", ana, key, SUB).statusCode(201);
        given().header("Authorization", bearer(ANA)).when().get("/api/v1/orgs/" + SUB + "/me/access")
                .then().statusCode(200).body("permissions", hasItem(GEOGRAPHIC));
        given().header("Authorization", bearer(ANA)).when().get(ACCESS)
                .then().statusCode(200).body("permissions", not(hasItem(GEOGRAPHIC)));
    }

    @Test
    void foreignRolesCannotBeReadEditedDeletedOrAssignedThroughOtherEndpoints() {
        String foreignPath = "/api/v1/orgs/" + OTHER + "/team/custom-roles";
        var foreign = create(OWNER, foreignPath, "Ajeno", GEOGRAPHIC).statusCode(201).extract();
        String id = foreign.path("id");
        String key = foreign.path("key");
        given().header("Authorization", bearer(ADMIN)).when().get(foreignPath).then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200).body("$", empty());
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("label", Map.of("es", "Cambiado"), "permissions", List.of(GEOGRAPHIC)))
                .when().put(ROLES + "/" + id).then().statusCode(404);
        given().header("Authorization", bearer(OWNER)).when().delete(ROLES + "/" + id)
                .then().statusCode(404);
        given().header("Authorization", bearer(ADMIN)).when().delete(foreignPath + "/" + id)
                .then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).when().get(foreignPath)
                .then().statusCode(200).body("key", contains(key));

        String ana = userId(ANA);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("roles", List.of(key))).when().put(BASE + "/members/" + ana + "/roles")
                .then().statusCode(400);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Foreign", "roles", List.of(key))).when().post(BASE + "/service-accounts")
                .then().statusCode(400);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of(ANA))).when().put("/api/v1/orgs/" + ORG + "/roles/" + key)
                .then().statusCode(400);
    }

    @Test
    void deletingARoleRemovesItsBindingsAndSaysHowMany() throws SQLException {
        String ana = userId(ANA);
        var created = create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract();
        String id = created.path("id");
        String key = created.path("key");
        String kept = create(OWNER, ROLES, "Auditor", CoreAccessCatalog.AUDIT_READ)
                .statusCode(201).extract().path("key");
        String team = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"name\":\"Turno A\"}").when().post(BASE + "/teams")
                .then().statusCode(201).extract().path("id");

        bind(OWNER, "USER", ana, key, null).statusCode(201);
        bind(OWNER, "USER", ana, key, SUB).statusCode(201);
        bind(OWNER, "TEAM", team, key, null).statusCode(201);
        bind(OWNER, "USER", ana, kept, null).statusCode(201);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("emails", List.of("new@roles.test"), "baseRole", "MEMBER",
                        "roles", List.of(key, kept)))
                .when().post(BASE + "/invitations").then().statusCode(201);

        given().header("Authorization", bearer(OWNER)).when().get(ROLES).then().statusCode(200)
                .body("find { it.key == '" + key + "' }.holders.members", is(1))
                .body("find { it.key == '" + key + "' }.holders.teams", is(1));

        given().header("Authorization", bearer(ADMIN)).when().delete(ROLES + "/" + id)
                .then().statusCode(200)
                .body("key", is(key))
                .body("removedBindings", is(3))
                .body("holders.members", is(1))
                .body("holders.teams", is(1))
                .body("holders.serviceAccounts", is(0));

        assertEquals(0, count("SELECT count(*) FROM miot_iam.iam_role_binding WHERE role_key = '" + key + "'"));
        assertEquals(1, count("SELECT count(*) FROM miot_iam.iam_role_binding WHERE role_key = '" + kept + "'"));
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("roles", contains(kept))
                .body("permissions", not(hasItem(GEOGRAPHIC)));
        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/invitations")
                .then().statusCode(200).body("[0].roles", contains(kept));
        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/bindings")
                .then().statusCode(200).body("$", hasSize(1));
    }

    @Test
    void aMemberWhoManagesMembersThroughARoleCannotMakeAdmins() {
        String ana = userId(ANA);
        String admin = userId(ADMIN);
        String manager = create(OWNER, ROLES, "Gestor", CoreAccessCatalog.MEMBERS_INVITE,
                CoreAccessCatalog.MEMBERS_UPDATE, CoreAccessCatalog.MEMBERS_REMOVE)
                .statusCode(201).extract().path("key");
        bind(OWNER, "USER", ana, manager, null).statusCode(201);

        invite(ANA, "new-admin@roles.test", "ADMIN").statusCode(403);
        invite(ANA, "new-member@roles.test", "MEMBER").statusCode(201);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("baseRole", "ADMIN")).when().patch(BASE + "/members/" + ana).then().statusCode(403);
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body(Map.of("baseRole", "MEMBER")).when().patch(BASE + "/members/" + admin).then().statusCode(403);
        given().header("Authorization", bearer(ANA)).when().delete(BASE + "/members/" + admin)
                .then().statusCode(403);
        // An admin still does all three.
        invite(ADMIN, "new-admin@roles.test", "ADMIN").statusCode(201);
    }

    @Test
    void aRoleAnAdminCannotGrantIsNotReachedThroughATeamAKeyOrTheRoleHoldersApi() throws SQLException {
        String admin = userId(ADMIN);
        String owners = create(OWNER, ROLES, "Dueños", CoreAccessCatalog.OWNERS_MANAGE)
                .statusCode(201).extract().path("key");

        // The role holders API.
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of(ADMIN)))
                .when().put("/api/v1/orgs/" + ORG + "/roles/" + owners).then().statusCode(403);

        // A team that holds the role.
        String team = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"name\":\"Turno A\"}").when().post(BASE + "/teams")
                .then().statusCode(201).extract().path("id");
        bind(OWNER, "TEAM", team, owners, null).statusCode(201);
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("userIds", List.of(admin))).when().put(BASE + "/teams/" + team + "/members")
                .then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("userIds", List.of(admin))).when().put(BASE + "/teams/" + team + "/members")
                .then().statusCode(200);
        // Removing members needs no grant.
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("userIds", List.of())).when().put(BASE + "/teams/" + team + "/members")
                .then().statusCode(200);

        // A service account that holds the role.
        String account = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "Integrador", "roles", List.of(owners))).when().post(BASE + "/service-accounts")
                .then().statusCode(201).extract().path("serviceAccount.id");
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("name", "otra")).when().post(BASE + "/service-accounts/" + account + "/keys")
                .then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("name", "otra")).when().post(BASE + "/service-accounts/" + account + "/keys")
                .then().statusCode(201);

        // An expired binding gives nothing, so it does not block the admin.
        exec("UPDATE miot_iam.iam_role_binding SET expires_at = now() - interval '1 day' WHERE role_key = '"
                + owners + "'");
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("name", "tercera")).when().post(BASE + "/service-accounts/" + account + "/keys")
                .then().statusCode(201);
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body(Map.of("userIds", List.of(admin))).when().put(BASE + "/teams/" + team + "/members")
                .then().statusCode(200);
    }

    @Test
    void anAcceptedInvitationBindsOnlyRolesThatStillExist() {
        String kept = create(OWNER, ROLES, "Auditor", CoreAccessCatalog.AUDIT_READ)
                .statusCode(201).extract().path("key");
        var gone = create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract();
        String invitee = "invited@roles.test";
        String token = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("emails", List.of(invitee), "baseRole", "MEMBER",
                        "roles", List.of(kept, gone.<String>path("key"))))
                .when().post(BASE + "/invitations").then().statusCode(201).extract().path("[0].token");
        given().header("Authorization", bearer(OWNER)).when().delete(ROLES + "/" + gone.path("id"))
                .then().statusCode(200);
        // The same key again, now with another permission.
        create(OWNER, ROLES, "Mapa", CoreAccessCatalog.MEMBERS_INVITE).statusCode(201);

        given().header("Authorization", bearer(invitee)).contentType("application/json")
                .body(Map.of("token", token)).when().post("/api/v1/me/invitations/accept")
                .then().statusCode(200).body("member.roles", contains(kept));
    }

    @Test
    void aCustomRoleWithTheTrainerPermissionPassesTheLegacyPermissionCheck() {
        String check = "/api/v1/orgs/" + ORG + "/permissions/HARNESS_TRAINER/me";
        given().header("Authorization", bearer(ANA)).when().get(check)
                .then().statusCode(200).body("allowed", is(false));
        String trainer = create(OWNER, ROLES, "Entrenador", CoreAccessCatalog.HARNESS_TRAIN)
                .statusCode(201).extract().path("key");
        bind(OWNER, "USER", userId(ANA), trainer, null).statusCode(201);
        given().header("Authorization", bearer(ANA)).when().get(check)
                .then().statusCode(200).body("allowed", is(true));
    }

    @Test
    void aRecreatedRoleStartsWithoutHolders() throws SQLException {
        String ana = userId(ANA);
        var created = create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201).extract();
        given().header("Authorization", bearer(OWNER)).when().delete(ROLES + "/" + created.path("id"))
                .then().statusCode(200);
        // A binding left behind by a grant that raced the delete.
        exec("INSERT INTO miot_iam.iam_role_binding (organization_id, principal_kind, principal_id, role_key) "
                + "SELECT id, 'USER', '" + ana + "', 'custom:mapa' FROM miot_core.organizations WHERE slug = '"
                + ORG + "'");
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", not(hasItem(GEOGRAPHIC)));

        create(OWNER, ROLES, "Mapa", GEOGRAPHIC).statusCode(201)
                .body("key", is("custom:mapa")).body("holders.members", is(0));
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", not(hasItem(GEOGRAPHIC)));
    }

    private static ValidatableResponse invite(String email, String invitee, String baseRole) {
        return given().header("Authorization", bearer(email)).contentType("application/json")
                .body(Map.of("emails", List.of(invitee), "baseRole", baseRole, "roles", List.of()))
                .when().post(BASE + "/invitations").then();
    }

    @Test
    void aReviewerHasTheGeographicView() {
        bind(OWNER, "USER", userId(ANA), CoordinatorAccessCatalog.REVIEWER, null).statusCode(201);
        given().header("Authorization", bearer(ANA)).when().get(ACCESS).then().statusCode(200)
                .body("permissions", hasItems(CoordinatorAccessCatalog.KANBAN_VIEW,
                        CoordinatorAccessCatalog.FINISHED_VIEW, GEOGRAPHIC))
                .body("permissions", not(hasItem(CoordinatorAccessCatalog.TASK_COMPLETE)));
    }

    private static ValidatableResponse create(String email, String path, String name, String... permissions) {
        return given().header("Authorization", bearer(email)).contentType("application/json")
                .body(Map.of("label", Map.of("es", name), "permissions", List.of(permissions)))
                .when().post(path).then();
    }

    private static ValidatableResponse bind(String email, String kind, String principal, String role,
            String subAccount) {
        Map<String, String> body = new java.util.HashMap<>(
                Map.of("principalKind", kind, "principalId", principal, "role", role));
        if (subAccount != null) {
            body.put("subAccount", subAccount);
        }
        return given().header("Authorization", bearer(email)).contentType("application/json").body(body)
                .when().post(BASE + "/bindings").then();
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }

    private static String userId(String email) {
        return given().header("Authorization", bearer(OWNER)).when().get(BASE + "/members")
                .then().statusCode(200).extract().path("members.find { it.email == '" + email + "' }.userId");
    }

    private List<String> auditActions(String target) {
        List<String> out = new java.util.ArrayList<>();
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "SELECT action FROM miot_iam.iam_audit_event WHERE target = ? AND organization_id = "
                        + "(SELECT id FROM miot_core.organizations WHERE slug = ?) ORDER BY id")) {
            st.setString(1, target);
            st.setString(2, ORG);
            try (var rs = st.executeQuery()) {
                while (rs.next()) {
                    out.add(rs.getString(1));
                }
            }
        } catch (SQLException e) {
            throw new IllegalStateException(e);
        }
        return out;
    }

    private int count(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement(); var rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getInt(1);
        }
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
