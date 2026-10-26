package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.MonitorScope;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Validates existing scopes in a new migration while preserving the already-applied V0.10.22. */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgMonitorScopeValidationMigrationTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String MIGRATION = "/db/migration/trips/V0.10.23__validate_monitor_scopes.sql";
    private static final String TENANT = "scope-validation-test";
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

    private static void beforeValidation() throws IOException {
        PgTripsStoresTest.recreateSchemas(pool, PgTripsStoresTest.migrationsBefore(MIGRATION));
    }

    private static void published(String key, int version, MonitorScope scope) {
        pool.preparedQuery("""
                INSERT INTO miot_trips.trip_monitor
                    (tenant_code, monitor_key, version, status, name, created_by, scope)
                VALUES ($1, $2, $3, 'published', $2, 'test', $4::text::jsonb)
                """).execute(Tuple.of(TENANT, key, version, scope == null ? null : Pg.json(scope)))
                .await().atMost(WAIT);
    }

    private static List<TripMonitor> configuration() {
        return new PgMonitorStore(() -> pool).all(TENANT);
    }

    @Test
    void equalAndPartlyOverlappingScopesAbortWithoutChangingConfiguration() throws IOException {
        for (boolean feedOverlap : List.of(false, true)) {
            beforeValidation();
            MonitorScope orders = new MonitorScope(List.of(), List.of("order-a"), List.of(), List.of());
            MonitorScope first = feedOverlap
                    ? new MonitorScope(List.of("feed-a"), List.of(), List.of(), List.of()) : orders;
            published("first", 1, first);
            published("second", 1, orders);
            List<TripMonitor> before = configuration();

            RuntimeException failure = assertThrows(RuntimeException.class,
                    () -> PgTripsStoresTest.migrate(pool, MIGRATION));

            assertTrue(failure.getMessage().contains("equal or partly overlapping scopes"), failure.getMessage());
            assertEquals(before, configuration(), "a failed validation must not rewrite existing monitor versions");
            var schema = pool.query("""
                    SELECT to_regclass('miot_trips.trip_monitor_selector') IS NULL AS legacy_removed,
                           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'miot_trips'
                                    AND table_name = 'trip_monitor' AND column_name = 'scope') AS scope_retained
                    """).execute().await().atMost(WAIT).iterator().next();
            assertTrue(schema.getBoolean("legacy_removed"), "V0.10.22 remains applied");
            assertTrue(schema.getBoolean("scope_retained"));
        }
    }

    @Test
    void disjointAndNestedLatestScopesPassWithoutRewritingOlderVersions() throws IOException {
        beforeValidation();
        published("general", 1, MonitorScope.ANY);
        published("feed-a", 1, MonitorScope.ANY);
        published("feed-a", 2, new MonitorScope(List.of("feed-a"), List.of(), List.of(), List.of()));
        published("feed-a-destination", 1, new MonitorScope(List.of("feed-a"), List.of(), List.of(),
                List.of("00000000-0000-0000-0000-000000000001")));
        published("feed-b", 1, new MonitorScope(List.of("feed-b"), List.of(), List.of(), List.of()));
        published("unscoped", 1, null);
        List<TripMonitor> before = configuration();

        PgTripsStoresTest.migrate(pool, MIGRATION);

        assertEquals(before, configuration(), "only the latest published scope participates in validation");
    }
}
