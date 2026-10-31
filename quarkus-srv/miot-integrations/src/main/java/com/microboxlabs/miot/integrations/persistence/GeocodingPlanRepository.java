package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.SourceUse;
import com.microboxlabs.miot.integrations.dto.GeocodingPlanDtos.Subscription;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import java.util.Map;
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
            "monthly_price_usd, resolutions_per_month, overage_price_usd, alert_pct, enforced, updated_by, updated_at, whatsapp_recipients";

    private static final String PLAN = "SELECT " + PLAN_COLUMNS + " FROM miot_integrations.geocoding_plan WHERE id = 1";

    private static final String SET_PLAN = """
            UPDATE miot_integrations.geocoding_plan
               SET monthly_price_usd = $1, resolutions_per_month = $2, overage_price_usd = $3, alert_pct = $4,
                   enforced = $5, updated_by = $6, whatsapp_recipients = $7, updated_at = now()
             WHERE id = 1
            RETURNING\s""" + PLAN_COLUMNS;

    private static final String SUBSCRIPTION = """
            SELECT monthly_quota, on_exhausted, updated_by, updated_at, whatsapp_recipients
              FROM miot_integrations.geocoding_subscriptions WHERE organization = $1""";

    private static final String UPSERT_SUBSCRIPTION = """
            INSERT INTO miot_integrations.geocoding_subscriptions (organization, monthly_quota, on_exhausted, updated_by, whatsapp_recipients)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (organization) DO UPDATE
                SET monthly_quota = EXCLUDED.monthly_quota,
                    on_exhausted = EXCLUDED.on_exhausted,
                    updated_by = EXCLUDED.updated_by,
                    whatsapp_recipients = EXCLUDED.whatsapp_recipients,
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
            SELECT organization FROM (
                SELECT DISTINCT ON (organization) organization, active
                  FROM miot_integrations.geocoding_billing_history
                 WHERE kind = 'subscription' AND effective_at < $2
                 ORDER BY organization, effective_at DESC, version_id DESC
            ) versions WHERE active
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

    /** Latest known terms before the period end; null when no historical terms are available. */
    public Plan planAt(OffsetDateTime periodEnd) {
        var rows = execute("""
                SELECT terms.* FROM (
                    SELECT snapshot, active FROM miot_integrations.geocoding_billing_history
                     WHERE kind = 'plan' AND effective_at < $1
                     ORDER BY effective_at DESC, version_id DESC LIMIT 1
                ) version CROSS JOIN LATERAL jsonb_populate_record(
                    NULL::miot_integrations.geocoding_plan, version.snapshot) terms
                WHERE version.active""", Tuple.of(periodEnd));
        return rows.iterator().hasNext() ? mapPlan(rows.iterator().next()) : null;
    }

    public Subscription subscriptionAt(String organization, OffsetDateTime periodEnd) {
        var rows = execute("""
                SELECT terms.* FROM (
                    SELECT snapshot, active FROM miot_integrations.geocoding_billing_history
                     WHERE kind = 'subscription' AND organization = $1 AND effective_at < $2
                     ORDER BY effective_at DESC, version_id DESC LIMIT 1
                ) version CROSS JOIN LATERAL jsonb_populate_record(
                    NULL::miot_integrations.geocoding_subscriptions, version.snapshot) terms
                WHERE version.active""", Tuple.of(organization, periodEnd));
        return rows.iterator().hasNext() ? mapSubscription(rows.iterator().next()) : null;
    }

    public Plan setPlan(BigDecimal monthlyPriceUsd, int resolutionsPerMonth, BigDecimal overagePriceUsd,
                        int alertPct, boolean enforced, String actor) {
        return setPlan(monthlyPriceUsd, resolutionsPerMonth, overagePriceUsd, alertPct, enforced, actor,
                plan().whatsAppRecipients());
    }

    public Plan setPlan(BigDecimal monthlyPriceUsd, int resolutionsPerMonth, BigDecimal overagePriceUsd,
            int alertPct, boolean enforced, String actor, List<String> recipients) {
        Tuple params = Tuple.tuple()
                .addValue(Numeric.create(monthlyPriceUsd))
                .addInteger(resolutionsPerMonth)
                .addValue(Numeric.create(overagePriceUsd))
                .addInteger(alertPct)
                .addBoolean(enforced)
                .addString(actor).addArrayOfString(recipients.toArray(String[]::new));
        return mapPlan(execute(SET_PLAN, params).iterator().next());
    }

    /** Null when the organization has no subscription. */
    public Subscription subscription(String organization) {
        RowSet<Row> rows = execute(SUBSCRIPTION, Tuple.of(organization));
        if (!rows.iterator().hasNext()) {
            return null;
        }
        return mapSubscription(rows.iterator().next());
    }

    private static Subscription mapSubscription(Row row) {
        return new Subscription(row.getInteger("monthly_quota"), row.getString("on_exhausted"),
                row.getString("updated_by"), row.getOffsetDateTime("updated_at"), recipients(row));
    }

    public void saveSubscription(String organization, Integer monthlyQuota, String onExhausted, String actor) {
        Subscription current = subscription(organization);
        saveSubscription(organization, monthlyQuota, onExhausted, actor,
                current == null ? List.of() : current.whatsAppRecipients());
    }

    public void saveSubscription(String organization, Integer monthlyQuota, String onExhausted, String actor,
            List<String> recipients) {
        Tuple params = Tuple.tuple().addString(organization).addInteger(monthlyQuota).addString(onExhausted)
                .addString(actor).addArrayOfString(recipients.toArray(String[]::new));
        execute(UPSERT_SUBSCRIPTION, params);
    }

    /** True for the one caller that marks the month as alerted; false when it already was, or no subscription. */
    public boolean claimAlert(String organization, LocalDate month) {
        return execute(CLAIM_ALERT, Tuple.of(organization, month)).iterator().hasNext();
    }

    public boolean notificationClaimed(String organization, LocalDate month, String level) {
        return execute("""
                SELECT 1 FROM miot_integrations.geocoding_quota_alerts
                 WHERE organization = $1 AND month = $2 AND level = $3""", Tuple.of(organization, month, level))
                .iterator().hasNext();
    }

    /** The claim and ledger insert commit together; a failed enqueue consumes no monthly level. */
    public boolean claimNotification(String organization, LocalDate month, String level, String tenantCode,
            String dedupeKey, Map<String, Object> payload) {
        return execute("""
                WITH claimed AS (
                    INSERT INTO miot_integrations.geocoding_quota_alerts (organization, month, level)
                    SELECT $1, $2, $3 WHERE EXISTS (
                        SELECT 1 FROM miot_integrations.geocoding_subscriptions WHERE organization = $1)
                    ON CONFLICT DO NOTHING RETURNING organization
                )
                INSERT INTO miot_integrations.async_jobs
                    (tenant_code, source_instance, executor, job_type, correlation_key, dedupe_key, payload)
                SELECT $4, 'geocoding', 'modulith', 'geocoding_quota_notification', $1, $5, $6::jsonb FROM claimed
                ON CONFLICT (tenant_code, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
                RETURNING id""", Tuple.of(organization, month, level, tenantCode, dedupeKey, new JsonObject(payload)))
                .iterator().hasNext();
    }

    private static List<String> recipients(Row row) {
        String[] values = row.getArrayOfStrings("whatsapp_recipients");
        return values == null ? List.of() : List.of(values);
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
                Boolean.TRUE.equals(row.getBoolean("enforced")),
                row.getString("updated_by"),
                row.getOffsetDateTime("updated_at"), recipients(row));
    }

    protected RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = clientInstance.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }
}
