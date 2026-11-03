package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * V0.12.14 against a real database: the wrong-map reason leaves the seeded ignore_reason lists and "Indefinidamente"
 * is renamed, while lists an organization edited stay as they are. Skipped unless
 * {@code -Dmiot.symptoms.test.pg-url=...} is set; it re-creates a minimal {@code miot_core.selectables}.
 */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgIgnoreReasonsMigrationTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String REASONS = """
            [{"value": "ignore_reason_1", "label": {"es": "Falso positivo — mapa/límite incorrecto"}},
             {"value": "ignore_reason_2", "label": {"es": "Zona de sombra GPS conocida"}},
             {"value": "ignore_reason_6", "label": {"es": "Otro (detallar en la nota)"}}]
            """;
    private static final String DURATIONS = """
            [{"value": "ignore_duration_1", "label": {"es": "5 minutos"}},
             {"value": "ignore_duration_5", "label": {"es": "Indefinidamente", "en": "Indefinitely"}}]
            """;

    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void setUp() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTreatmentStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_core").execute().await().atMost(WAIT);
        pool.query("DROP TABLE IF EXISTS miot_core.selectables").execute().await().atMost(WAIT);
        pool.query("""
                CREATE TABLE miot_core.selectables (
                    tenant_code text NOT NULL, key text NOT NULL, options jsonb NOT NULL, updated_by text,
                    updated_at timestamptz, PRIMARY KEY (tenant_code, key))
                """).execute().await().atMost(WAIT);
        insert("seeded", "ignore_reason", REASONS, "system:defaults");
        insert("seeded", "ignore_duration", DURATIONS, "system:defaults");
        insert("edited", "ignore_reason", REASONS, "lead@example.com");
        insert("edited", "ignore_duration", DURATIONS, "lead@example.com");
        try (InputStream in = PgIgnoreReasonsMigrationTest.class.getResourceAsStream(
                "/db/migration/symptoms/V0.12.14__ignore_reasons_move_wrong_map.sql")) {
            String sql = new String(in.readAllBytes(), StandardCharsets.UTF_8);
            pool.query(sql).execute().await().atMost(WAIT);
            var firstUpdated = updatedAt();
            pool.query(sql).execute().await().atMost(WAIT);
            assertEquals(firstUpdated, updatedAt(), "reapplying the migration does not rewrite updated_at");
        }
    }

    @AfterAll
    static void tearDown() {
        pool.query("DROP TABLE IF EXISTS miot_core.selectables").execute().await().atMost(WAIT);
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    private static void insert(String tenant, String key, String options, String by) {
        PgIds.query(pool, "INSERT INTO miot_core.selectables (tenant_code, key, options, updated_by)"
                + " VALUES ($1, $2, $3::text::jsonb, $4)", Tuple.of(tenant, key, options, by));
    }

    private static List<java.time.OffsetDateTime> updatedAt() {
        List<java.time.OffsetDateTime> out = new ArrayList<>();
        PgIds.query(pool, "SELECT updated_at FROM miot_core.selectables ORDER BY tenant_code, key", Tuple.tuple())
                .forEach(r -> out.add(r.getOffsetDateTime("updated_at")));
        return out;
    }

    private static List<String> column(String tenant, String key, String path) {
        List<String> out = new ArrayList<>();
        PgIds.query(pool, "SELECT o #>> $3::text[] AS v FROM miot_core.selectables s,"
                + " jsonb_array_elements(s.options) WITH ORDINALITY x(o, n)"
                + " WHERE tenant_code = $1 AND key = $2 ORDER BY n",
                Tuple.of(tenant, key, path.split("\\."))).forEach(r -> out.add(r.getString("v")));
        return out;
    }

    @Test
    void theSeededListsLoseTheWrongMapReasonAndRenameIndefinitely() {
        assertEquals(List.of("ignore_reason_2", "ignore_reason_6"), column("seeded", "ignore_reason", "value"),
                "in order, once even when run twice");
        assertEquals(List.of("5 minutos", "Hasta que termine el viaje"),
                column("seeded", "ignore_duration", "label.es"));
        assertEquals("Until the trip ends", column("seeded", "ignore_duration", "label.en").get(1));
    }

    @Test
    void anEditedListIsLeftAlone() {
        assertEquals(List.of("ignore_reason_1", "ignore_reason_2", "ignore_reason_6"),
                column("edited", "ignore_reason", "value"));
        assertEquals("Indefinidamente", column("edited", "ignore_duration", "label.es").get(1));
    }
}
