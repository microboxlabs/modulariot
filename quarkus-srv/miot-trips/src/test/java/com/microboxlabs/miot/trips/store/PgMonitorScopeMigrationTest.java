package com.microboxlabs.miot.trips.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.trips.domain.MonitorScope;
import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.time.Duration;
import java.util.List;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** Backfills populated legacy profiles and selectors on a scratch database using the actual migrations. */
@EnabledIfSystemProperty(named = PgTripsStoresTest.URL_PROPERTY, matches = ".+")
class PgMonitorScopeMigrationTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String MIGRATION = "/db/migration/trips/V0.10.22__monitor_scope.sql";
    private static final String TENANT_A = "scope-test-a";
    private static final String TENANT_B = "scope-test-b";
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

    private static void run(String sql) {
        pool.query(sql).execute().await().atMost(WAIT);
    }

    private static MonitorScope scope(String tenant, String key, int version) {
        return new PgMonitorStore(() -> pool).version(tenant, key, version).orElseThrow().scope();
    }

    @Test
    void scopesPreserveFeedPrioritySupportedSelectorsVersionsAndTenantIsolation() throws IOException {
        PgTripsStoresTest.recreateSchemas(pool, PgTripsStoresTest.migrationsBefore(MIGRATION));
        run("""
                INSERT INTO miot_trips.trip_monitor (tenant_code, monitor_key, version, status, name, created_by)
                VALUES ('scope-test-a', 'from-feed', 1, 'published', 'Feed monitor', 'test'),
                       ('scope-test-a', 'from-feed', 2, 'draft', 'Feed draft', 'test'),
                       ('scope-test-b', 'from-feed', 1, 'published', 'Other tenant', 'test'),
                       ('scope-test-orders', 'from-orders', 1, 'published', 'Orders', 'test'),
                       ('scope-test-a', 'general', 1, 'published', 'General', 'test'),
                       ('scope-test-a', 'unsupported', 1, 'published', 'Unsupported', 'test');
                INSERT INTO miot_trips.feed_profile
                    (tenant_code, feed_key, name, stages, arrival_stage, monitor_key, created_by)
                VALUES ('scope-test-a', 'feed-a', 'Feed A', '[]', 'transit', 'from-feed', 'test'),
                       ('scope-test-b', 'feed-b', 'Feed B', '[]', 'transit', 'from-feed', 'test');
                INSERT INTO miot_trips.trip_monitor_selector (tenant_code, seq, condition, monitor_key)
                VALUES ('scope-test-a', 1, $$trip.orderType == 'order-a'$$, 'from-feed'),
                       ('scope-test-orders', 2, $$trip.orderType == 'order-b'$$, 'from-orders'),
                       ('scope-test-orders', 3, $$trip.orderType == 'order-a'$$, 'from-orders'),
                       ('scope-test-a', 4, $$ true $$, 'general'),
                       ('scope-test-a', 5, $$trip.origin.type == 'port'$$, 'unsupported')
                """);

        PgTripsStoresTest.migrate(pool, MIGRATION);

        MonitorScope feedA = new MonitorScope(List.of("feed-a"), null, null, null);
        assertEquals(feedA, scope(TENANT_A, "from-feed", 1), "feed assignment takes priority over the selector");
        assertEquals(feedA, scope(TENANT_A, "from-feed", 2), "draft and published versions are backfilled");
        assertEquals(new MonitorScope(List.of("feed-b"), null, null, null), scope(TENANT_B, "from-feed", 1));
        assertEquals(new MonitorScope(null, List.of("order-a", "order-b"), null, null),
                scope("scope-test-orders", "from-orders", 1));
        assertEquals(MonitorScope.ANY, scope(TENANT_A, "general", 1));
        assertNull(scope(TENANT_A, "unsupported", 1), "unsupported conditions must not become a catch-all");
        var shape = pool.query("""
                SELECT to_regclass('miot_trips.trip_monitor_selector') IS NULL AS selector_removed,
                       NOT EXISTS (SELECT 1 FROM information_schema.columns
                                    WHERE table_schema = 'miot_trips' AND table_name = 'feed_profile'
                                      AND column_name = 'monitor_key') AS feed_monitor_removed,
                       (SELECT count(*) FROM miot_trips.trip_monitor) AS monitors
                """).execute().await().atMost(WAIT).iterator().next();
        assertTrue(shape.getBoolean("selector_removed"));
        assertTrue(shape.getBoolean("feed_monitor_removed"));
        assertEquals(6L, shape.getLong("monitors"));
    }

    @Test
    void conflictingBackfillsAbortWithoutRemovingLegacyRouting() throws IOException {
        for (boolean feedOverlap : List.of(false, true)) {
            PgTripsStoresTest.recreateSchemas(pool, PgTripsStoresTest.migrationsBefore(MIGRATION));
            run("""
                    INSERT INTO miot_trips.trip_monitor (tenant_code, monitor_key, version, status, name, created_by)
                    VALUES ('scope-test-a', 'first', 1, 'published', 'First', 'test'),
                           ('scope-test-a', 'second', 1, 'published', 'Second', 'test');
                    INSERT INTO miot_trips.trip_monitor_selector (tenant_code, seq, condition, monitor_key)
                    VALUES ('scope-test-a', 1, $$trip.orderType == 'order-a'$$, 'first'),
                           ('scope-test-a', 2, $$trip.orderType == 'order-a'$$, 'second')
                    """);
            if (feedOverlap) {
                run("""
                        INSERT INTO miot_trips.feed_profile
                            (tenant_code, feed_key, name, stages, arrival_stage, monitor_key, created_by)
                        VALUES ('scope-test-a', 'feed-a', 'Feed A', '[]', 'transit', 'first', 'test')
                        """);
            }

            RuntimeException failure = assertThrows(RuntimeException.class,
                    () -> PgTripsStoresTest.migrate(pool, MIGRATION));
            assertTrue(failure.getMessage().contains("equal or partly overlapping scopes"), failure.getMessage());
            var legacy = pool.query("""
                    SELECT to_regclass('miot_trips.trip_monitor_selector') IS NOT NULL AS selector_retained,
                           EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'miot_trips'
                                    AND table_name = 'feed_profile' AND column_name = 'monitor_key') AS feed_retained,
                           NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'miot_trips'
                                    AND table_name = 'trip_monitor' AND column_name = 'scope') AS rolled_back
                    """).execute().await().atMost(WAIT).iterator().next();
            assertTrue(legacy.getBoolean("selector_retained"));
            assertTrue(legacy.getBoolean("feed_retained"));
            assertTrue(legacy.getBoolean("rolled_back"));
        }
    }
}
