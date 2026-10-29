package com.microboxlabs.miot.integrations.persistence;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.vertx.mutiny.core.Vertx;
import io.vertx.mutiny.pgclient.PgBuilder;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgConnectOptions;
import io.vertx.sqlclient.PoolOptions;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.UUID;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

@EnabledIfSystemProperty(named = "miot.integrations.test.pg-url", matches = ".+")
class PgGeocodingBillingHistoryTest {
    private static final Duration TIMEOUT = Duration.ofSeconds(5);

    @Test
    void migrationAndTriggersPreserveCompletedPeriodsAndSubscriptionStart() throws Exception {
        Vertx vertx = Vertx.vertx();
        Pool pool = PgBuilder.pool().connectingTo(PgConnectOptions.fromUri(System.getProperty("miot.integrations.test.pg-url")))
                .with(new PoolOptions().setMaxSize(1)).using(vertx).build();
        String schema = "cert_billing_" + UUID.randomUUID().toString().replace("-", "");
        try {
            pool.query("CREATE SCHEMA " + schema).execute().await().atMost(TIMEOUT);
            for (String migration : new String[]{"V0.6.33__create_geocode_usage.sql", "V0.6.34__create_geocoding_plan.sql"}) {
                migrate(pool, schema, migration);
            }
            pool.query(("UPDATE miot_integrations.geocoding_plan SET monthly_price_usd = 10, updated_at = '2020-01-01Z'; "
                    + "INSERT INTO miot_integrations.geocoding_subscriptions (organization, monthly_quota, on_exhausted, created_at, updated_at) "
                    + "VALUES ('synthetic-org', 1, 'overage', '2020-01-01Z', '2020-01-01Z')")
                    .replace("miot_integrations", schema)).execute().await().atMost(TIMEOUT);
            migrate(pool, schema, "V0.6.36__geocoding_billing_history.sql");
            GeocodingPlanRepository repository = new GeocodingPlanRepository(null) {
                @Override
                protected RowSet<Row> execute(String sql, Tuple params) {
                    return pool.preparedQuery(sql.replace("miot_integrations", schema)).execute(params).await().atMost(TIMEOUT);
                }
            };
            OffsetDateTime completedPeriodEnd = OffsetDateTime.parse("2020-10-01T00:00:00Z");
            var originalPlan = repository.planAt(completedPeriodEnd);
            var originalSubscription = repository.subscriptionAt("synthetic-org", completedPeriodEnd);
            assertNotNull(originalPlan);
            assertNotNull(originalSubscription);
            assertEquals(0, BigDecimal.TEN.compareTo(originalPlan.monthlyPriceUsd()));
            repository.setPlan(new BigDecimal("30"), 500, new BigDecimal("0.7"), 80, "synthetic-owner");
            repository.saveSubscription("synthetic-org", 80, "review", "synthetic-owner");
            repository.saveSubscription("synthetic-new", null, "overage", "synthetic-owner");
            assertEquals(originalPlan, repository.planAt(completedPeriodEnd));
            assertEquals(originalSubscription, repository.subscriptionAt("synthetic-org", completedPeriodEnd));
            assertNull(repository.subscriptionAt("synthetic-new", completedPeriodEnd));
            assertNull(repository.planAt(OffsetDateTime.parse("2019-01-01T00:00:00Z")));
            assertEquals(500, repository.plan().resolutionsPerMonth());
            assertEquals(80, repository.subscription("synthetic-org").monthlyQuota());
            assertEquals(java.util.List.of("synthetic-org"), repository.organizations(completedPeriodEnd.minusMonths(1), completedPeriodEnd));
            long count = historyCount(pool, schema);
            assertTrue(repository.claimAlert("synthetic-org", LocalDate.now().withDayOfMonth(1)));
            assertEquals(count, historyCount(pool, schema));
            pool.query("DELETE FROM " + schema + ".geocoding_subscriptions WHERE organization = 'synthetic-org'")
                    .execute().await().atMost(TIMEOUT);
            assertNull(repository.subscriptionAt("synthetic-org", OffsetDateTime.now().plusMinutes(1)));
            assertEquals(originalSubscription, repository.subscriptionAt("synthetic-org", completedPeriodEnd));
        } finally {
            pool.query("DROP SCHEMA " + schema + " CASCADE").execute().await().atMost(TIMEOUT);
            pool.closeAndAwait();
            vertx.closeAndAwait();
        }
    }

    private static long historyCount(Pool pool, String schema) {
        return pool.query("SELECT count(*) FROM " + schema + ".geocoding_billing_history")
                .execute().await().atMost(TIMEOUT).iterator().next().getLong(0);
    }

    private void migrate(Pool pool, String schema, String filename) throws Exception {
        try (var resource = getClass().getResourceAsStream("/db/migration/integrations/" + filename)) {
            assertNotNull(resource);
            String sql = new String(resource.readAllBytes(), StandardCharsets.UTF_8).replace("miot_integrations", schema);
            pool.query(sql).execute().await().atMost(TIMEOUT);
        }
    }
}
