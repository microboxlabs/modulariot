package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
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
import java.util.List;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** A native organization whose members and roles come from the role ids in their sign-in token. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class TokenRolesFlowTest {

    private static final String ORG = "token-roles-org";
    private static final String MAPPINGS = "/api/v1/platform/orgs/" + ORG + "/token-roles";
    private static final String ACCESS = "/api/v1/orgs/" + ORG + "/me/access";
    private static final String USER = "entra.user@token.test";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'Token roles', 'token-roles-client', true, 'NATIVE')");
        put("10102", "ADMIN");
        put("10401", CoordinatorAccessCatalog.KANBAN_USER);
        put("10502", CoordinatorAccessCatalog.TRANSPORT_VALIDATOR);
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
        exec("DELETE FROM miot_iam.iam_user WHERE email = '" + USER + "'");
    }

    @Test
    void theTokenGrantsMembershipAndRolesAndTakesThemBack() throws SQLException {
        given().header("Authorization", bearer()).when().get(ACCESS).then().statusCode(403);

        given().header("Authorization", bearer("10401", "10502")).when().get(ACCESS)
                .then().statusCode(200)
                .body("baseRole", is("MEMBER"))
                .body("roles", hasItem(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR))
                .body("permissions", hasItem(CoordinatorAccessCatalog.TASK_COMPLETE));
        assertTokenBindings(2);

        given().header("Authorization", bearer("10102", "10502")).when().get(ACCESS)
                .then().statusCode(200)
                .body("baseRole", is("ADMIN"))
                .body("roles", not(hasItem(CoordinatorAccessCatalog.KANBAN_USER)));
        assertTokenBindings(1);

        given().header("Authorization", bearer("99999")).when().get(ACCESS).then().statusCode(403);
        assertTokenBindings(0);
    }

    @Test
    void aTokenWithoutTheClaimLeavesStoredRolesAlone() throws SQLException {
        given().header("Authorization", bearer("10502")).when().get(ACCESS).then().statusCode(200);
        given().header("Authorization", "Bearer " + TestTokenFactory.signWebToken(USER)).when().get(ACCESS)
                .then().statusCode(200)
                .body("roles", hasItem(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR));
        assertTokenBindings(1);
    }

    @Test
    void anAdminTokenDoesNotChangeAnExistingMembership() throws SQLException {
        exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + USER + "')");
        exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role, source, created_by) "
                + "SELECT o.id, u.id, 'MEMBER', 'NATIVE', 'test' FROM miot_core.organizations o, miot_iam.iam_user u "
                + "WHERE o.slug = '" + ORG + "' AND u.email = '" + USER + "'");

        given().header("Authorization", bearer("10102")).when().get(ACCESS)
                .then().statusCode(200).body("baseRole", is("ADMIN"));
        assertEquals("MEMBER/NATIVE", membership());
        given().header("Authorization", bearer("10502")).when().get(ACCESS)
                .then().statusCode(200).body("baseRole", is("MEMBER"));
    }

    @Test
    void deletingEveryMappingTakesBackWhatTokensGave() throws SQLException {
        given().header("Authorization", bearer("10502")).when().get(ACCESS).then().statusCode(200);
        for (String id : List.of("10102", "10401", "10502")) {
            owner().when().delete(MAPPINGS + "/" + id).then().statusCode(204);
        }
        given().header("Authorization", bearer("10502")).when().get(ACCESS).then().statusCode(403);
        assertTokenBindings(0);
        assertEquals("none", membership());
    }

    @Test
    void anExpiredBindingOfAMappedRoleIsRenewedAsATokenBinding() throws SQLException {
        given().header("Authorization", bearer("10502")).when().get(ACCESS).then().statusCode(200);
        exec("UPDATE miot_iam.iam_role_binding SET source = 'NATIVE', expires_at = now() - interval '1 day' "
                + "WHERE principal_id = (SELECT id::text FROM miot_iam.iam_user WHERE email = '" + USER + "')");

        given().header("Authorization", bearer("10502")).when().get(ACCESS)
                .then().statusCode(200).body("roles", hasItem(CoordinatorAccessCatalog.TRANSPORT_VALIDATOR));
        assertTokenBindings(1);
    }

    @Test
    void aDisabledPersonGetsNothingFromTheToken() throws SQLException {
        exec("INSERT INTO miot_iam.iam_user (email, status) VALUES ('" + USER + "', 'DISABLED')");
        given().header("Authorization", bearer("10502")).when().get(ACCESS).then().statusCode(403);
        assertTokenBindings(0);
        assertEquals("none", membership());
    }

    @Test
    void mappingsNeedAKnownRole() {
        owner().contentType("application/json").body("{\"roleKey\":\"NOT_A_ROLE\"}")
                .when().put(MAPPINGS + "/1").then().statusCode(400);
        owner().when().get(MAPPINGS).then().statusCode(200).body("$", hasSize(3));
        owner().when().delete(MAPPINGS + "/10401").then().statusCode(204);
        owner().when().get(MAPPINGS).then().statusCode(200).body("$", hasSize(2));
    }

    private void put(String id, String roleKey) {
        owner().contentType("application/json").body("{\"roleKey\":\"" + roleKey + "\"}")
                .when().put(MAPPINGS + "/" + id).then().statusCode(200);
    }

    private void assertTokenBindings(int expected) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT count(*) FROM miot_iam.iam_role_binding b "
                        + "JOIN miot_iam.iam_user u ON u.id::text = b.principal_id "
                        + "WHERE u.email = '" + USER + "' AND b.source = 'TOKEN'")) {
            rs.next();
            assertEquals(expected, rs.getInt(1));
        }
    }

    private String membership() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT m.base_role || '/' || m.source FROM miot_iam.iam_membership m "
                        + "JOIN miot_iam.iam_user u ON u.id = m.user_id WHERE u.email = '" + USER + "'")) {
            return rs.next() ? rs.getString(1) : "none";
        }
    }

    private static io.restassured.specification.RequestSpecification owner() {
        return given().header("Authorization",
                "Bearer " + TestTokenFactory.signWebToken(PlatformTestProfile.OWNER_EMAIL));
    }

    private static String bearer(String... ids) {
        return "Bearer " + TestTokenFactory.signWebToken(USER, PlatformTestProfile.ROLES_CLAIM, List.of(ids));
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
