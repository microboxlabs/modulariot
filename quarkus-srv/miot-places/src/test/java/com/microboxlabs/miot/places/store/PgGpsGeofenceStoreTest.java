package com.microboxlabs.miot.places.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.core.gps.PlacesTestGpsDatabase;
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

/** The store's SQL on real PostgreSQL, in a scratch schema. PostGIS functions are explicit stubs. */
@EnabledIfSystemProperty(named = "miot.places.test.pg-url", matches = ".+")
class PgGpsGeofenceStoreTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(5);
    private static final String AREA = "{\"type\":\"Polygon\",\"coordinates\":[[[0,0],[2,0],[2,2],[0,0]]]}";
    private Vertx vertx;
    private Pool admin;
    private Pool writes;
    private Pool reads;
    private String schema;
    private GpsGeofenceStore store;

    private Pool pool(Map<String, String> properties) {
        PgConnectOptions options = PgConnectOptions.fromUri(System.getProperty("miot.places.test.pg-url"));
        options.setProperties(properties);
        return PgBuilder.pool().connectingTo(options).with(new PoolOptions().setMaxSize(2)).using(vertx).build();
    }

    private void sql(String statement) {
        writes.query(statement).execute().await().atMost(TIMEOUT);
    }

    private void geofence(String clientId, String code, String name, String properties) {
        writes.preparedQuery("INSERT INTO geofences (client_id, client_geofence_id, geofence_name, polygon_type,"
                + " coordinates, properties) VALUES ($1, $2, $3, 'polygonal', $4::text::jsonb, $5::text::jsonb)")
                .execute(Tuple.of(clientId, code, name, AREA, properties)).await().atMost(TIMEOUT);
    }

    @BeforeEach
    void setup() {
        vertx = Vertx.vertx();
        admin = pool(Map.of());
        schema = "cert_places_" + UUID.randomUUID().toString().replace("-", "");
        admin.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
        writes = pool(Map.of("search_path", schema));
        for (String statement : List.of(
                "CREATE DOMAIN geography AS jsonb", "CREATE DOMAIN geometry AS jsonb",
                "CREATE FUNCTION ST_AsGeoJSON(jsonb) RETURNS text LANGUAGE sql IMMUTABLE AS 'SELECT $1::text'",
                "CREATE TABLE geofences (geofence_id SERIAL PRIMARY KEY, client_id TEXT NOT NULL,"
                        + " client_geofence_id TEXT NOT NULL, geofence_name TEXT, coordinates geography,"
                        + " polygon_type TEXT, properties JSONB, UNIQUE(client_id, client_geofence_id))")) {
            sql(statement);
        }
        reads = pool(Map.of("search_path", schema, "default_transaction_read_only", "on"));
        store = new GpsGeofenceStore(PlacesTestGpsDatabase.reading(reads));
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
    void readsOnlyTheTenantsGeofencesByName() {
        geofence("acme-client", "B", "Bodega", "{\"address\":\"Ruta 5\"}");
        geofence("acme-client", "A", "Arica", null);
        geofence("other-client", "X", "Ajena", null);

        List<GeofenceStore.Geofence> out = store.list("acme-client", null, 10);
        assertEquals(List.of("Arica", "Bodega"), out.stream().map(GeofenceStore.Geofence::name).toList());
        assertEquals(AREA.replace(" ", ""), out.get(0).shapeGeojson().replace(" ", ""));
        assertNull(out.get(0).propertiesJson());
        assertEquals("Ruta 5", out.get(1).propertiesJson().replaceAll(".*\"address\": ?\"([^\"]+)\".*", "$1"));
    }

    @Test
    void searchesByNameOrCodeAndHonoursTheLimit() {
        geofence("acme-client", "SCL-01", "Santiago", null);
        geofence("acme-client", "ARI-01", "Arica", null);
        geofence("acme-client", "ARI-02", "Arica norte", null);

        assertEquals(List.of("SCL-01"),
                store.list("acme-client", "scl", 10).stream().map(GeofenceStore.Geofence::code).toList());
        assertEquals(List.of("Arica", "Arica norte"),
                store.list("acme-client", "arica", 10).stream().map(GeofenceStore.Geofence::name).toList());
        assertEquals(1, store.list("acme-client", null, 1).size());
    }

    @Test
    void theCategoryIsNullWithoutTheColumnAndReadWithIt() {
        geofence("acme-client", "A", "Arica", null);
        assertNull(store.list("acme-client", null, 10).get(0).category());

        sql("ALTER TABLE geofences ADD COLUMN geofence_category TEXT");
        sql("UPDATE geofences SET geofence_category = 'terminal'");
        assertEquals("terminal", store.list("acme-client", null, 10).get(0).category());
    }

    @Test
    void readsInAReadOnlySession() {
        assertThrows(RuntimeException.class, () -> reads.query("INSERT INTO geofences (client_id,"
                + " client_geofence_id) VALUES ('acme-client', 'Z')").execute().await().atMost(TIMEOUT));
    }
}
