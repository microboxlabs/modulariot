package com.microboxlabs.miot.core.api;

import static io.restassured.RestAssured.given;
import static org.hamcrest.Matchers.empty;
import static org.hamcrest.Matchers.everyItem;
import static org.hamcrest.Matchers.hasItems;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import com.microboxlabs.miot.core.auth.TestTokenFactory;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.Connection;
import java.sql.SQLException;
import org.hibernate.reactive.mutiny.Mutiny;
import org.hibernate.stat.Statistics;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

/** {@code /me/scopes} for a platform owner runs the same queries whatever the number of organizations. */
@QuarkusTest
@TestProfile(PlatformTestProfile.class)
class MeScopesQueryCountTest {

    private static final String PREFIX = "scopes-count-";

    @Inject
    AgroalDataSource ds;

    @Inject
    Mutiny.SessionFactory sessionFactory;

    @AfterEach
    void clean() throws SQLException {
        exec("DELETE FROM miot_core.organizations WHERE slug LIKE '" + PREFIX + "%' AND parent_id IS NOT NULL");
        exec("DELETE FROM miot_core.organizations WHERE slug LIKE '" + PREFIX + "%'");
    }

    @Test
    void aPlatformOwnerCostsTheSameQueriesForThreeOrThirtyOrganizations() throws SQLException {
        seed(0, 3);
        long few = queriesForOwnerScopes();
        seed(3, 30);
        long many = queriesForOwnerScopes();

        assertTrue(few > 0, "statistics are not counting queries");
        assertEquals(few, many);
    }

    @Test
    void aPlatformOwnerIsOwnerOfEveryOrganizationWithSubAccountTaxIds() throws SQLException {
        seed(0, 1);
        exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, tax_id, parent_id) "
                + "SELECT '" + PREFIX + "child', 'Child', 'scopes-count-child', true, '76.000.000-0', id "
                + "FROM miot_core.organizations WHERE slug = '" + PREFIX + "0'");

        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().get("/api/v1/me/scopes")
                .then().statusCode(200)
                .body("slug", hasItems(PREFIX + "0", PREFIX + "child"))
                .body("findAll { it.slug != '_platform' }.role", everyItem(is("OWNER")))
                .body("slug[-1]", is("_platform"))
                .body("role[-1]", is("PLATFORM_OWNER"))
                .body("find { it.slug == '" + PREFIX + "0' }.effectiveTaxIds", is(java.util.List.of("76.000.000-0")))
                .body("find { it.slug == '" + PREFIX + "child' }.isParent", is(false));
    }

    @Test
    void aDisabledPlatformOwnerSeesNoOrganization() throws SQLException {
        seed(0, 1);
        queriesForOwnerScopes(); // records the owner's user
        String owner = "email = '" + PlatformTestProfile.OWNER_EMAIL + "'";
        exec("UPDATE miot_iam.iam_user SET status = 'DISABLED' WHERE " + owner);
        try {
            given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                    .when().get("/api/v1/me/scopes")
                    .then().statusCode(200).body("$", empty());
        } finally {
            exec("UPDATE miot_iam.iam_user SET status = 'ACTIVE' WHERE " + owner);
        }
    }

    private long queriesForOwnerScopes() {
        Statistics stats = sessionFactory.getStatistics();
        stats.clear();
        given().header("Authorization", bearer(PlatformTestProfile.OWNER_EMAIL))
                .when().get("/api/v1/me/scopes")
                .then().statusCode(200);
        return stats.getQueryExecutionCount();
    }

    private void seed(int from, int to) throws SQLException {
        for (int i = from; i < to; i++) {
            exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                    + "VALUES ('" + PREFIX + i + "', 'Org " + i + "', '" + PREFIX + i + "', true, 'NATIVE')");
        }
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
