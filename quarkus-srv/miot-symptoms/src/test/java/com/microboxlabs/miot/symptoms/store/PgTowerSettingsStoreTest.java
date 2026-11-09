package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The telephony choice against a real database. Skipped unless {@code -Dmiot.symptoms.test.pg-url=...} is set,
 * as {@link PgTreatmentStoresTest}; the {@code miot_symptoms} schema is dropped and re-created.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgTowerSettingsStoreTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final List<String> MIGRATIONS = List.of("V0.8.3__create_tower_settings.sql",
            "V0.12.16__tower_settings_telephony.sql");

    private static Vertx vertx;
    private static Pool pool;

    private final PgTowerSettingsStore store = new PgTowerSettingsStore(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTreatmentStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_symptoms").execute().await().atMost(WAIT);
        for (String file : MIGRATIONS) {
            try (InputStream in = PgTowerSettingsStoreTest.class.getResourceAsStream(
                    "/db/migration/symptoms/" + file)) {
                pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
            }
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void choosingWithoutASettingsRowCreatesIt() {
        String tenant = "tenant-" + UUID.randomUUID();
        assertTrue(store.find(tenant).isEmpty());

        store.saveTelephonyProvider(tenant, "TEAMS_PHONE", "owner@example.com");

        assertEquals(Optional.of("TEAMS_PHONE"), store.telephonyProvider(tenant));
        var row = store.find(tenant).orElseThrow();
        assertEquals(8, row.shiftHours());
        assertEquals("owner@example.com", row.updatedBy());
    }

    @Test
    void choosingAgainKeepsTheTeam() {
        String tenant = "tenant-" + UUID.randomUUID();
        store.save(new com.microboxlabs.miot.symptoms.domain.TowerSettings(tenant, 12, 6, 100, "old",
                java.time.OffsetDateTime.now()));

        store.saveTelephonyProvider(tenant, "TELNYX", "owner@example.com");

        assertEquals(Optional.of("TELNYX"), store.telephonyProvider(tenant));
        var row = store.find(tenant).orElseThrow();
        assertEquals(12, row.operators());
        assertEquals(6, row.shiftHours());
    }
}
