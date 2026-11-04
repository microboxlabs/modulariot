package com.microboxlabs.miot.integrations.telephony;

import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Plan;
import com.microboxlabs.miot.integrations.telephony.TelephonyPlanDtos.Subscription;
import io.quarkus.arc.properties.IfBuildProperty;
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
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link TelephonyUsageStore} on {@code miot_integrations}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class PgTelephonyUsageStore implements TelephonyUsageStore {

    private static final Duration TIMEOUT = Duration.ofSeconds(10);
    private static final String T = "miot_integrations.telephony_usage";
    private static final String COLUMNS = """
            id, tenant_code, channel, managed, connection_id, external_id, case_ref, callee_number, destination_type,
            status, answered_at, seconds, billed_minutes, provider_cost, provider_currency, source, started_at,
            ended_at, confirmed_at""";

    private static final String INSERT = "INSERT INTO " + T + " (" + COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
            ON CONFLICT DO NOTHING""";
    private static final String UPDATE = "UPDATE " + T + """
             SET tenant_code = $2, channel = $3, managed = $4, connection_id = $5, external_id = $6, case_ref = $7,
                 callee_number = $8, destination_type = $9, status = $10, answered_at = $11, seconds = $12,
                 billed_minutes = $13, provider_cost = $14, provider_currency = $15, source = $16, started_at = $17,
                 ended_at = $18, confirmed_at = $19
             WHERE id = $1""";
    private static final String FIND = "SELECT " + COLUMNS + " FROM " + T + " WHERE id = $1";
    private static final String FIND_EXTERNAL = "SELECT " + COLUMNS + " FROM " + T
            + " WHERE channel = $1 AND external_id = $2";
    private static final String BUSY = "SELECT count(*) AS n FROM " + T
            + " WHERE connection_id = $1 AND started_at > $2 AND ended_at IS NULL AND status IN ('STARTED', 'ENDED')";
    private static final String EXPIRE = "UPDATE " + T
            + " SET status = 'EXPIRED' WHERE status = 'STARTED' AND started_at < $1";
    private static final String LATEST_CALLER = "SELECT tenant_code FROM " + T + """
             WHERE managed AND channel = 'VOICE' AND regexp_replace(callee_number, '\\D', '', 'g') = $1
               AND started_at > $2
             ORDER BY started_at DESC LIMIT 1""";
    private static final String BILLED = "SELECT coalesce(sum(billed_minutes), 0) AS m FROM " + T + """
             WHERE tenant_code = $1 AND managed AND channel = 'VOICE' AND status = 'CONFIRMED'
               AND started_at >= $2 AND started_at < $3""";
    private static final String ROWS = "SELECT " + COLUMNS + " FROM " + T
            + " WHERE tenant_code = $1 AND managed AND started_at >= $2 AND started_at < $3 ORDER BY started_at";
    private static final String TENANTS = "SELECT tenant_code FROM " + T + """
             WHERE managed AND started_at >= $1 AND started_at < $2
            UNION SELECT tenant_code FROM miot_integrations.telephony_subscriptions
            ORDER BY 1""";
    private static final String SAVE_CREDENTIAL = """
            INSERT INTO miot_integrations.telephony_operator_credentials
                (sip_username, tenant_code, credential_id, connection_id)
            VALUES ($1, $2, $3, $4) ON CONFLICT (sip_username) DO NOTHING""";
    private static final String TENANT_OF_SIP =
            "SELECT tenant_code FROM miot_integrations.telephony_operator_credentials WHERE sip_username = $1";
    private static final String PLAN_COLUMNS = """
            minutes_per_month, price_cl_mobile_usd, price_cl_landline_usd, price_other_usd, price_whatsapp_call_usd,
            price_whatsapp_template_usd, enforced, updated_by, updated_at""";
    private static final String PLAN = "SELECT " + PLAN_COLUMNS + " FROM miot_integrations.telephony_plan WHERE id = 1";
    private static final String SET_PLAN = """
            UPDATE miot_integrations.telephony_plan
               SET minutes_per_month = $1, price_cl_mobile_usd = $2, price_cl_landline_usd = $3, price_other_usd = $4,
                   price_whatsapp_call_usd = $5, price_whatsapp_template_usd = $6, enforced = $7, updated_by = $8,
                   updated_at = now()
             WHERE id = 1
            RETURNING\s""" + PLAN_COLUMNS;
    private static final String SUBSCRIPTION = """
            SELECT monthly_minutes, updated_by, updated_at FROM miot_integrations.telephony_subscriptions
             WHERE tenant_code = $1""";
    private static final String SAVE_SUBSCRIPTION = """
            INSERT INTO miot_integrations.telephony_subscriptions (tenant_code, monthly_minutes, updated_by)
            VALUES ($1, $2, $3)
            ON CONFLICT (tenant_code) DO UPDATE SET monthly_minutes = EXCLUDED.monthly_minutes,
                updated_by = EXCLUDED.updated_by, updated_at = now()""";

    private final Supplier<Pool> pool;

    @Inject
    public PgTelephonyUsageStore(Instance<Pool> pool) {
        this.pool = pool::get;
    }

    @Override
    public void insert(UsageRow r) {
        run(INSERT, params(r));
    }

    @Override
    public Optional<UsageRow> find(String id) {
        UUID uuid = uuid(id);
        return uuid == null ? Optional.empty() : first(run(FIND, Tuple.of(uuid)));
    }

    @Override
    public Optional<UsageRow> findByExternal(String channel, String externalId) {
        return first(run(FIND_EXTERNAL, Tuple.of(channel, externalId)));
    }

    @Override
    public void update(UsageRow r) {
        run(UPDATE, params(r));
    }

    @Override
    public int busyChannels(String connectionId, Instant since) {
        return run(BUSY, Tuple.of(connectionId, utc(since))).iterator().next().getLong("n").intValue();
    }

    @Override
    public int expireStarted(Instant before) {
        return run(EXPIRE, Tuple.of(utc(before))).rowCount();
    }

    @Override
    public Optional<String> latestCallerTenant(String calleeDigits, Instant since) {
        var it = run(LATEST_CALLER, Tuple.of(calleeDigits, utc(since))).iterator();
        return it.hasNext() ? Optional.of(it.next().getString("tenant_code")) : Optional.empty();
    }

    @Override
    public long billedMinutes(String tenantCode, Instant from, Instant to) {
        return run(BILLED, Tuple.of(tenantCode, utc(from), utc(to))).iterator().next().getLong("m");
    }

    @Override
    public List<UsageRow> rows(String tenantCode, Instant from, Instant to) {
        List<UsageRow> out = new ArrayList<>();
        run(ROWS, Tuple.of(tenantCode, utc(from), utc(to))).forEach(r -> out.add(row(r)));
        return out;
    }

    @Override
    public List<String> tenants(Instant from, Instant to) {
        List<String> out = new ArrayList<>();
        run(TENANTS, Tuple.of(utc(from), utc(to))).forEach(r -> out.add(r.getString("tenant_code")));
        return out;
    }

    @Override
    public void saveCredential(String sipUsername, String tenantCode, String credentialId, String connectionId) {
        run(SAVE_CREDENTIAL, Tuple.of(sipUsername, tenantCode, credentialId, connectionId));
    }

    @Override
    public Optional<String> tenantOfSip(String sipUsername) {
        var it = run(TENANT_OF_SIP, Tuple.of(sipUsername)).iterator();
        return it.hasNext() ? Optional.of(it.next().getString("tenant_code")) : Optional.empty();
    }

    @Override
    public Plan plan() {
        return plan(run(PLAN, Tuple.tuple()).iterator().next());
    }

    @Override
    public Plan setPlan(Plan p, String actor) {
        Tuple t = Tuple.tuple().addInteger(p.minutesPerMonth()).addValue(num(p.clMobileUsd()))
                .addValue(num(p.clLandlineUsd())).addValue(num(p.otherUsd())).addValue(num(p.whatsappCallUsd()))
                .addValue(num(p.whatsappTemplateUsd())).addBoolean(p.enforced()).addString(actor);
        return plan(run(SET_PLAN, t).iterator().next());
    }

    @Override
    public Optional<Subscription> subscription(String tenantCode) {
        var it = run(SUBSCRIPTION, Tuple.of(tenantCode)).iterator();
        if (!it.hasNext()) {
            return Optional.empty();
        }
        Row r = it.next();
        return Optional.of(new Subscription(r.getInteger("monthly_minutes"), r.getString("updated_by"),
                instant(r.getOffsetDateTime("updated_at"))));
    }

    @Override
    public void saveSubscription(String tenantCode, Integer monthlyMinutes, String actor) {
        run(SAVE_SUBSCRIPTION, Tuple.tuple().addString(tenantCode).addInteger(monthlyMinutes).addString(actor));
    }

    private RowSet<Row> run(String sql, Tuple params) {
        return pool.get().preparedQuery(sql).execute(params).await().atMost(TIMEOUT);
    }

    private static Optional<UsageRow> first(RowSet<Row> rows) {
        var it = rows.iterator();
        return it.hasNext() ? Optional.of(row(it.next())) : Optional.empty();
    }

    private static Tuple params(UsageRow r) {
        return Tuple.tuple().addUUID(UUID.fromString(r.id())).addString(r.tenantCode()).addString(r.channel())
                .addBoolean(r.managed()).addString(r.connectionId()).addString(r.externalId()).addString(r.caseRef())
                .addString(r.calleeNumber()).addString(r.destinationType()).addString(r.status())
                .addOffsetDateTime(utc(r.answeredAt())).addInteger(r.seconds()).addInteger(r.billedMinutes())
                .addValue(num(r.providerCost())).addString(r.providerCurrency()).addString(r.source())
                .addOffsetDateTime(utc(r.startedAt())).addOffsetDateTime(utc(r.endedAt()))
                .addOffsetDateTime(utc(r.confirmedAt()));
    }

    private static UsageRow row(Row r) {
        return new UsageRow(r.getUUID("id").toString(), r.getString("tenant_code"), r.getString("channel"),
                r.getBoolean("managed"), r.getString("connection_id"), r.getString("external_id"),
                r.getString("case_ref"), r.getString("callee_number"), r.getString("destination_type"),
                r.getString("status"), instant(r.getOffsetDateTime("answered_at")), r.getInteger("seconds"),
                r.getInteger("billed_minutes"), decimal(r, "provider_cost"), r.getString("provider_currency"),
                r.getString("source"), instant(r.getOffsetDateTime("started_at")),
                instant(r.getOffsetDateTime("ended_at")), instant(r.getOffsetDateTime("confirmed_at")));
    }

    private static Plan plan(Row r) {
        return new Plan(r.getInteger("minutes_per_month"), decimal(r, "price_cl_mobile_usd"),
                decimal(r, "price_cl_landline_usd"), decimal(r, "price_other_usd"),
                decimal(r, "price_whatsapp_call_usd"), decimal(r, "price_whatsapp_template_usd"),
                r.getBoolean("enforced"), r.getString("updated_by"), instant(r.getOffsetDateTime("updated_at")));
    }

    private static BigDecimal decimal(Row r, String column) {
        Numeric n = r.get(Numeric.class, column);
        return n == null ? null : n.bigDecimalValue();
    }

    private static Numeric num(BigDecimal value) {
        return value == null ? null : Numeric.create(value);
    }

    private static OffsetDateTime utc(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }

    private static UUID uuid(String id) {
        try {
            return id == null ? null : UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }
}
