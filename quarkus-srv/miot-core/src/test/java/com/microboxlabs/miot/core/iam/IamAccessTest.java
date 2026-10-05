package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;
import static org.hamcrest.Matchers.nullValue;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.ResultSet;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/**
 * Organization access end to end: the org filter, the evaluator, the permission check on an endpoint, the role API
 * and the platform API, against the real migration.
 */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class IamAccessTest {

    private static final String ALFRESCO_ORG = "iam-alfresco-org";
    private static final String NATIVE_ORG = "iam-native-org";
    private static final String MEMBER = StubAlfrescoMembershipClient.MEMBER_EMAIL;
    private static final String PLATFORM_OWNER = PlatformTestProfile.OWNER_EMAIL;
    private static final String ANA = "ana@iam.test";
    private static final String BO = "bo@iam.test";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, alfresco_group_id, tenant_client_id, active) "
                + "VALUES ('" + ALFRESCO_ORG + "', 'A', 'GROUP_IAM', 'iam-alfresco-client', true)");
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug IN ('" + ALFRESCO_ORG + "', '" + NATIVE_ORG + "')");
        exec("DELETE FROM miot_iam.iam_audit_event WHERE target IS NULL OR target LIKE 'CONTROL%' "
                + "OR action LIKE 'owners.%' OR action LIKE 'role.%'");
    }

    @Test
    void anAlfrescoManagerOwnsAnOrganizationWithoutOwnersAndMayInvite() {
        given().header("Authorization", bearer(MEMBER))
                .when().get("/api/v1/orgs/" + ALFRESCO_ORG + "/me/access")
                .then().log().ifValidationFails().statusCode(200)
                .body("baseRole", is("OWNER"))
                .body("permissions", hasItem(CoreAccessCatalog.MEMBERS_INVITE));

        given().header("Authorization", bearer(MEMBER))
                .when().get("/api/v1/orgs/" + ALFRESCO_ORG + "/iam-probe")
                .then().log().ifValidationFails().statusCode(200);
    }

    @Test
    void someoneOutsideTheAlfrescoGroupIsRefused() {
        given().header("Authorization", bearer(ANA))
                .when().get("/api/v1/orgs/" + ALFRESCO_ORG + "/me/access")
                .then().statusCode(403);
    }

    @Test
    void aNativeOrganizationIsBuiltByThePlatformOwnerAndThenByItsOwner() throws SQLException {
        given().header("Authorization", bearer(PLATFORM_OWNER)).contentType("application/json")
                .body("{\"slug\":\"" + NATIVE_ORG + "\",\"name\":\"Native\",\"tenantClientId\":\"iam-native-client\"}")
                .when().post("/api/v1/platform/orgs")
                .then().statusCode(201);
        assertEquals("NATIVE",
                scalar("SELECT membership_source FROM miot_core.organizations WHERE slug = '" + NATIVE_ORG + "'"));

        // Nobody belongs to it yet, the Alfresco member included.
        given().header("Authorization", bearer(MEMBER))
                .when().get("/api/v1/orgs/" + NATIVE_ORG + "/me/access")
                .then().statusCode(403);

        given().header("Authorization", bearer(PLATFORM_OWNER)).contentType("application/json")
                .body("{\"assigneeIds\":[\"Ana@IAM.test\"]}")
                .when().put("/api/v1/platform/orgs/" + NATIVE_ORG + "/roles/ORGANIZATION_OWNER")
                .then().statusCode(200)
                .body("assigneeIds", contains(ANA));

        given().header("Authorization", bearer(ANA))
                .when().get("/api/v1/orgs/" + NATIVE_ORG + "/me/access")
                .then().statusCode(200)
                .body("baseRole", is("OWNER"));

        // The owner gives Bo a module role; that makes Bo a member without org administration.
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body("{\"assigneeIds\":[\"" + BO + "\"]}")
                .when().put("/api/v1/orgs/" + NATIVE_ORG + "/roles/" + CoreAccessCatalog.HARNESS_TRAINER)
                .then().statusCode(200)
                .body("assigneeIds", contains(BO));

        given().header("Authorization", bearer(BO))
                .when().get("/api/v1/orgs/" + NATIVE_ORG + "/me/access")
                .then().statusCode(200)
                .body("baseRole", is("MEMBER"))
                .body("roles", contains(CoreAccessCatalog.HARNESS_TRAINER))
                .body("permissions", hasItem(CoreAccessCatalog.HARNESS_TRAIN))
                .body("permissions", not(hasItem(CoreAccessCatalog.MEMBERS_INVITE)));

        given().header("Authorization", bearer(BO))
                .when().get("/api/v1/orgs/" + NATIVE_ORG + "/iam-probe")
                .then().statusCode(403);

        given().header("Authorization", bearer(BO)).contentType("application/json")
                .body("{\"assigneeIds\":[\"" + BO + "\"]}")
                .when().put("/api/v1/orgs/" + NATIVE_ORG + "/roles/ORGANIZATION_OWNER")
                .then().statusCode(403);

        assertTrue(Integer.parseInt(scalar("SELECT count(*) FROM miot_iam.iam_audit_event e JOIN "
                + "miot_core.organizations o ON o.id = e.organization_id WHERE o.slug = '" + NATIVE_ORG + "'")) >= 2);
    }

    @Test
    void aDisabledUserLosesAccessAndEmailsAreMatchedOnce() throws SQLException {
        given().header("Authorization", bearer(PLATFORM_OWNER)).contentType("application/json")
                .body("{\"slug\":\"" + NATIVE_ORG + "\",\"name\":\"Native\",\"tenantClientId\":\"iam-native-client\"}")
                .when().post("/api/v1/platform/orgs").then().statusCode(201);
        given().header("Authorization", bearer(PLATFORM_OWNER)).contentType("application/json")
                .body("{\"assigneeIds\":[\"" + ANA + "\"]}")
                .when().put("/api/v1/platform/orgs/" + NATIVE_ORG + "/roles/ORGANIZATION_OWNER").then().statusCode(200);

        // The same person twice, in different case, is one holder.
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body("{\"assigneeIds\":[\"Bo@IAM.test\",\"bo@iam.test\"]}")
                .when().put("/api/v1/orgs/" + NATIVE_ORG + "/roles/" + CoreAccessCatalog.HARNESS_TRAINER)
                .then().statusCode(200).body("assigneeIds", contains(BO));

        exec("UPDATE miot_iam.iam_user SET status = 'DISABLED' WHERE email = '" + BO + "'");
        try {
            given().header("Authorization", bearer(BO))
                    .when().get("/api/v1/orgs/" + NATIVE_ORG + "/me/access")
                    .then().statusCode(403);
        } finally {
            exec("UPDATE miot_iam.iam_user SET status = 'ACTIVE' WHERE email = '" + BO + "'");
        }
    }

    @Test
    void theCatalogListsCorePermissionsAndRoles() {
        given().header("Authorization", bearer(ANA))
                .when().get("/api/v1/access/catalog")
                .then().statusCode(200)
                .body("baseRoles", contains("MEMBER", "ADMIN", "OWNER"))
                .body("permissions.key", hasItem(CoreAccessCatalog.OWNERS_MANAGE))
                .body("roles.key", hasItem(CoreAccessCatalog.HARNESS_TRAINER));
    }

    @Test
    void anUnknownOrganizationGivesNoAccess() {
        given().header("Authorization", bearer(MEMBER))
                .when().get("/api/v1/orgs/iam-nowhere/me/access")
                .then().statusCode(403)
                .body("baseRole", nullValue());
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }

    private String scalar(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement(); ResultSet rs = st.executeQuery(sql)) {
            rs.next();
            return rs.getString(1);
        }
    }
}
