package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.symptoms.dto.TripPlace;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** The real suggestions query against an explicitly supplied scratch database; no containers. */
@EnabledIfSystemProperty(named = "miot.symptoms.test.pg-url", matches = ".+")
class PgTripPlacesQueriesTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static Vertx vertx;
    private static Pool pool;
    private static boolean created;

    @BeforeAll
    static void createTrips() {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.symptoms.test.pg-url")))
                .using(vertx).build();
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_trips").execute().await().atMost(WAIT);
        // Refuse an existing trip_live table; only drop the table this test creates.
        pool.query("""
                CREATE TABLE miot_trips.trip_live (
                    tenant_code text, origin_geofence_label text, destination_geofence_label text)
                """).execute().await().atMost(WAIT);
        created = true;
        pool.query("""
                INSERT INTO miot_trips.trip_live VALUES
                    ('tenant-a', 'Planta Peñón', 'Bodega Sur'),
                    ('tenant-a', ' planta  penon ', 'Bodega Sur'),
                    ('tenant-a', NULL, '  '),
                    ('tenant-b', 'Origen privado', 'Destino privado'),
                    ('tenant-b', 'Planta Peñón', 'Destino privado')
                """).execute().await().atMost(WAIT);
    }

    @AfterAll
    static void close() {
        try {
            if (created) {
                pool.query("DROP TABLE miot_trips.trip_live").execute().await().atMost(WAIT);
            }
        } finally {
            if (pool != null) {
                pool.close().await().atMost(WAIT);
            }
            if (vertx != null) {
                vertx.close().await().atMost(WAIT);
            }
        }
    }

    @Test
    void bothOriginsAndDestinationsBelongOnlyToTheRequestedTenant() {
        var places = new PgTripPlaces(() -> pool);
        assertEquals(List.of(new TripPlace("Bodega Sur", 0, 2), new TripPlace("Planta Peñón", 2, 0)),
                places.places("tenant-a"));
        assertEquals(List.of(new TripPlace("Destino privado", 0, 2), new TripPlace("Origen privado", 1, 0),
                new TripPlace("Planta Peñón", 1, 0)), places.places("tenant-b"));
        assertEquals(List.of(), places.places("unknown"));
    }
}
