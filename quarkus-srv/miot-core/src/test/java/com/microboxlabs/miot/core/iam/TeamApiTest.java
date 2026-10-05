package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.containsInAnyOrder;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.hasSize;
import static org.hamcrest.Matchers.is;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import io.restassured.response.Response;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

/** Members and invitations end to end on a native organization. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class TeamApiTest {

    private static final String ORG = "team-api-org";
    private static final String OWNER = "owner@team.test";
    private static final String ADMIN = "admin@team.test";
    private static final String NEWCOMER = "new@team.test";
    private static final String BASE = "/api/v1/orgs/" + ORG + "/team";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'Team', 'team-client', true, 'NATIVE')");
        for (String[] m : new String[][] {{OWNER, "OWNER"}, {ADMIN, "ADMIN"}}) {
            exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + m[0] + "') ON CONFLICT DO NOTHING");
            exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                    + "SELECT o.id, u.id, '" + m[1] + "' FROM miot_core.organizations o, miot_iam.iam_user u "
                    + "WHERE o.slug = '" + ORG + "' AND u.email = '" + m[0] + "'");
        }
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug = '" + ORG + "'");
    }

    @Test
    void anAdminInvitesAndTheInviteeJoinsWithTheLink() {
        Response created = given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body("{\"emails\":[\"New@Team.test\"],\"baseRole\":\"MEMBER\",\"roles\":[\"HARNESS_TRAINER\"]}")
                .when().post(BASE + "/invitations")
                .then().statusCode(201)
                .body("[0].invitation.email", is(NEWCOMER))
                .extract().response();
        String token = created.path("[0].token");

        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/invitations")
                .then().statusCode(200).body("email", contains(NEWCOMER));
        given().header("Authorization", bearer(NEWCOMER)).when().get("/api/v1/me/invitations")
                .then().statusCode(200).body("organization", contains(ORG));

        // Someone else cannot use the link.
        given().header("Authorization", bearer("intruder@team.test")).contentType("application/json")
                .body("{\"token\":\"" + token + "\"}")
                .when().post("/api/v1/me/invitations/accept")
                .then().statusCode(403);

        given().header("Authorization", bearer(NEWCOMER)).contentType("application/json")
                .body("{\"token\":\"" + token + "\"}")
                .when().post("/api/v1/me/invitations/accept")
                .then().statusCode(200)
                .body("baseRole", is("MEMBER"))
                .body("roles", contains("HARNESS_TRAINER"));

        given().header("Authorization", bearer(NEWCOMER)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200).body("roles", contains("HARNESS_TRAINER"));
        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/invitations")
                .then().statusCode(200).body("$", empty());
        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/members")
                .then().statusCode(200)
                .body("membershipSource", is("NATIVE"))
                .body("members.email", containsInAnyOrder(OWNER, ADMIN, NEWCOMER));
    }

    @Test
    void rolesChangeWithinTheRules() {
        String adminId = userId(ADMIN);
        String ownerId = userId(OWNER);

        // An admin cannot make an owner, and the last owner stays.
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body("{\"baseRole\":\"OWNER\"}").when().patch(BASE + "/members/" + adminId)
                .then().statusCode(403);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"baseRole\":\"MEMBER\"}").when().patch(BASE + "/members/" + ownerId)
                .then().statusCode(409);

        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"roles\":[\"HARNESS_TRAINER\"]}").when().put(BASE + "/members/" + adminId + "/roles")
                .then().statusCode(200).body("roles", contains("HARNESS_TRAINER"));
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"roles\":[\"NOT_A_ROLE\"]}").when().put(BASE + "/members/" + adminId + "/roles")
                .then().statusCode(400);

        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"baseRole\":\"MEMBER\"}").when().patch(BASE + "/members/" + adminId)
                .then().statusCode(200).body("baseRole", is("MEMBER"));
        // Now a member: no longer allowed to manage the team.
        given().header("Authorization", bearer(ADMIN)).when().get(BASE + "/invitations")
                .then().statusCode(200);
        given().header("Authorization", bearer(ADMIN)).contentType("application/json")
                .body("{\"emails\":[\"x@team.test\"]}").when().post(BASE + "/invitations")
                .then().statusCode(403);

        given().header("Authorization", bearer(OWNER)).when().delete(BASE + "/members/" + adminId)
                .then().statusCode(204);
        given().header("Authorization", bearer(ADMIN)).when().get(BASE + "/members")
                .then().statusCode(403);
    }

    @Test
    void anInvitationIsResentRevokedAndNotDuplicated() {
        String body = "{\"emails\":[\"" + NEWCOMER + "\"]}";
        String id = given().header("Authorization", bearer(OWNER)).contentType("application/json").body(body)
                .when().post(BASE + "/invitations").then().statusCode(201).extract().path("[0].invitation.id");
        String again = given().header("Authorization", bearer(OWNER)).contentType("application/json").body(body)
                .when().post(BASE + "/invitations").then().statusCode(201).extract().path("[0].invitation.id");
        given().header("Authorization", bearer(OWNER)).when().get(BASE + "/invitations")
                .then().body("$", hasSize(1));
        org.junit.jupiter.api.Assertions.assertEquals(id, again);

        String old = given().header("Authorization", bearer(OWNER))
                .when().post(BASE + "/invitations/" + id + "/resend")
                .then().statusCode(200).extract().path("token");
        given().header("Authorization", bearer(OWNER)).when().delete(BASE + "/invitations/" + id)
                .then().statusCode(204);
        given().header("Authorization", bearer(NEWCOMER)).contentType("application/json")
                .body("{\"token\":\"" + old + "\"}").when().post("/api/v1/me/invitations/accept")
                .then().statusCode(404);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"emails\":[\"" + OWNER + "\"]}").when().post(BASE + "/invitations")
                .then().statusCode(409);
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }

    private String userId(String email) {
        return given().header("Authorization", bearer(OWNER)).when().get(BASE + "/members")
                .then().statusCode(200).extract().path("members.find { it.email == '" + email + "' }.userId");
    }

    private void exec(String sql) throws SQLException {
        try (Connection c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
