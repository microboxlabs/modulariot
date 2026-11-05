package com.microboxlabs.miot.symptoms.store;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/** The contact sync watermark and lock against a real database. Skipped unless {@code -Dmiot.symptoms.test.pg-url=...}. */
@EnabledIfSystemProperty(named = PgTreatmentStoresTest.URL_PROPERTY, matches = ".+")
class PgContactSyncStoreTest {

    private static final Duration WAIT = Duration.ofSeconds(10);
    private static final String SOURCE = "fleet-driver";

    private static Vertx vertx;
    private static Pool pool;

    private final PgContactSyncStore store = new PgContactSyncStore(() -> pool);

    @BeforeAll
    static void migrate() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool()
                .connectingTo(PgConnectOptions.fromUri(System.getProperty(PgTreatmentStoresTest.URL_PROPERTY)))
                .using(vertx).build();
        pool.query("CREATE SCHEMA IF NOT EXISTS miot_symptoms").execute().await().atMost(WAIT);
        pool.query("DROP TABLE IF EXISTS miot_symptoms.contact_sync").execute().await().atMost(WAIT);
        try (InputStream in = PgContactSyncStoreTest.class
                .getResourceAsStream("/db/migration/symptoms/V0.12.12__contact_sync.sql")) {
            pool.query(new String(in.readAllBytes(), StandardCharsets.UTF_8)).execute().await().atMost(WAIT);
        }
    }

    @AfterAll
    static void close() {
        pool.close().await().atMost(WAIT);
        vertx.close().await().atMost(WAIT);
    }

    @Test
    void theWatermarkIsPerTenantAndSource() {
        String tenant = "t-" + UUID.randomUUID();
        OffsetDateTime first = OffsetDateTime.of(2026, 11, 1, 10, 0, 0, 123_000, ZoneOffset.UTC);

        assertTrue(store.syncedUntil(tenant, SOURCE).isEmpty());
        store.save(tenant, SOURCE, first);
        store.save(tenant, SOURCE, first.plusMinutes(5));

        assertEquals(first.plusMinutes(5), store.syncedUntil(tenant, SOURCE).orElseThrow());
        assertTrue(store.syncedUntil(tenant, "other").isEmpty());
        assertTrue(store.syncedUntil("t-" + UUID.randomUUID(), SOURCE).isEmpty());
        assertTrue(store.tenants(SOURCE).contains(tenant));
        assertTrue(store.tenants("other").isEmpty());
    }

    @Test
    void onlyOneHolderRunsAndTheLockIsReleasedAfter() {
        String name = "test:" + UUID.randomUUID();

        Optional<Optional<String>> nested = store.exclusively(name, () -> store.exclusively(name, () -> "inner"));
        Optional<String> again = store.exclusively(name, () -> "again");

        assertEquals(Optional.of(Optional.empty()), nested, "a second holder is turned away while the first runs");
        assertEquals(Optional.of("again"), again);
    }

    @Test
    void theLockIsReleasedWhenTheWorkFails() {
        String name = "test:" + UUID.randomUUID();
        try {
            store.exclusively(name, () -> {
                throw new IllegalStateException("boom");
            });
        } catch (IllegalStateException expected) {
            // the lock must still be free
        }
        assertEquals(Optional.of(1), store.exclusively(name, () -> 1));
    }
}
