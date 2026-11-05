package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.gps.TestGpsDatabase;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
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

/** Real geography queries in a scratch schema; enabled with {@code miot.trips.test.postgis-url}. */
@EnabledIfSystemProperty(named = "miot.trips.test.postgis-url", matches = ".+")
class PostgisGeofenceDirectoryTest {

    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String AREA = "{\"type\":\"Polygon\",\"coordinates\":[[[10,20],[12,20],[12,22],[10,22],[10,20]]]}";
    private Vertx vertx;
    private Pool admin;
    private Pool writes;
    private Pool reads;
    private String schema;
    private GpsGeofenceDirectory directory;

    private Pool pool(Map<String, String> properties) {
        PgConnectOptions options = PgConnectOptions.fromUri(System.getProperty("miot.trips.test.postgis-url"));
        options.setProperties(properties);
        return PgBuilder.pool().connectingTo(options).with(new PoolOptions().setMaxSize(2)).using(vertx).build();
    }

    @BeforeEach
    void setup() {
        vertx = Vertx.vertx();
        admin = pool(Map.of());
        admin.query("CREATE EXTENSION IF NOT EXISTS postgis").execute().await().atMost(TIMEOUT);
        schema = "geofence_spatial_" + UUID.randomUUID().toString().replace("-", "");
        admin.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
        writes = pool(Map.of("search_path", schema + ",public"));
        writes.query("""
                CREATE TABLE geofences (
                    geofence_id INTEGER PRIMARY KEY, client_id TEXT NOT NULL, client_geofence_id TEXT NOT NULL,
                    geofence_name TEXT, coordinates geography, properties JSONB, UNIQUE(client_id, client_geofence_id))
                """).execute().await().atMost(TIMEOUT);
        reads = pool(Map.of("search_path", schema + ",public", "default_transaction_read_only", "on"));
        directory = new GpsGeofenceDirectory(new TestGpsDatabase(reads, writes));
    }

    @AfterEach
    void cleanup() {
        if (reads != null) reads.closeAndAwait();
        if (writes != null) writes.closeAndAwait();
        if (admin != null) {
            if (schema != null) admin.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            admin.closeAndAwait();
        }
        if (vertx != null) vertx.closeAndAwait();
    }

    private void insert(int id, String tenant, String code, String area, String properties) {
        writes.preparedQuery("""
                INSERT INTO geofences (geofence_id, client_id, client_geofence_id, geofence_name, coordinates, properties)
                VALUES ($1, $2, $3, $3, ST_SetSRID(ST_GeomFromGeoJSON($4::text), 4326)::geography, $5::text::jsonb)
                """).execute(Tuple.of(id, tenant, code, area, properties)).await().atMost(TIMEOUT);
    }

    private List<Integer> containing(String tenant, double lon, double lat, int limit) {
        return directory.containing(tenant, lon, lat, limit).stream().map(GeofenceDirectory.Geofence::id).toList();
    }

    @Test
    void filtersByTenantAndKeepsLongitudeBeforeLatitude() {
        insert(1, "tenant-b", "other-tenant", AREA, "{}");
        insert(2, "tenant-a", "target", AREA, "{}");
        insert(3, "tenant-a", "swapped", """
                {"type":"Polygon","coordinates":[[[20,10],[22,10],[22,12],[20,12],[20,10]]]}
                """, "{}");

        assertEquals(List.of(2), containing("tenant-a", 11, 21, 10));
        assertEquals(List.of(3), containing("tenant-a", 21, 11, 10));
        assertTrue(containing("tenant-a", 30, 40, 10).isEmpty());
    }

    @Test
    void includesTheBoundaryAndVertexOfTheGeography() {
        insert(1, "tenant-a", "target", AREA, "{}");

        assertEquals(List.of(1), containing("tenant-a", 10, 21, 1));
        assertEquals(List.of(1), containing("tenant-a", 10, 20, 1));
        assertTrue(containing("tenant-a", 9.999, 21, 1).isEmpty());
    }

    @Test
    void ordersOverlappingAreasByLowestIdBeforeApplyingTheLimit() {
        insert(30, "tenant-a", "third", AREA, "{}");
        insert(10, "tenant-a", "first", AREA, "{}");
        insert(20, "tenant-a", "second", AREA, "{}");

        assertEquals(List.of(10, 20, 30), containing("tenant-a", 11, 21, 10));
        assertEquals(List.of(10), containing("tenant-a", 11, 21, 1));
        assertEquals(List.of(10, 20), containing("tenant-a", 11, 21, 2));
        assertTrue(containing("tenant-a", 11, 21, 0).isEmpty());
    }

    @Test
    void excludesOnlyAreasThatCanMoveWithTheirOwningLocation() {
        String location = "11111111-1111-1111-1111-111111111111";
        String owned = "{\"created_by\":\"miot-trips\",\"location_id\":\"" + location + "\"}";
        insert(1, "tenant-a", location, AREA, owned);
        insert(2, "tenant-a", "shared", AREA, owned);
        insert(3, "tenant-a", "external", AREA, "{}");
        insert(4, "tenant-a", "no-properties", AREA, null);
        String external = "22222222-2222-2222-2222-222222222222";
        insert(5, "tenant-a", external, AREA,
                "{\"created_by\":\"other-system\",\"location_id\":\"" + external + "\"}");
        insert(6, "tenant-a", "no-owner", AREA, "{\"created_by\":\"miot-trips\"}");

        assertEquals(List.of(2, 3, 4, 5, 6), containing("tenant-a", 11, 21, 10));
    }
}
