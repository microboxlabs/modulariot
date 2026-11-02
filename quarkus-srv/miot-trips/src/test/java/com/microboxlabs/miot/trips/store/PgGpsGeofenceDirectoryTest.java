package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.gps.TestGpsDatabase;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Duration;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Tests real PostgreSQL ownership/upsert logic. External PostGIS conversion functions are explicit stubs. */
@EnabledIfSystemProperty(named = "miot.trips.test.pg-url", matches = ".+")
class PgGpsGeofenceDirectoryTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String AREA_A = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[2,0],[2,2],[0,0]]]}";
    private static final String AREA_B = "{\"type\":\"Polygon\",\"coordinates\":[[[1,1],[3,1],[3,3],[1,1]]]}";
    private static final String AREA_C = "{\"type\":\"Polygon\",\"coordinates\":[[[2,2],[4,2],[4,4],[2,2]]]}";
    private Vertx vertx;
    private Pool admin;
    private Pool writes;
    private Pool reads;
    private String schema;
    private GpsGeofenceDirectory directory;

    private Pool pool(Map<String, String> properties) {
        PgConnectOptions options = PgConnectOptions.fromUri(System.getProperty("miot.trips.test.pg-url"));
        options.setProperties(properties);
        return PgBuilder.pool().connectingTo(options).with(new PoolOptions().setMaxSize(2)).using(vertx).build();
    }

    @BeforeEach
    void setup() {
        vertx = Vertx.vertx();
        admin = pool(Map.of());
        schema = "cert_gps_" + UUID.randomUUID().toString().replace("-", "");
        admin.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
        writes = pool(Map.of("search_path", schema));
        for (String sql : List.of(
                "CREATE DOMAIN geography AS jsonb", "CREATE DOMAIN geometry AS jsonb",
                "CREATE FUNCTION ST_GeomFromGeoJSON(text) RETURNS jsonb LANGUAGE sql IMMUTABLE AS 'SELECT $1::jsonb'",
                "CREATE FUNCTION ST_SetSRID(jsonb, integer) RETURNS jsonb LANGUAGE sql IMMUTABLE AS 'SELECT $1'",
                "CREATE FUNCTION ST_AsGeoJSON(jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS 'SELECT $1::text'",
                "CREATE TABLE geofences (geofence_id SERIAL PRIMARY KEY, client_id TEXT NOT NULL, client_geofence_id TEXT NOT NULL,"
                        + " geofence_name TEXT, coordinates geography, geofence_classification INT, polygon_type TEXT,"
                        + " created_at TIMESTAMPTZ, updated_at TIMESTAMPTZ, properties JSONB, UNIQUE(client_id, client_geofence_id))")) {
            writes.query(sql).execute().await().atMost(TIMEOUT);
        }
        reads = pool(Map.of("search_path", schema, "default_transaction_read_only", "on"));
        directory = new GpsGeofenceDirectory(new TestGpsDatabase(reads, writes));
    }

    @AfterEach
    void cleanup() {
        if (reads != null) reads.closeAndAwait();
        if (writes != null) writes.closeAndAwait();
        if (admin != null) {
            admin.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            admin.closeAndAwait();
        }
        if (vertx != null) vertx.closeAndAwait();
    }

    @Test
    void movingAPlaceUpdatesOnlyItsOwnedAreaAndPreservesOtherTenants() {
        String location = UUID.randomUUID().toString();
        var shared = directory.create("tenant-a", "shared", "Shared", AREA_A, "{}").orElseThrow();
        var other = directory.create("tenant-b", location, "Other", AREA_A, "{}").orElseThrow();
        String properties = "{\"created_by\":\"miot-trips\",\"location_id\":\"" + location + "\"}";
        var manual = directory.place("tenant-a", location, "Manual", AREA_B, properties).orElseThrow();
        assertNotEquals(shared.id(), manual.id());
        var moved = directory.place("tenant-a", location, "Moved", AREA_C, properties).orElseThrow();
        assertEquals(manual.id(), moved.id());
        var areas = directory.shapes(List.of(shared.id(), other.id(), moved.id()));
        com.fasterxml.jackson.databind.ObjectMapper json = new com.fasterxml.jackson.databind.ObjectMapper();
        try {
            assertEquals(json.readTree(AREA_A), json.readTree(areas.get(shared.id())));
            assertEquals(json.readTree(AREA_A), json.readTree(areas.get(other.id())));
            assertEquals(json.readTree(AREA_C), json.readTree(areas.get(moved.id())));
        } catch (java.io.IOException cause) {
            throw new AssertionError(cause);
        }
        assertTrue(directory.find("tenant-b", manual.id()).isEmpty());
        assertEquals(List.of(other), directory.matching("tenant-b", location, null, 5));
        assertFalse(directory.search("tenant-a", "Moved", 5).isEmpty());
    }

    @Test
    void refusesToOverwriteAGeofenceOwnedOutsideTheLocation() {
        String location = UUID.randomUUID().toString();
        var external = directory.create("tenant-a", location, "External", AREA_A, "{}").orElseThrow();
        String properties = "{\"created_by\":\"miot-trips\",\"location_id\":\"" + location + "\"}";
        assertThrows(IllegalArgumentException.class,
                () -> directory.place("tenant-a", location, "Manual", AREA_B, properties));
        assertEquals(external, directory.find("tenant-a", external.id()).orElseThrow());
    }
}
