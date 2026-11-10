package com.microboxlabs.miot.places.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.gps.PlacesTestGpsDatabase;
import com.microboxlabs.miot.places.store.PgPlaceStore;
import com.microboxlabs.miot.places.store.PlaceStore.Place;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.time.Duration;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Exercises production delete SQL and cross-connection locking on scratch PostgreSQL, without PostGIS. */
@EnabledIfSystemProperty(named = "miot.places.test.pg-url", matches = ".+")
class PlacesSyncDatabaseTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private Vertx vertx;
    private Pool pool;
    private String schema;
    private StreamHubPlaceSync sync;

    @BeforeEach
    void setup() {
        vertx = Vertx.vertx();
        schema = "cert_sync_" + UUID.randomUUID().toString().replace("-", "");
        PgConnectOptions options = PgConnectOptions.fromUri(System.getProperty("miot.places.test.pg-url"))
                .setProperties(Map.of("search_path", schema + ",public"));
        pool = PgBuilder.pool().connectingTo(options).with(new PoolOptions().setMaxSize(2)).using(vertx).build();
        pool.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
        pool.query("CREATE TABLE geofences (client_id TEXT, client_geofence_id TEXT, properties JSONB,"
                + " UNIQUE(client_id, client_geofence_id))").execute().await().atMost(TIMEOUT);
        sync = new StreamHubPlaceSync(PlacesTestGpsDatabase.writing(pool), true);
    }

    @AfterEach
    void cleanup() {
        if (pool != null) {
            pool.query("DROP SCHEMA IF EXISTS " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            pool.closeAndAwait();
        }
        if (vertx != null) vertx.closeAndAwait();
    }

    private static Place place(String tenant, String code) {
        return new Place(UUID.randomUUID(), tenant, "geofence", null, code, "Example", null, null, null,
                null, "{}", "{}", null, null, null, null, null, null, null);
    }

    private void insert(String tenant, String code, String properties) {
        pool.preparedQuery("INSERT INTO geofences VALUES ($1, $2, $3::text::jsonb)")
                .execute(Tuple.of(tenant, code, properties)).await().atMost(TIMEOUT);
    }

    private long count() {
        return pool.query("SELECT count(*) FROM geofences").execute().await().atMost(TIMEOUT)
                .iterator().next().getLong(0);
    }

    @Test
    void deletingAnUnsyncedPlaceNeverDeletesALegacyGeofence() {
        for (String properties : new String[] {null, "{}", "{\"created_by\":\"legacy\"}",
                "{\"created_by\":\"miot-trips\"}", "{\"created_by\":\"miot-places\"}"}) {
            Place source = place("client-a", UUID.randomUUID().toString());
            insert(source.tenantCode(), source.externalCode(), properties);
            sync.deleted(source.tenantCode(), source.externalCode(), source);
        }
        assertEquals(5, count());
    }

    @Test
    void deleteMatchesTheTenantCodeAndSourceIdAndIsIdempotent() {
        Place source = place("client-a", "SHARED");
        String owned = "{\"created_by\":\"miot-places\",\"miot_place_id\":\"" + source.id() + "\"}";
        insert("client-a", "SHARED", owned);
        insert("client-b", "SHARED", owned);
        insert("client-a", "OTHER", owned);
        sync.deleted("client-a", "SHARED", source);
        sync.deleted("client-a", "SHARED", source);
        assertEquals(2, count());
    }

    @Test
    void anOldDeleteCannotRemoveANewerOwnersGeofence() {
        Place previous = place("client-a", "SHARED");
        Place current = place("client-a", "SHARED");
        insert("client-a", "SHARED", "{\"created_by\":\"miot-places\",\"miot_place_id\":\"" + current.id() + "\"}");
        sync.deleted("client-a", "SHARED", previous);
        assertEquals(1, count());
        sync.deleted("client-a", "SHARED", current);
        assertEquals(0, count());
    }

    @Test
    void mismatchedTenantOrCodeNeverReachesTheGpsDatabase() {
        Place source = place("client-a", "SHARED");
        assertThrows(IllegalArgumentException.class, () -> sync.saved("client-b", "SHARED", source));
        assertThrows(IllegalArgumentException.class, () -> sync.deleted("client-b", "SHARED", source));
        assertThrows(IllegalArgumentException.class, () -> sync.deleted("client-a", "OTHER", source));
    }

    @Test
    void replicasCannotEnterTheWriterTogetherAndTheLockIsReleasedOnFailure() {
        PgPlaceStore api = new PgPlaceStore(() -> pool);
        PgPlaceStore replica = new PgPlaceStore(() -> pool);
        assertEquals(Optional.of(1), api.syncExclusively(() -> {
            assertTrue(replica.syncExclusively(() -> 2).isEmpty());
            return 1;
        }));
        assertEquals(Optional.of(2), replica.syncExclusively(() -> 2));
        assertThrows(IllegalStateException.class, () -> api.syncExclusively(() -> {
            throw new IllegalStateException("GPS unavailable");
        }));
        assertEquals(Optional.of(3), replica.syncExclusively(() -> 3));
    }
}
