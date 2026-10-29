package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SourceUse;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Subscription;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.sqlclient.data.Numeric;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.LocalDate;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Storage for the geocoding plan, subscriptions and the usage that counts against them. Unit tests subclass it. */
@ApplicationScoped
public class GeocodingPlanRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final String PLAN_COLUMNS =
            "monthly_price_usd, resolutions_per_month, overage_price_usd, alert_pct, enforced, updated_by, updated_at";

    private static final String PLAN = "SELECT " + PLAN_COLUMNS + " FROM miot_integrations.geocoding_plan WHERE id = 1";

    private static final String SET_PLAN = """
            UPDATE miot_integrations.geocoding_plan
               SET monthly_price_usd = $1, resolutions_per_month = $2, overage_price_usd = $3, alert_pct = $4,
                   enforced = $5, updated_by = $6, updated_at = now()
             WHERE id = 1
            RETURNING\s""" + PLAN_COLUMNS;

    private static final String SUBSCRIPTION = """
            SELECT monthly_quota, on_exhausted, updated_by, updated_at
              FROM miot_integrations.geocoding_subscriptions WHERE organization = $1""";

    private static final String UPSERT_SUBSCRIPTION = """
            INSERT INTO miot_integrations.geocoding_subscriptions (organization, monthly_quota, on_exhausted, updated_by)
            VALUES ($1, $2, $3, $4)
            ON CONFLICT (organization) DO UPDATE
                SET monthly_quota = EXCLUDED.monthly_quota,
                    on_exhausted = EXCLUDED.on_exhausted,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = now()""";

    /** Sets the month only when it is not already set, so one caller wins. */
    private static final String CLAIM_ALERT = """
            UPDATE miot_integrations.geocoding_subscriptions SET alerted_month = $2
             WHERE organization = $1 AND alerted_month IS DISTINCT FROM $2
            RETURNING organization""";

    private static final String PROVIDER_CALLS = """
            SELECT count(*) AS used FROM miot_integrations.geocode_usage
             WHERE organization = $1 AND provider_called AND recorded_at >= $2 AND recorded_at < $3""";

    private static final String BY_SOURCE = """
            SELECT coalesce(source, 'none') AS source, result,
                   count(*) AS resolutions,
                   count(*) FILTER (WHERE cache_hit) AS cache_hits,
                   count(*) FILTER (WHERE provider_called) AS provider_calls,
                   sum(cost_usd) AS cost_usd
              FROM miot_integrations.geocode_usage
             WHERE organization = $1 AND recorded_at >= $2 AND recorded_at < $3
             GROUP BY 1, 2 ORDER BY 1, 2""";

    private static final String ORGANIZATIONS = """
            SELECT organization FROM miot_integrations.geocoding_subscriptions
            UNION
            SELECT DISTINCT organization FROM miot_integrations.geocode_usage
             WHERE organization IS NOT NULL AND recorded_at >= $1 AND recorded_at < $2
            ORDER BY 1""";

    private final Instance<Pool> clientInstance;

    @Inject
    public GeocodingPlanRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Plan plan() {
        return mapPlan(execute(PLAN, Tuple.tuple()).iterator().next());
    }

    public Plan setPlan(BigDecimal monthlyPriceUsd, int resolutionsPerMonth, BigDecimal overagePriceUsd,
                        int alertPct, boolean enforced, String actor) {
        Tuple params = Tuple.tuple()
                .addValue(Numeric.create(monthlyPriceUsd))
                .addInteger(resolutionsPerMonth)
                .addValue(Numeric.create(overagePriceUsd))
                .addInteger(alertPct)
                .addBoolean(enforced)
                .addString(actor);
        return mapPlan(execute(SET_PLAN, params).iterator().next());
    }

    /** Null when the organization has no subscription. */
    public Subscription subscription(String organization) {
        RowSet<Row> rows = execute(SUBSCRIPTION, Tuple.of(organization));
        if (!rows.iterator().hasNext()) {
            return null;
        }
        Row row = rows.iterator().next();
        return new Subscription(row.getInteger("monthly_quota"), row.getString("on_exhausted"),
                row.getString("updated_by"), row.getOffsetDateTime("updated_at"));
    }

    public void saveSubscription(String organization, Integer monthlyQuota, String onExhausted, String actor) {
        Tuple params = Tuple.tuple().addString(organization).addInteger(monthlyQuota).addString(onExhausted)
                .addString(actor);
        execute(UPSERT_SUBSCRIPTION, params);
    }

    /** True for the one caller that marks the month as alerted; false when it already was, or no subscription. */
    public boolean claimAlert(String organization, LocalDate month) {
        return execute(CLAIM_ALERT, Tuple.of(organization, month)).iterator().hasNext();
    }

    public long providerCalls(String organization, OffsetDateTime from, OffsetDateTime to) {
        return execute(PROVIDER_CALLS, Tuple.of(organization, from, to)).iterator().next().getLong("used");
    }

    public List<SourceUse> bySource(String organization, OffsetDateTime from, OffsetDateTime to) {
        List<SourceUse> out = new ArrayList<>();
        for (Row row : execute(BY_SOURCE, Tuple.of(organization, from, to))) {
            out.add(new SourceUse(row.getString("source"), row.getString("result"), row.getLong("resolutions"),
                    row.getLong("cache_hits"), row.getLong("provider_calls"), row.getBigDecimal("cost_usd")));
        }
        return out;
    }

    /** Organizations with a subscription or with usage in the period. */
    public List<String> organizations(OffsetDateTime from, OffsetDateTime to) {
        List<String> out = new ArrayList<>();
        for (Row row : execute(ORGANIZATIONS, Tuple.of(from, to))) {
            out.add(row.getString("organization"));
        }
        return out;
    }

    private static Plan mapPlan(Row row) {
        return new Plan(
                row.getBigDecimal("monthly_price_usd"),
                row.getInteger("resolutions_per_month"),
                row.getBigDecimal("overage_price_usd"),
                row.getInteger("alert_pct"),
                row.getBoolean("enforced"),
                row.getString("updated_by"),
                row.getOffsetDateTime("updated_at"));
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = clientInstance.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }
}
