package com.microboxlabs.miot.core.iam;

import static io.restassured.RestAssured.given;
import static org.awaitility.Awaitility.await;
import static org.hamcrest.Matchers.is;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.auth.PlatformTestProfile;
import io.agroal.api.AgroalDataSource;
import io.quarkus.test.junit.QuarkusTest;
import io.quarkus.test.junit.TestProfile;
import jakarta.inject.Inject;
import java.sql.SQLException;
import java.time.Duration;
import java.util.HashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The scheduled observer stays fresh even when another pod owns migration. */
@QuarkusTest
@TestProfile(NativeMembershipReadinessRefreshTest.Observer.class)
class NativeMembershipReadinessRefreshTest {

    public static class Observer extends PlatformTestProfile {
        @Override
        public Map<String, String> getConfigOverrides() {
            Map<String, String> overrides = new HashMap<>(super.getConfigOverrides());
            overrides.put(NativeMembershipMigration.ENABLED_PROPERTY, "false");
            overrides.put("miot.iam.native-migration.every", "1s");
            return overrides;
        }
    }

    @Inject
    AgroalDataSource ds;

    @Test
    void scheduledRefreshSeesRemoteCompletionAndNewPendingOrganizations() throws SQLException {
        try {
            exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                    + "VALUES ('readiness-observer', 'Observer', 'observer-client', true, 'ALFRESCO')");
            awaitReadiness(503, "DOWN");
            // A different pod commits the migration; this pod only observes it.
            exec("UPDATE miot_core.organizations SET membership_source = 'NATIVE' "
                    + "WHERE slug = 'readiness-observer'");
            awaitReadiness(200, "UP");
            exec("INSERT INTO miot_core.organizations (slug, name, tenant_client_id, active, membership_source) "
                    + "VALUES ('readiness-created-later', 'Later', 'later-client', true, 'ALFRESCO')");
            awaitReadiness(503, "DOWN");
            try (var c = ds.getConnection(); var st = c.createStatement();
                    var rows = st.executeQuery("SELECT membership_source FROM miot_core.organizations "
                            + "WHERE slug = 'readiness-created-later'")) {
                rows.next();
                assertEquals("ALFRESCO", rows.getString(1), "Local migration must remain disabled");
            }
        } finally {
            exec("DELETE FROM miot_core.organizations WHERE slug IN ('readiness-observer', 'readiness-created-later')");
        }
    }

    private void awaitReadiness(int code, String status) {
        await().atMost(Duration.ofSeconds(5)).pollInterval(Duration.ofMillis(100)).untilAsserted(() ->
                given().when().get("/q/health/ready").then().statusCode(code)
                        .body("checks.find { it.name == 'native-membership-migration' }.status", is(status)));
    }

    private void exec(String sql) throws SQLException {
        try (var c = ds.getConnection(); var st = c.createStatement()) {
            st.executeUpdate(sql);
        }
    }
}
