package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
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
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** People with a verified email in an org's domain join it as Members at their first sign-in. */
@QuarkusTest
@TestProfile(ProjectionQueueTest.Profile.class)
class DomainMembershipTest {

    private static final String ORG = "domain-member-org";
    private static final String OTHER_ORG = "domain-member-other";
    private static final String DOMAIN = "domain-member.test";
    private static final String SITE_GROUP = "GROUP_site_domainmember";
    private static final String USER = "new.person@" + DOMAIN;
    private static final String ACCESS = "/api/v1/orgs/" + ORG + "/me/access";
    private static final String DOMAINS = "/api/v1/platform/orgs/" + ORG + "/member-domains";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source, "
                + "alfresco_group_id) VALUES ('" + ORG + "', 'Domain members', 'domain-member-client', true, "
                + "'NATIVE', '" + SITE_GROUP + "')");
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + OTHER_ORG + "', 'Other', 'domain-member-other-client', true, 'NATIVE')");
        owner().when().put(DOMAINS + "/" + DOMAIN.toUpperCase()).then().statusCode(200).body("domain", is(DOMAIN));
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug IN ('" + ORG + "', '" + OTHER_ORG + "')");
        exec("DELETE FROM miot_iam.iam_user WHERE email LIKE '%@" + DOMAIN + "'");
    }

    @Test
    void aVerifiedPersonInTheDomainJoinsAsAMemberWithNoRoles() throws SQLException {
        signedIn(USER, true).when().get(ACCESS).then().statusCode(200)
                .body("baseRole", is("MEMBER"))
                .body("roles", empty());
        assertEquals("DOMAIN/ACTIVE", membership());
        assertEquals(List.of("MEMBER_ADDED " + SITE_GROUP + "_SiteConsumer"), queued());

        signedIn(USER, true).when().get(ACCESS).then().statusCode(200);
        assertEquals(1, queued().size());
    }

    @Test
    void anUnverifiedEmailOrAnotherDomainDoesNotJoin() throws SQLException {
        signedIn(USER, false).when().get(ACCESS).then().statusCode(403);
        signedIn("someone@elsewhere.test", true).when().get(ACCESS).then().statusCode(403);
        assertEquals("none", membership());
    }

    @Test
    void aRemovedMemberIsSuspendedAndDoesNotJoinAgain() throws SQLException {
        signedIn(USER, true).when().get(ACCESS).then().statusCode(200);

        owner().when().delete("/api/v1/orgs/" + ORG + "/team/members/" + userId()).then().statusCode(204);
        assertEquals("DOMAIN/SUSPENDED", membership());
        assertEquals(List.of("MEMBER_ADDED " + SITE_GROUP + "_SiteConsumer",
                "MEMBER_REMOVED " + SITE_GROUP + "_SiteConsumer"), queued());

        signedIn(USER, true).when().get(ACCESS).then().statusCode(403);
        assertEquals("DOMAIN/SUSPENDED", membership());
    }

    @Test
    void aSuspendedAdminInvitedAsMemberComesBackAsMember() throws SQLException {
        suspendedAdmin();
        String token = owner().contentType("application/json")
                .body("{\"emails\":[\"" + USER + "\"],\"baseRole\":\"MEMBER\"}")
                .when().post("/api/v1/orgs/" + ORG + "/team/invitations")
                .then().statusCode(201).extract().path("[0].token");
        signedIn(USER, true).contentType("application/json").body("{\"token\":\"" + token + "\"}")
                .when().post("/api/v1/me/invitations/accept")
                .then().statusCode(200).body("member.baseRole", is("MEMBER"));
        assertEquals("DOMAIN/ACTIVE", membership());
    }

    @Test
    void aSuspendedAdminGivenAModuleRoleComesBackAsMember() throws SQLException {
        suspendedAdmin();
        owner().contentType("application/json").body("{\"assigneeIds\":[\"" + USER + "\"]}")
                .when().put("/api/v1/orgs/" + ORG + "/roles/" + CoordinatorAccessCatalog.TRANSPORT_VALIDATOR)
                .then().statusCode(200);
        signedIn(USER, true).when().get(ACCESS).then().statusCode(200).body("baseRole", is("MEMBER"));
    }

    private void suspendedAdmin() throws SQLException {
        signedIn(USER, true).when().get(ACCESS).then().statusCode(200);
        exec("UPDATE miot_iam.iam_membership SET base_role = 'ADMIN' WHERE user_id = '" + userId() + "'");
        owner().when().delete("/api/v1/orgs/" + ORG + "/team/members/" + userId()).then().statusCode(204);
        assertEquals("DOMAIN/SUSPENDED", membership());
    }

    @Test
    void aDomainBelongsToOneOrganization() {
        owner().when().put("/api/v1/platform/orgs/" + OTHER_ORG + "/member-domains/" + DOMAIN)
                .then().statusCode(409);
        owner().when().put(DOMAINS + "/not_a_domain").then().statusCode(400);
        owner().when().delete(DOMAINS + "/" + DOMAIN).then().statusCode(204);
        owner().when().get(DOMAINS).then().statusCode(200).body("$", empty());
    }

    private String membership() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT m.source || '/' || m.status FROM miot_iam.iam_membership m "
                        + "JOIN miot_iam.iam_user u ON u.id = m.user_id "
                        + "JOIN miot_core.organizations o ON o.id = m.organization_id "
                        + "WHERE o.slug = '" + ORG + "' AND u.email = '" + USER + "'")) {
            return rs.next() ? rs.getString(1) : "none";
        }
    }

    private List<String> queued() throws SQLException {
        List<String> rows = new ArrayList<>();
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT q.kind || ' ' || q.group_id FROM miot_iam.iam_projection_outbox q "
                        + "JOIN miot_core.organizations o ON o.id = q.organization_id WHERE o.slug = '" + ORG
                        + "' AND q.subject = '" + USER + "' ORDER BY q.id")) {
            while (rs.next()) {
                rows.add(rs.getString(1));
            }
        }
        return rows;
    }

    private String userId() throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement();
                ResultSet rs = st.executeQuery("SELECT id FROM miot_iam.iam_user WHERE email = '" + USER + "'")) {
            rs.next();
            return rs.getString(1);
        }
    }

    private static io.restassured.specification.RequestSpecification signedIn(String email, boolean verified) {
        return given().header("Authorization",
                "Bearer " + TestTokenFactory.signWebToken(email, "email_verified", verified));
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
