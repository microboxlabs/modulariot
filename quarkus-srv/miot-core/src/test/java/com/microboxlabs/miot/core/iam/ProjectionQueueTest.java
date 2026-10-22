package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Role changes queue projected-group changes in the same transaction, with no reconcile. */
@QuarkusTest
@TestProfile(ProjectionQueueTest.Profile.class)
class ProjectionQueueTest {

    /** The platform test setup with the projection on; the sender and reconcile run rarely enough not to interfere. */
    public static class Profile extends PlatformTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            Map<String, String> overrides = new java.util.HashMap<>(super.getConfigOverrides());
            overrides.put(AlfrescoBridge.PROJECTION_PROPERTY, "true");
            overrides.put("miot.iam.alfresco-projection.every", "1h");
            overrides.put("miot.iam.alfresco-projection.reconcile-every", "1h");
            return overrides;
        }
    }

    private static final String ORG = "projection-queue-org";
    private static final String BASE = "/api/v1/orgs/" + ORG;
    private static final String GROUP = "GROUP_MINTRAL_VALIDADOR_TRANSPORTE";
    private static final String USER = "queued.user@projection.test";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'Projection queue', 'projection-queue-client', true, 'NATIVE')");
        exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + USER + "') ON CONFLICT DO NOTHING");
        exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role, source, created_by) "
                + "SELECT o.id, u.id, 'MEMBER', 'NATIVE', 'test' FROM miot_core.organizations o, miot_iam.iam_user u "
                + "WHERE o.slug = '" + ORG + "' AND u.email = '" + USER + "'");
        owner().contentType("application/json").body("{\"projected\":true}")
                .when().put("/api/v1/platform/orgs/" + ORG + "/alfresco-group-roles/" + GROUP + "/"
                        + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR)
                .then().statusCode(200);
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
        exec("DELETE FROM miot_iam.iam_user WHERE email = '" + USER + "'");
    }

    @Test
    void grantingAndRemovingARoleQueuesTheGroupChange() throws SQLException {
        String bindingId = owner().contentType("application/json")
                .body("{\"principalKind\":\"USER\",\"principalId\":\"" + userId() + "\",\"role\":\""
                        + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR + "\"}")
                .when().post(BASE + "/team/bindings")
                .then().statusCode(201).extract().path("id");
        assertEquals(List.of("MEMBER_ADDED"), queued());

        owner().when().delete(BASE + "/team/bindings/" + bindingId).then().statusCode(204);
        assertEquals(List.of("MEMBER_ADDED", "MEMBER_REMOVED"), queued());
    }

    @Test
    void aRoleGivenThroughATeamReachesItsMembers() throws SQLException {
        String teamId = owner().contentType("application/json").body("{\"name\":\"Validadores\"}")
                .when().post(BASE + "/team/teams")
                .then().statusCode(201).extract().path("id");
        owner().contentType("application/json")
                .body("{\"roles\":[\"" + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR + "\"]}")
                .when().put(BASE + "/team/teams/" + teamId + "/roles").then().statusCode(200);
        assertEquals(List.of(), queued());

        owner().contentType("application/json").body("{\"userIds\":[\"" + userId() + "\"]}")
                .when().put(BASE + "/team/teams/" + teamId + "/members").then().statusCode(200);
        assertEquals(List.of("MEMBER_ADDED"), queued());

        owner().when().delete(BASE + "/team/teams/" + teamId).then().statusCode(204);
        assertEquals(List.of("MEMBER_ADDED", "MEMBER_REMOVED"), queued());
    }

    @Test
    void aRoleGrantedAgainBeforeTheSenderRunsIsQueuedAgain() throws SQLException {
        String binding = "{\"principalKind\":\"USER\",\"principalId\":\"" + userId() + "\",\"role\":\""
                + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR + "\"}";
        String first = owner().contentType("application/json").body(binding).when().post(BASE + "/team/bindings")
                .then().statusCode(201).extract().path("id");
        owner().when().delete(BASE + "/team/bindings/" + first).then().statusCode(204);
        owner().contentType("application/json").body(binding).when().post(BASE + "/team/bindings")
                .then().statusCode(201);
        assertEquals(List.of("MEMBER_ADDED", "MEMBER_REMOVED", "MEMBER_ADDED"), queued());
    }

    @Test
    void replacingTheHoldersQueuesTheRemovalOfThePreviousOnes() throws SQLException {
        String role = "/api/v1/orgs/" + ORG + "/roles/" + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR;
        owner().contentType("application/json").body("{\"assigneeIds\":[\"" + USER + "\"]}")
                .when().put(role).then().statusCode(200);
        owner().contentType("application/json").body("{\"assigneeIds\":[\"other@projection.test\"]}")
                .when().put(role).then().statusCode(200);
        assertEquals(List.of("MEMBER_ADDED", "MEMBER_REMOVED"), queued());
        exec("DELETE FROM miot_iam.iam_user WHERE email = 'other@projection.test'");
    }

    @Test
    void aTeamKeepsItsMembersAndARemovedMemberLeavesItsGroup() throws SQLException {
        String teamId = owner().contentType("application/json").body("{\"name\":\"Validadores\"}")
                .when().post(BASE + "/team/teams")
                .then().statusCode(201).extract().path("id");
        owner().contentType("application/json")
                .body("{\"roles\":[\"" + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR + "\"]}")
                .when().put(BASE + "/team/teams/" + teamId + "/roles").then().statusCode(200);
        String members = "{\"userIds\":[\"" + userId() + "\"]}";
        owner().contentType("application/json").body(members)
                .when().put(BASE + "/team/teams/" + teamId + "/members").then().statusCode(200);
        owner().contentType("application/json").body(members)
                .when().put(BASE + "/team/teams/" + teamId + "/members").then().statusCode(200);

        owner().when().delete(BASE + "/team/members/" + userId()).then().statusCode(204);
        assertEquals(List.of("MEMBER_ADDED", "MEMBER_REMOVED"), queued());
    }

    @Test
    void aRoleNotMappedToAProjectedGroupQueuesNothing() throws SQLException {
        owner().contentType("application/json")
                .body("{\"principalKind\":\"USER\",\"principalId\":\"" + userId() + "\",\"role\":\""
                        + CoordinatorAccessCatalog.KANBAN_USER + "\"}")
                .when().post(BASE + "/team/bindings").then().statusCode(201);
        assertEquals(List.of(), queued());
    }

    private List<String> queued() throws SQLException {
        List<String> kinds = new ArrayList<>();
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT q.kind FROM miot_iam.iam_projection_outbox q "
                        + "JOIN miot_core.organizations o ON o.id = q.organization_id WHERE o.slug = '" + ORG
                        + "' AND q.subject = '" + USER + "' AND q.group_id = '" + GROUP + "' ORDER BY q.id")) {
            while (rs.next()) {
                kinds.add(rs.getString(1));
            }
        }
        return kinds;
    }

    private String userId() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT id FROM miot_iam.iam_user WHERE email = '" + USER + "'")) {
            rs.next();
            return rs.getString(1);
        }
    }

    private static io.restassured.specification.RequestSpecification owner() {
        return given().header("Authorization",
                "Bearer " + TestTokenFactory.signWebToken(PlatformTestProfile.OWNER_EMAIL));
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
