package com.microboxlabs.miot.fleet.sharing;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.pgclient.PgConnectOptions;
import java.io.IOException;
import java.io.InputStream;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.List;
import java.util.UUID;
import org.junit.jupiter.api.AfterAll;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * {@link PgShareStore} against a real database: a scratch database that this test owns. Runs only with
 * {@code -Dmiot.fleet.test.pg-url=postgresql://user:password@host:port/db}; it drops and recreates the
 * {@code miot_fleet} share tables there.
 */
@EnabledIfSystemProperty(named = PgShareStoreTest.URL_PROPERTY, matches = ".+")
class PgShareStoreTest {

    static final String URL_PROPERTY = "miot.fleet.test.pg-url";
    private static final Duration WAIT = Duration.ofSeconds(10);

    private static Vertx vertx;
    private static Pool pool;

    private final PgShareStore store = new PgShareStore(() -> pool);

    @BeforeAll
    static void setUp() throws IOException {
        vertx = Vertx.vertx();
        pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty(URL_PROPERTY)))
                .using(vertx).build();
        run("DROP SCHEMA IF EXISTS miot_fleet CASCADE");
        run("CREATE SCHEMA miot_fleet");
        try (InputStream in = PgShareStoreTest.class.getResourceAsStream(
                "/db/migration/fleet/V0.9.1__create_data_shares.sql")) {
            run(new String(in.readAllBytes(), StandardCharsets.UTF_8));
        }
    }

    @AfterAll
    static void tearDown() {
        run("DROP SCHEMA IF EXISTS miot_fleet CASCADE");
        pool.closeAndAwait();
        vertx.closeAndAwait();
    }

    private static void run(String sql) {
        pool.query(sql).execute().await().atMost(WAIT);
    }

    @Test
    void storesFilterListsAsJsonArrays() {
        Instant now = Instant.now().truncatedTo(ChronoUnit.MICROS);
        UUID filtered = UUID.randomUUID();
        UUID all = UUID.randomUUID();
        store.create(new DataShare(filtered, "sender", "receiver", DataShare.Scope.FILTER,
                new ShareFilter(List.of("Owner A"), List.of("truck")), List.of(), DataShare.Origin.MANUAL, now, null,
                null, "tester", now, null, null));
        store.create(new DataShare(all, "sender", "other", DataShare.Scope.ALL, ShareFilter.NONE, List.of(),
                DataShare.Origin.MANUAL, now, null, null, "tester", now, null, null));

        String types = pool.query("SELECT DISTINCT jsonb_typeof(owners) || ',' || jsonb_typeof(kinds) AS t "
                + "FROM miot_fleet.data_share").execute().await().atMost(WAIT).iterator().next().getString("t");
        assertEquals("array,array", types);
        DataShare read = store.all().stream().filter(s -> s.id().equals(filtered)).findFirst().orElseThrow();
        assertEquals(new ShareFilter(List.of("Owner A"), List.of("truck")), read.filter());
        assertEquals(2, store.all().size());
    }
}
