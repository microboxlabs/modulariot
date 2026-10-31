package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.*;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgGeocodingQuotaNotificationsTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    @Test
    void migrationClaimsEachLevelAndMonthOnceAndRollsBackAFailedEnqueue() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(4)).using(vertx).build();
        String schema = "cert_quota_" + UUID.randomUUID().toString().replace("-", "");
        try {
            pool.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
            for (String filename : List.of("V0.6.33__create_geocode_usage.sql", "V0.6.34__create_geocoding_plan.sql",
                    "V0.6.35__geocoding_plan_enforced.sql", "V0.6.36__geocoding_billing_history.sql")) {
                migrate(pool, schema, filename);
            }
            pool.query("INSERT INTO " + schema + ".geocoding_subscriptions (organization, alerted_month) "
                    + "VALUES ('example-org', '2026-09-01')").execute().await().atMost(TIMEOUT);
            migrate(pool, schema, "V0.6.37__geocoding_quota_notifications.sql");
            // Only the ledger columns the atomic insert writes; this fixture needs no miot_core schema.
            pool.query("CREATE TABLE " + schema + ".async_jobs (id uuid DEFAULT gen_random_uuid(), "
                    + "tenant_code text, source_instance text, executor text, job_type text, correlation_key text, "
                    + "dedupe_key text, payload jsonb); CREATE UNIQUE INDEX ON " + schema
                    + ".async_jobs (tenant_code, dedupe_key) WHERE dedupe_key IS NOT NULL")
                    .execute().await().atMost(TIMEOUT);
            var store = new GeocodingPlanRepository(null) {
                protected RowSet<Row> execute(String sql, Tuple params) {
                    return pool.preparedQuery(sql.replace("miot_integrations", schema)).execute(params).await().atMost(TIMEOUT);
                }
            };
            assertTrue(store.notificationClaimed("example-org", LocalDate.of(2026, 9, 1), "threshold"));
            assertFalse(store.notificationClaimed("example-org", LocalDate.of(2026, 9, 1), "exhausted"));
            LocalDate month = LocalDate.of(2026, 10, 1);
            var claims = java.util.stream.IntStream.range(0, 8).mapToObj(i -> CompletableFuture.supplyAsync(() ->
                    store.claimNotification("example-org", month, "threshold", "tenant-1", "oct-threshold", Map.of())))
                    .toList();
            assertEquals(1, claims.stream().filter(CompletableFuture::join).count());
            assertTrue(store.claimNotification("example-org", month, "exhausted", "tenant-1", "oct-exhausted", Map.of()));
            assertTrue(store.claimNotification("example-org", month.plusMonths(1), "threshold", "tenant-1", "nov-threshold", Map.of()));
            pool.query("ALTER TABLE " + schema + ".async_jobs ADD CHECK (job_type <> 'geocoding_quota_notification') NOT VALID")
                    .execute().await().atMost(TIMEOUT);
            assertThrows(RuntimeException.class, () -> store.claimNotification("example-org", month.plusMonths(1),
                    "exhausted", "tenant-1", "nov-exhausted", Map.of()));
            assertFalse(store.notificationClaimed("example-org", month.plusMonths(1), "exhausted"));
        } finally {
            pool.query("DROP SCHEMA " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            pool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }

    private void migrate(Pool pool, String schema, String filename) throws Exception {
        try (var resource = getClass().getResourceAsStream("/db/migration/integrations/" + filename)) {
            assertNotNull(resource);
            pool.query(new String(resource.readAllBytes(), StandardCharsets.UTF_8).replace("miot_integrations", schema))
                    .execute().await().atMost(TIMEOUT);
        }
    }
}
