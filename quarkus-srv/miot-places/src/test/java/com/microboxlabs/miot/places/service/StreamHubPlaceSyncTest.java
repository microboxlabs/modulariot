package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.gps.PlacesTestGpsDatabase;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Duration;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * The StreamHub sync on real PostGIS, against a scratch {@code geofences} with the columns the GPS database has.
 * Skipped unless {@code -Dmiot.places.test.pg-url=…} is set.
 */
@EnabledIfSystemProperty(named = "miot.places.test.pg-url", matches = ".+")
class StreamHubPlaceSyncTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String TENANT = "acme-client";
    private static final String SQUARE = """
            {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32],[-69,-32],[-70,-33]]]},
             "properties":{"note":"planta"}}""";
    private static final String SMALLER = """
            {"type":"Feature","geometry":{"type":"Polygon","coordinates":[[[-70,-33],[-70,-32.5],[-69.5,-32.5],[-70,-33]]]},
             "properties":{}}""";

    private Vertx vertx;
    private Pool admin;
    private Pool gpsPool;
    private String schema;
    private StreamHubPlaceSync sync;

    @BeforeEach
    void setup() {
        vertx = Vertx.vertx();
        admin = pool(Map.of());
        schema = "cert_gps_" + UUID.randomUUID().toString().replace("-", "");
        admin.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
        gpsPool = pool(Map.of("search_path", schema + ",public"));
        gpsPool.query("""
                CREATE TABLE geofences (geofence_id SERIAL PRIMARY KEY, client_id TEXT NOT NULL,
                    client_geofence_id TEXT NOT NULL, geofence_name TEXT, coordinates geography,
                    geofence_classification INTEGER, polygon_type TEXT, created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ,
                    properties JSONB, UNIQUE (client_id, client_geofence_id))""").execute().await().atMost(TIMEOUT);
        sync = new StreamHubPlaceSync(PlacesTestGpsDatabase.writing(gpsPool), true);
    }

    @AfterEach
    void cleanup() {
        if (gpsPool != null) gpsPool.closeAndAwait();
        if (admin != null) {
            admin.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            admin.closeAndAwait();
        }
        if (vertx != null) vertx.closeAndAwait();
    }

    private Pool pool(Map<String, String> properties) {
        PgConnectOptions options = PgConnectOptions.fromUri(System.getProperty("miot.places.test.pg-url"))
                .setProperties(properties);
        return PgBuilder.pool().connectingTo(options).with(new PoolOptions().setMaxSize(1)).using(vertx).build();
    }

    private static Place place(String kind, String code, String name, String address, String geojson) {
        return new Place(UUID.randomUUID(), TENANT, kind, null, code, name, null, null, address, null, "{}", geojson,
                null, null, null, null, null, null, null);
    }

    private List<Row> rows() {
        List<Row> out = new ArrayList<>();
        gpsPool.query("""
                SELECT client_id, client_geofence_id, geofence_name, polygon_type, properties::text AS properties,
                       round(ST_Area(coordinates)) AS area
                FROM geofences ORDER BY geofence_id""").execute().await().atMost(TIMEOUT).forEach(out::add);
        return out;
    }

    @Test
    void aSavedGeofenceIsUpsertedByItsCodeAndADeletedOneRemoved() {
        sync.saved(TENANT, "SCL", place("geofence", "SCL", "Planta", "Ruta 5", SQUARE));
        double first = rows().get(0).getDouble("area");

        sync.saved(TENANT, "SCL", place("geofence", "SCL", "Planta Norte", null, SMALLER));

        List<Row> rows = rows();
        assertEquals(1, rows.size(), "the same row: (client_id, client_geofence_id) is its key");
        assertEquals("Planta Norte", rows.get(0).getString("geofence_name"));
        assertEquals("polygonal", rows.get(0).getString("polygon_type"));
        assertTrue(rows.get(0).getDouble("area") < first, "the shape is replaced");

        sync.saved(TENANT, "AND-1", place("inner_geofence", "AND-1", "Andén", null, SMALLER));
        assertEquals(2, rows().size(), "an inner geofence is a geofence of its own");

        sync.deleted(TENANT, "SCL", "geofence");
        sync.deleted(TENANT, "SCL", "geofence");
        assertEquals(List.of("AND-1"), rows().stream().map(r -> r.getString("client_geofence_id")).toList(),
                "removed for good; removing it again is no failure");
    }

    @Test
    void thePropertiesAreTheFeaturesWithTheAddress() {
        sync.saved(TENANT, "SCL", place("geofence", "SCL", "Planta", "Ruta 5", SQUARE));

        String properties = rows().get(0).getString("properties");
        assertTrue(properties.contains("\"note\": \"planta\""), properties);
        assertTrue(properties.contains("\"address\": \"Ruta 5\""), properties);
    }

    @Test
    void aRouteNeverReachesStreamHub() {
        String line = """
                {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-70,-33],[-69,-32]]},"properties":{}}""";
        sync.saved(TENANT, "R68", place("route", "R68", "Ruta 68", null, line));
        sync.deleted(TENANT, "R68", "route");

        assertEquals(List.of(), rows());
    }

    @Test
    void aTripsLocationGeofenceIsNeverReplacedOrRemoved() {
        gpsPool.preparedQuery("""
                INSERT INTO geofences (client_id, client_geofence_id, geofence_name, properties)
                VALUES ($1, 'LOC-1', 'Bodega', '{"created_by":"miot-trips","location_id":"LOC-1"}')""")
                .execute(Tuple.of(TENANT)).await().atMost(TIMEOUT);
        Place over = place("geofence", "LOC-1", "Encima", null, SQUARE);

        assertThrows(IllegalStateException.class, () -> sync.saved(TENANT, "LOC-1", over));
        sync.deleted(TENANT, "LOC-1", "geofence");

        assertEquals("Bodega", rows().get(0).getString("geofence_name"));
    }

    @Test
    void itCopiesOnlyWhenEnabledAndTheGpsDatabaseIsConfigured() {
        assertTrue(sync.copies());
        assertFalse(new StreamHubPlaceSync(PlacesTestGpsDatabase.writing(gpsPool), false).copies());
        assertFalse(new StreamHubPlaceSync(PlacesTestGpsDatabase.notConfigured(), true).copies());
    }
}
