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
        Place original = place("geofence", "SCL", "Planta", "Ruta 5", SQUARE);
        sync.saved(TENANT, "SCL", original);
        double first = rows().get(0).getDouble("area");

        Place edited = new Place(original.id(), TENANT, "geofence", null, "SCL", "Planta Norte", null, null,
                null, null, "{}", SMALLER, null, null, null, null, null, null, null);
        sync.saved(TENANT, "SCL", edited);

        List<Row> rows = rows();
        assertEquals(1, rows.size(), "the same row: (client_id, client_geofence_id) is its key");
        assertEquals("Planta Norte", rows.get(0).getString("geofence_name"));
        assertEquals("polygonal", rows.get(0).getString("polygon_type"));
        assertTrue(rows.get(0).getDouble("area") < first, "the shape is replaced");

        sync.saved(TENANT, "AND-1", place("inner_geofence", "AND-1", "Andén", null, SMALLER));
        assertEquals(2, rows().size(), "an inner geofence is a geofence of its own");

        sync.deleted(TENANT, "SCL", edited);
        sync.deleted(TENANT, "SCL", edited);
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
    void anImportedGeofencesRowIsAdoptedBySavingAndRemovedByDeleting() {
        gpsPool.preparedQuery("INSERT INTO geofences (client_id, client_geofence_id, geofence_name, properties)"
                + " VALUES ($1, 'SCL', 'Legacy', '{\"geofence_type\": 0}')").execute(Tuple.of(TENANT))
                .await().atMost(TIMEOUT);
        Place source = place("geofence", "SCL", "New", null, SQUARE);

        sync.saved(TENANT, "SCL", source);
        List<Row> rows = rows();
        assertEquals(1, rows.size(), "the same row: the organization and code are the key");
        assertEquals("New", rows.get(0).getString("geofence_name"));
        String properties = rows.get(0).getString("properties");
        assertTrue(properties.contains("\"created_by\": \"miot-places\""), properties);
        assertTrue(properties.contains(source.id().toString()), properties);

        sync.deleted(TENANT, "SCL", source);
        assertEquals(List.of(), rows());
    }

    @Test
    void anUnmarkedRowIsRemovedByDeletingThePlaceWithItsCode() {
        gpsPool.preparedQuery("INSERT INTO geofences (client_id, client_geofence_id, geofence_name)"
                + " VALUES ($1, 'SCL', 'Legacy')").execute(Tuple.of(TENANT)).await().atMost(TIMEOUT);

        sync.deleted(TENANT, "SCL", place("geofence", "SCL", "Imported", null, SQUARE));

        assertEquals(List.of(), rows(), "an imported place never edited still owns its row");
    }

    @Test
    void ownershipPropertiesCannotBeSuppliedByTheCaller() {
        Place source = place("geofence", "SCL", "Example", null,
                SQUARE.replace("\"note\":\"planta\"", "\"created_by\":\"legacy\",\"miot_place_id\":\"forged\""));
        sync.saved(TENANT, "SCL", source);
        String properties = rows().get(0).getString("properties");
        assertTrue(properties.contains("\"created_by\": \"miot-places\""));
        assertTrue(properties.contains(source.id().toString()));
        sync.deleted(TENANT, "SCL", source);
        assertEquals(List.of(), rows());
    }

    @Test
    void theSameExternalCodeInTwoClientsStaysIsolated() {
        Place first = place("geofence", "SCL", "First", null, SQUARE);
        Place second = new Place(UUID.randomUUID(), "other-client", "geofence", null, "SCL", "Second",
                null, null, null, null, "{}", SQUARE, null, null, null, null, null, null, null);
        sync.saved(TENANT, "SCL", first);
        sync.saved("other-client", "SCL", second);
        sync.saved(TENANT, "SCL", first);
        assertEquals(2, rows().size());
        sync.deleted(TENANT, "SCL", first);
        assertEquals("other-client", rows().get(0).getString("client_id"));
    }

    @Test
    void aRouteNeverReachesStreamHub() {
        String line = """
                {"type":"Feature","geometry":{"type":"LineString","coordinates":[[-70,-33],[-69,-32]]},"properties":{}}""";
        Place route = place("route", "R68", "Ruta 68", null, line);
        sync.saved(TENANT, "R68", route);
        sync.deleted(TENANT, "R68", route);

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
        sync.deleted(TENANT, "LOC-1", over);

        assertEquals("Bodega", rows().get(0).getString("geofence_name"));
    }

    @Test
    void itCopiesOnlyWhenEnabledAndTheGpsDatabaseIsConfigured() {
        assertTrue(sync.copies());
        assertFalse(new StreamHubPlaceSync(PlacesTestGpsDatabase.writing(gpsPool), false).copies());
        assertFalse(new StreamHubPlaceSync(PlacesTestGpsDatabase.notConfigured(), true).copies());
    }
}
