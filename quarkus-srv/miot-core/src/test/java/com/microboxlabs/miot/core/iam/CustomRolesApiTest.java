package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

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

        // An M2M client, through the role holders API.
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body(Map.of("assigneeIds", List.of("some-client")))
                .when().put("/api/v1/orgs/" + ORG + "/roles/" + key)
                .then().statusCode(200).body("assigneeIds", contains("some-client"));
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
