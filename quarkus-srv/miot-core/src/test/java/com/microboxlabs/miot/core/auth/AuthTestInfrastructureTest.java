package com.microboxlabs.miot.core.auth;

import static io.restassured.RestAssured.given;
import static org.hamcrest.MatcherAssert.assertThat;
import static org.hamcrest.Matchers.is;

import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Proves the Q0 auth test infrastructure works end-to-end against the
 * real {@code DualJwtAuthMechanism} + {@code OrganizationRequestFilter}
 * trust chain that Q1..Q3 will reuse.
 *
 * <p>Hits an existing org-scoped endpoint ({@code OrgMembersResource})
 * with three forged tokens:
 * <ul>
 *   <li>valid web token for {@code member@test.example} → 200 (stub approves)</li>
 *   <li>valid web token for any other email → 403 (stub denies)</li>
 *   <li>expired web token → 401 ({@code DualJwtAuthMechanism} rejects)</li>
 * </ul>
 *
 * <p>Seeds a single {@code organizations} row via the JDBC datasource so
 * the test stays out of Hibernate Reactive's session model. DB comes
 * from Quarkus DevServices Postgres (Docker required).
 */
@QuarkusTest
@TestProfile(HarnessProxyTestProfile.class)
class AuthTestInfrastructureTest {

    private static final String ORG_SLUG = "auth-infra-test-org";
    private static final String ORG_GROUP = "GROUP_auth_infra_test";
    private static final String ORG_TENANT = "auth-infra-tenant";
    private static final String NON_MEMBER = "intruder@test.example";
    private static final String MEMBERS_PATH = "/api/v1/orgs/" + ORG_SLUG + "/members";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "INSERT INTO miot_core.organizations "
                        + "(slug, name, alfresco_group_id, tenant_client_id, active) "
                        + "VALUES (?, ?, ?, ?, true)")) {
            st.setString(1, ORG_SLUG);
            st.setString(2, "Auth Infra Test Org");
            st.setString(3, ORG_GROUP);
            st.setString(4, ORG_TENANT);
            st.executeUpdate();
        }
    }

    @AfterEach
    void cleanupOrg() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.prepareStatement(
                "DELETE FROM miot_core.organizations WHERE slug = ?")) {
            st.setString(1, ORG_SLUG);
            st.executeUpdate();
        }
    }

    @Test
    void memberWebTokenHits200() {
        String token = TestTokenFactory.signWebToken(StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get(MEMBERS_PATH)
                .statusCode();
        assertThat("member should be allowed past OrganizationRequestFilter",
                status, is(200));
    }

    @Test
    void nonMemberWebTokenHits403() {
        String token = TestTokenFactory.signWebToken(NON_MEMBER);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get(MEMBERS_PATH)
                .statusCode();
        assertThat("non-member should be rejected by OrganizationRequestFilter",
                status, is(403));
    }

    @Test
    void expiredWebTokenHits401() {
        String token = TestTokenFactory.signExpiredWebToken(
                StubAlfrescoMembershipClient.MEMBER_EMAIL);
        int status = given()
                .header("Authorization", "Bearer " + token)
                .when()
                .get(MEMBERS_PATH)
                .statusCode();
        assertThat("expired token must be rejected by DualJwtAuthMechanism",
                status, is(401));
    }
}
