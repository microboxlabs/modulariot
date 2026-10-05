package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.contains;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.is;
import static org.hamcrest.Matchers.startsWith;

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

/** Teams, scoped bindings and API keys end to end on a native organization with one sub-account. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class TeamsAndKeysTest {

    private static final String ORG = "teams-keys-org";
    private static final String SUB = "teams-keys-north";
    private static final String OWNER = "owner@keys.test";
    private static final String ANA = "ana@keys.test";
    private static final String BASE = "/api/v1/orgs/" + ORG + "/team";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seed() throws SQLException {
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                + "VALUES ('" + ORG + "', 'Keys', 'keys-client', true, 'NATIVE')");
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, parent_id) "
                + "SELECT '" + SUB + "', 'North', 'keys-client', true, id FROM miot_core.organizations WHERE slug = '"
                + ORG + "'");
        for (String[] m : new String[][] {{OWNER, "OWNER"}, {ANA, "MEMBER"}}) {
            exec("INSERT INTO miot_iam.iam_user (email) VALUES ('" + m[0] + "') ON CONFLICT DO NOTHING");
            exec("INSERT INTO miot_iam.iam_membership (organization_id, user_id, base_role) "
                    + "SELECT o.id, u.id, '" + m[1] + "' FROM miot_core.organizations o, miot_iam.iam_user u "
                    + "WHERE o.slug = '" + ORG + "' AND u.email = '" + m[0] + "'");
        }
    }

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug IN ('" + SUB + "', '" + ORG + "')");
    }

    @Test
    void aTeamsRoleReachesItsMembers() {
        String ana = userId(ANA);
        String team = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"name\":\"Turno A\"}").when().post(BASE + "/teams")
                .then().statusCode(201).extract().path("id");
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"userIds\":[\"" + ana + "\"]}").when().put(BASE + "/teams/" + team + "/members")
                .then().statusCode(200).body("members", contains(ana));
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"principalKind\":\"TEAM\",\"principalId\":\"" + team + "\",\"role\":\"HARNESS_TRAINER\"}")
                .when().post(BASE + "/bindings").then().statusCode(201);

        given().header("Authorization", bearer(ANA)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200).body("roles", contains("HARNESS_TRAINER"));

        given().header("Authorization", bearer(OWNER)).when().delete(BASE + "/teams/" + team)
                .then().statusCode(204);
        given().header("Authorization", bearer(ANA)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200).body("roles", empty());
    }

    @Test
    void aSubAccountBindingAppliesThereOnly() {
        String ana = userId(ANA);
        given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"principalKind\":\"USER\",\"principalId\":\"" + ana + "\",\"role\":\"HARNESS_TRAINER\","
                        + "\"subAccount\":\"" + SUB + "\"}")
                .when().post(BASE + "/bindings").then().statusCode(201).body("subAccount", is(SUB));

        given().header("Authorization", bearer(ANA)).when().get("/api/v1/orgs/" + SUB + "/me/access")
                .then().statusCode(200).body("roles", contains("HARNESS_TRAINER"));
        given().header("Authorization", bearer(ANA)).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200).body("roles", empty());

        // A member without members:update cannot grant.
        given().header("Authorization", bearer(ANA)).contentType("application/json")
                .body("{\"principalKind\":\"USER\",\"principalId\":\"" + ana + "\",\"role\":\"HARNESS_TRAINER\"}")
                .when().post(BASE + "/bindings").then().statusCode(403);
    }

    @Test
    void anApiKeyActsWithItsServiceAccountsRolesUntilRevoked() {
        var created = given().header("Authorization", bearer(OWNER)).contentType("application/json")
                .body("{\"name\":\"Integrador\",\"roles\":[\"HARNESS_TRAINER\"]}")
                .when().post(BASE + "/service-accounts")
                .then().statusCode(201)
                .body("secret", startsWith(ApiKeyService.PREFIX))
                .extract();
        String secret = created.path("secret");
        String accountId = created.path("serviceAccount.id");
        String keyId = created.path("serviceAccount.keys[0].id");

        given().header("Authorization", "Bearer " + secret).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(200)
                .body("baseRole", is("MEMBER"))
                .body("roles", contains("HARNESS_TRAINER"));
        // Another organization: not a member.
        given().header("Authorization", "Bearer " + secret).when().get("/api/v1/orgs/iam-nowhere/me/access")
                .then().statusCode(403);
        // It cannot manage keys.
        given().header("Authorization", "Bearer " + secret).when().get(BASE + "/service-accounts")
                .then().statusCode(403);

        given().header("Authorization", bearer(OWNER))
                .when().delete(BASE + "/service-accounts/" + accountId + "/keys/" + keyId)
                .then().statusCode(204);
        given().header("Authorization", "Bearer " + secret).when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(401);
        given().header("Authorization", "Bearer miot_sk_short_bad").when().get("/api/v1/orgs/" + ORG + "/me/access")
                .then().statusCode(401);
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
