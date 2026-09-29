package com.microboxlabs.miot.core.selectable;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.hasKey;
import static org.hamcrest.Matchers.is;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.StubAlfrescoMembershipClient;
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

/**
 * The selectables security contract end to end: the organization filter, the
 * owner gate on writes, and the JSON 400/404 mapping, none of which the service
 * unit tests reach. The stub makes {@link StubAlfrescoMembershipClient#MEMBER_EMAIL}
 * a member of every organization; it is the recorded owner of {@link #OWNED}
 * only, so the same user is a plain member of {@link #NOT_OWNED}.
 */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class OrgSelectablesResourceTest {

    private static final String OWNED = "selectables-owned-org";
    private static final String NOT_OWNED = "selectables-member-org";
    private static final String MEMBER = StubAlfrescoMembershipClient.MEMBER_EMAIL;
    private static final String LIST_BODY =
            "{\"name\":\"Motivos\",\"mode\":\"SINGLE\",\"options\":[{\"name\":\"Uno\"}]}";

    @Inject
    AgroalDataSource ds;

    @BeforeEach
    void seedOrganizations() throws SQLException {
        insertOrganization(OWNED, MEMBER);
        insertOrganization(NOT_OWNED, "someone-else@test.example");
    }

    /** Role assignments go with their organization (ON DELETE CASCADE). */
    @AfterEach
    void removeOrganizations() throws SQLException {
        try (Connection c = ds.getConnection();
                var st = c.prepareStatement("DELETE FROM miot_core.organizations WHERE slug IN (?, ?)")) {
            st.setString(1, OWNED);
            st.setString(2, NOT_OWNED);
            st.executeUpdate();
        }
    }

    @Test
    void anOwnerWritesAndReadsBack() {
        given().header("Authorization", bearer(MEMBER)).contentType("application/json").body(LIST_BODY)
                .when().put(path(OWNED) + "/reasons")
                .then().statusCode(200)
                .body("key", is("reasons"))
                .body("options[0].name", is("Uno"));

        given().header("Authorization", bearer(MEMBER))
                .when().get(path(OWNED) + "/reasons")
                .then().statusCode(200)
                .body("name", is("Motivos"));

        given().header("Authorization", bearer(MEMBER))
                .when().delete(path(OWNED) + "/reasons")
                .then().statusCode(204);
    }

    @Test
    void aMemberWhoIsNotAnOwnerReadsButCannotWrite() {
        given().header("Authorization", bearer(MEMBER))
                .when().get(path(NOT_OWNED))
                .then().statusCode(200);

        given().header("Authorization", bearer(MEMBER)).contentType("application/json").body(LIST_BODY)
                .when().put(path(NOT_OWNED) + "/reasons")
                .then().statusCode(403);
        given().header("Authorization", bearer(MEMBER)).contentType("application/json").body("{}")
                .when().post(path(NOT_OWNED) + "/reset")
                .then().statusCode(403);
        given().header("Authorization", bearer(MEMBER)).contentType("application/json")
                .body("{\"bindings\":{\"field\":\"reasons\"}}")
                .when().put(path(NOT_OWNED) + "/bindings")
                .then().statusCode(403);
        given().header("Authorization", bearer(MEMBER))
                .when().delete(path(NOT_OWNED) + "/reasons")
                .then().statusCode(403);
    }

    @Test
    void aNonMemberIsTurnedAwayAndNoTokenIsUnauthorized() {
        given().header("Authorization", bearer("intruder@test.example"))
                .when().get(path(OWNED))
                .then().statusCode(403);
        given().when().get(path(OWNED)).then().statusCode(401);
    }

    @Test
    void validationAndMissingListsAreJsonErrors() {
        given().header("Authorization", bearer(MEMBER)).contentType("application/json")
                .body("{\"name\":\" \",\"mode\":\"SINGLE\"}")
                .when().put(path(OWNED) + "/reasons")
                .then().statusCode(400)
                .body("$", hasKey("error"));

        given().header("Authorization", bearer(MEMBER))
                .when().get(path(OWNED) + "/never_created")
                .then().statusCode(404)
                .body("$", hasKey("error"));

        given().header("Authorization", bearer(MEMBER))
                .when().delete(path(OWNED) + "/never_created")
                .then().statusCode(404)
                .body("$", hasKey("error"));
    }

    private void insertOrganization(String slug, String owner) throws SQLException {
        try (Connection c = ds.getConnection()) {
            try (var st = c.prepareStatement("INSERT INTO miot_core.organizations "
                    + "(slug, name, alfresco_group_id, tenant_client_id, active) VALUES (?, ?, ?, ?, true)")) {
                st.setString(1, slug);
                st.setString(2, slug);
                st.setString(3, "GROUP_" + slug.replace('-', '_'));
                st.setString(4, slug + "-tenant");
                st.executeUpdate();
            }
            try (var st = c.prepareStatement("INSERT INTO miot_core.organization_role_assignments "
                    + "(organization_id, role_code, person_id) "
                    + "SELECT id, 'ORGANIZATION_OWNER', ? FROM miot_core.organizations WHERE slug = ?")) {
                st.setString(1, owner);
                st.setString(2, slug);
                st.executeUpdate();
            }
        }
    }

    private static String path(String slug) {
        return "/api/v1/orgs/" + slug + "/selectables";
    }

    private static String bearer(String email) {
        return "Bearer " + TestTokenFactory.signWebToken(email);
    }
}
