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
import java.util.UUID;
import java.util.concurrent.CompletableFuture;
import java.util.stream.IntStream;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgGeocodingQuotaNotificationsTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(10);

    @Test
    void eachLevelOfAMonthIsClaimedOnceAndTheOldMonthAlertCarriesOver() throws Exception {
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
            var store = new GeocodingPlanRepository(null) {
                @Override
                protected RowSet<Row> execute(String sql, Tuple params) {
                    return pool.preparedQuery(sql.replace("miot_integrations", schema)).execute(params).await().atMost(TIMEOUT);
                }
            };
            assertFalse(store.claimLevel("example-org", LocalDate.of(2026, 9, 1), "threshold"));
            assertTrue(store.claimLevel("example-org", LocalDate.of(2026, 9, 1), "exhausted"));

            LocalDate month = LocalDate.of(2026, 10, 1);
            var claims = IntStream.range(0, 8).mapToObj(i -> CompletableFuture.supplyAsync(() ->
                    store.claimLevel("example-org", month, "threshold"))).toList();
            assertEquals(1, claims.stream().filter(CompletableFuture::join).count());
            assertTrue(store.claimLevel("example-org", month, "exhausted"));
            assertTrue(store.claimLevel("example-org", month.plusMonths(1), "threshold"));
            assertFalse(store.claimLevel("no-subscription", month, "threshold"));
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
