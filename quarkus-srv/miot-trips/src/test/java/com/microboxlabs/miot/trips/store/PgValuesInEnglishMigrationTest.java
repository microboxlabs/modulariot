package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * V0.10.9 on rows written with the Spanish values: they come out in English, history rows included, and the
 * versioning triggers write no version rows. Skipped unless {@code -Dmiot.trips.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgValuesInEnglishMigrationTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void open() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(
                PgTripsStoresTest.URL_PROPERTY))).using(vertx).build();
    }

    @AfterAll
    static void close() throws IOException {
        PgTripsStoresTest.recreateSchemas(pool);
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static Row one(String sql) {
        return pool.query(sql).execute().await().atMost(WAIT).iterator().next();
    }

    private static void run(String sql) {
        pool.query(sql).execute().await().atMost(WAIT);
    }

    @Test
    void spanishRowsComeOutInEnglishWithoutNewVersions() throws IOException {
        PgTripsStoresTest.recreateSchemas(pool, PgTripsStoresTest.migrationCount() - 1);
        run("""
                INSERT INTO miot_trips.location (id, tenant_code, name, type) VALUES
                    ('00000000-0000-0000-0000-000000000001', 't', 'Planta', 'planta');
                INSERT INTO miot_trips.mandate (id, tenant_code, external_code, status) VALUES
                    ('00000000-0000-0000-0000-000000000002', 't', 'S-1', 'en_ejecucion');
                INSERT INTO miot_trips.trip (id, tenant_code, status) VALUES
                    ('00000000-0000-0000-0000-000000000003', 't', 'en_ruta');
                INSERT INTO miot_trips.stage (tenant_code, subject_type, subject_id, seq, stage_type, status)
                    VALUES ('t', 'trip', '00000000-0000-0000-0000-000000000003', 1, 'preparacion', 'cerrada'),
                           ('t', 'trip', '00000000-0000-0000-0000-000000000003', 2, 'transito', 'en_curso'),
                           ('t', 'trip', '00000000-0000-0000-0000-000000000003', 3, 'cierre', 'pendiente');
                """);
        long rowsBefore = one("SELECT count(*) FROM miot_trips.stage").getLong(0);

        PgTripsStoresTest.migrate(pool, "/db/migration/trips/V0.10.9__values_in_english.sql");

        assertEquals("plant", one("SELECT type FROM miot_trips.location").getString(0));
        assertEquals("in_progress", one("SELECT status FROM miot_trips.mandate").getString(0));
        assertEquals("in_progress", one("SELECT status FROM miot_trips.trip").getString(0));
        assertEquals("preparation:completed,transit:in_progress,closing:pending", one(
                "SELECT string_agg(stage_type || ':' || status, ',' ORDER BY seq) FROM miot_trips.stage")
                .getString(0));
        assertEquals(rowsBefore, one("SELECT count(*) FROM miot_trips.stage").getLong(0),
                "no version rows while translating");
        assertEquals("active", one("""
                INSERT INTO miot_trips.mandate (tenant_code, external_code) VALUES ('t', 'S-2')
                RETURNING status""").getString(0), "the default is in English too");
    }
}
