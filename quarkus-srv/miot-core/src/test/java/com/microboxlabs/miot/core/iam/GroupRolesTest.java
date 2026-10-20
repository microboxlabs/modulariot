package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasItem;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.not;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Mapping Alfresco groups to module roles and importing their members as role bindings. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class GroupRolesTest {

    private static final String ORG = "group-roles-org";
    private static final String MAPPINGS = "/api/v1/platform/orgs/" + ORG + "/alfresco-group-roles";
    private static final String MEMBER = "dev.user@example.com";

    @Inject
    AgroalDataSource ds;

    /** Without an Alfresco group every signed-in user is a Member, so the stub directory's people can sign in. */
    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, alfresco_group_id, "
                + "membership_source) VALUES ('" + ORG + "', 'Group roles', 'group-roles-client', true, "
                + "NULL, 'ALFRESCO')");
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
    }

    @Test
    void importGivesEachGroupMemberTheRoleAndIsIdempotent() {
        owner().contentType("application/json").body("{\"projected\":true}")
                .when().put(MAPPINGS + "/GROUP_MINTRAL_EJECUTIVO_TORRE_CONTROL/"
                        + CoordinatorAccessCatalog.CONTROL_TOWER_EXECUTIVE)
                .then().statusCode(200).body("projected", is(true));

        given().header("Authorization", bearer(MEMBER)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200)
                .body("permissions", not(hasItem(CoordinatorAccessCatalog.STAGE_CONTROL_TOWER)));

        owner().when().post(MAPPINGS + "/import?dryRun=true")
                .then().statusCode(200).body("dryRun", is(true)).body("lines[0].added", is(3));
        given().header("Authorization", bearer(MEMBER)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200)
                .body("permissions", not(hasItem(CoordinatorAccessCatalog.STAGE_CONTROL_TOWER)));

        owner().when().post(MAPPINGS + "/import")
                .then().statusCode(200).body("lines[0].seen", is(3)).body("lines[0].added", is(3));
        owner().when().post(MAPPINGS + "/import")
                .then().statusCode(200).body("lines[0].added", is(0)).body("lines[0].existing", is(3));

        given().header("Authorization", bearer(MEMBER)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200)
                .body("roles", hasItem(CoordinatorAccessCatalog.CONTROL_TOWER_EXECUTIVE))
                .body("permissions", hasItem(CoordinatorAccessCatalog.STAGE_CONTROL_TOWER));
    }

    @Test
    void membersOfTheExcludedGroupAreSkipped() {
        owner().contentType("application/json")
                .body("{\"excludedGroupId\":\"GROUP_MINTRAL_REVISOR\"}")
                .when().put(MAPPINGS + "/GROUP_MINTRAL_KANBAN_ACCESS/" + CoordinatorAccessCatalog.KANBAN_USER)
                .then().statusCode(200).body("excludedGroupId", is("GROUP_MINTRAL_REVISOR"));

        // The stub directory answers the same people for every group, so all of them are excluded.
        owner().when().post(MAPPINGS + "/import")
                .then().statusCode(200)
                .body("lines[0].seen", is(3))
                .body("lines[0].excluded", is(3))
                .body("lines[0].added", is(0));
    }

    @Test
    void aDryRunCountsAPersonOncePerRoleAcrossGroups() {
        owner().contentType("application/json").body("{}")
                .when().put(MAPPINGS + "/GROUP_PLANNING/" + CoordinatorAccessCatalog.CALENDAR_PLANNER)
                .then().statusCode(200);
        owner().contentType("application/json").body("{}")
                .when().put(MAPPINGS + "/GROUP_PLANNING_2/" + CoordinatorAccessCatalog.CALENDAR_PLANNER)
                .then().statusCode(200);

        // The stub directory answers the same people for every group.
        owner().when().post(MAPPINGS + "/import?dryRun=true")
                .then().statusCode(200)
                .body("lines[0].added", is(3))
                .body("lines[1].added", is(0))
                .body("lines[1].existing", is(3));
    }

    @Test
    void mappingsAreListedAndRemoved() {
        owner().contentType("application/json").body("{}")
                .when().put(MAPPINGS + "/GROUP_PLANNING/" + CoordinatorAccessCatalog.CALENDAR_PLANNER)
                .then().statusCode(200).body("projected", is(false));
        owner().when().get(MAPPINGS).then().statusCode(200).body("$", hasSize(1));
        owner().when().delete(MAPPINGS + "/GROUP_PLANNING/" + CoordinatorAccessCatalog.CALENDAR_PLANNER)
                .then().statusCode(204);
        owner().when().get(MAPPINGS).then().statusCode(200).body("$", hasSize(0));
    }

    @Test
    void anUnknownRoleOrABadGroupIsRejected() {
        owner().contentType("application/json").body("{}")
                .when().put(MAPPINGS + "/GROUP_X/NOT_A_ROLE").then().statusCode(400);
        owner().contentType("application/json").body("{}")
                .when().put(MAPPINGS + "/planning/" + CoordinatorAccessCatalog.CALENDAR_PLANNER).then().statusCode(400);
    }

    @Test
    void onlyPlatformOwnersMayCallThem() {
        given().header("Authorization", bearer(PlatformTestProfile.NON_OWNER_EMAIL))
                .when().post(MAPPINGS + "/import").then().statusCode(403);
    }

    private static io.restassured.specification.RequestSpecification owner() {
        return given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL));
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
