package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
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
 * The speed limit zones table and the signal builder's query against a real database. Skipped unless
 * {@code -Dmiot.symptoms.test.pg-url=...} is set; the {@code miot_symptoms} schema is dropped and re-created.
 */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgSpeedLimitZonesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static Vertx vertx;
    private static Pool pool;

    @BeforeAll
    static void migrate() throws Exception {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("DROP SCHEMA IF EXISTS miot_symptoms CASCADE").execute().await().atMost(WAIT);
        pool.query("CREATE SCHEMA miot_symptoms").execute().await().atMost(WAIT);
        try (InputStream in = PgSpeedLimitZonesTest.class.getResourceAsStream(
                "/db/migration/symptoms/V0.12.22__speed_limit_zones.sql")) {
            pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void activeZonesAreReadAndPlaceTheLimit() {
        String square = "{\"type\":\"Polygon\",\"coordinates\":[[[-70.7,-33.5],[-70.6,-33.5],[-70.6,-33.4],"
                + "[-70.7,-33.4],[-70.7,-33.5]]]}";
        pool.query("""
                INSERT INTO miot_symptoms.speed_limit_zone
                    (tenant_code, name, shape, speed_forward, speed_backward, forward_from, forward_to, updated_by)
                VALUES ('org-1', 'Camino', '%1$s', 60, 40, 270, 90, 'test'),
                       ('org-1', 'Cerrada', '%1$s', 20, NULL, NULL, NULL, 'test')
                """.formatted(square)).execute().await().atMost(WAIT);
        pool.query("UPDATE miot_symptoms.speed_limit_zone SET active = false WHERE name = 'Cerrada'").execute()
                .await().atMost(WAIT);

        List<SpeedZones.Zone> zones = new ArrayList<>();
        pool.query(SignalStream.SPEED_ZONES_SQL).execute().await().atMost(WAIT).forEach(r -> zones.add(
                SpeedZones.zone(r.getString("tenant_code"), r.getInteger("id"), r.getInteger("speed_forward"),
                        r.getInteger("speed_backward"), r.getInteger("forward_from"), r.getInteger("forward_to"),
                        r.getInteger("heading"), r.getString("shape"))));
        SpeedZones own = new SpeedZones();
        own.load(zones);

        assertEquals(1, own.size());
        assertEquals(40, own.at("org-1", -70.65, -33.45, null, 180).maxspeed());
    }
}
