package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Plan;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.PoolUse;
import com.microboxlabs.miot.integrations.dto.HarnessPlanDtos.Subscription;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.sqlclient.data.Numeric;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Storage for the seat plan, subscriptions and pool usage. Unit tests subclass it with no pool. */
@ApplicationScoped
public class HarnessPlanRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final String PLAN = """
            SELECT seat_price_usd, tokens_per_seat, yearly_discount_pct, updated_by, updated_at
              FROM miot_integrations.harness_plan WHERE id = 1""";

    private static final String SET_PLAN = """
            UPDATE miot_integrations.harness_plan
               SET seat_price_usd = $1, tokens_per_seat = $2, yearly_discount_pct = $3,
                   updated_by = $4, updated_at = now()
             WHERE id = 1
            RETURNING seat_price_usd, tokens_per_seat, yearly_discount_pct, updated_by, updated_at""";

    private static final String SUBSCRIPTION = """
            SELECT seats, billing_cycle, access_mode, updated_by, updated_at
              FROM miot_integrations.harness_subscriptions WHERE organization = $1""";

    private static final String MEMBERS = """
            SELECT email FROM miot_integrations.harness_seat_members
             WHERE organization = $1 ORDER BY email""";

    private static final String IS_MEMBER = """
            SELECT 1 FROM miot_integrations.harness_seat_members
             WHERE organization = $1 AND email = $2""";

    private static final String UPSERT_SUBSCRIPTION = """
            INSERT INTO miot_integrations.harness_subscriptions
                (organization, seats, billing_cycle, access_mode, updated_by)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (organization) DO UPDATE
                SET seats = EXCLUDED.seats,
                    billing_cycle = EXCLUDED.billing_cycle,
                    access_mode = EXCLUDED.access_mode,
                    updated_by = EXCLUDED.updated_by,
                    updated_at = now()""";

    private static final String CLEAR_MEMBERS =
            "DELETE FROM miot_integrations.harness_seat_members WHERE organization = $1";

    private static final String ADD_MEMBER =
            "INSERT INTO miot_integrations.harness_seat_members (organization, email) VALUES ($1, $2)";

    private static final String POOL_USED = """
            SELECT coalesce(sum(pool_tokens), 0) AS used
              FROM miot_integrations.model_usage
             WHERE organization = $1 AND recorded_at >= $2 AND recorded_at < $3""";

    private static final String USE_BY_MEMBER = """
            SELECT coalesce(user_id, '') AS key,
                   count(DISTINCT run_id) AS runs,
                   sum(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) AS tokens,
                   sum(pool_tokens) AS pool_tokens
              FROM miot_integrations.model_usage
             WHERE organization = $1 AND recorded_at >= $2 AND recorded_at < $3
             GROUP BY 1 ORDER BY pool_tokens DESC""";

    private static final String USE_BY_MODEL = """
            SELECT provider || ':' || model AS key,
                   count(DISTINCT run_id) AS runs,
                   sum(input_tokens + output_tokens + cache_read_tokens + cache_write_tokens) AS tokens,
                   sum(pool_tokens) AS pool_tokens
              FROM miot_integrations.model_usage
             WHERE organization = $1 AND recorded_at >= $2 AND recorded_at < $3
             GROUP BY 1 ORDER BY pool_tokens DESC""";

    private final Instance<Pool> clientInstance;

    @Inject
    public HarnessPlanRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public Plan plan() {
        return mapPlan(execute(PLAN, Tuple.tuple()).iterator().next());
    }

    public Plan setPlan(BigDecimal seatPriceUsd, long tokensPerSeat, BigDecimal yearlyDiscountPct, String actor) {
        Tuple params = Tuple.tuple()
                .addValue(Numeric.create(seatPriceUsd))
                .addLong(tokensPerSeat)
                .addValue(Numeric.create(yearlyDiscountPct))
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
        List<String> members = new ArrayList<>();
        for (Row m : execute(MEMBERS, Tuple.of(organization))) {
            members.add(m.getString("email"));
        }
        return new Subscription(
                row.getInteger("seats"),
                row.getString("billing_cycle"),
                row.getString("access_mode"),
                members,
                row.getString("updated_by"),
                row.getOffsetDateTime("updated_at"));
    }

    public boolean isSeatMember(String organization, String email) {
        return execute(IS_MEMBER, Tuple.of(organization, email)).iterator().hasNext();
    }

    /** Replaces the subscription and its member list in one transaction. */
    public void saveSubscription(String organization, int seats, String billingCycle, String accessMode,
                                 List<String> members, String actor) {
        Uni<Void> work = clientInstance.get().withTransaction(tx -> run(tx, UPSERT_SUBSCRIPTION,
                        Tuple.of(organization, seats, billingCycle, accessMode, actor))
                .flatMap(ignored -> run(tx, CLEAR_MEMBERS, Tuple.of(organization)))
                .flatMap(ignored -> addMembers(tx, organization, members)));
        work.await().atMost(QUERY_TIMEOUT);
    }

    public long poolUsed(String organization, OffsetDateTime from, OffsetDateTime to) {
        return execute(POOL_USED, Tuple.of(organization, from, to)).iterator().next().getLong("used");
    }

    public List<PoolUse> useByMember(String organization, OffsetDateTime from, OffsetDateTime to) {
        return uses(USE_BY_MEMBER, organization, from, to);
    }

    /** Keyed {@code provider:model}, as the usage rows store them. */
    public List<PoolUse> useByModel(String organization, OffsetDateTime from, OffsetDateTime to) {
        return uses(USE_BY_MODEL, organization, from, to);
    }

    private List<PoolUse> uses(String sql, String organization, OffsetDateTime from, OffsetDateTime to) {
        List<PoolUse> out = new ArrayList<>();
        for (Row row : execute(sql, Tuple.of(organization, from, to))) {
            out.add(new PoolUse(row.getString("key"), row.getLong("runs"), row.getLong("tokens"),
                    row.getLong("pool_tokens")));
        }
        return out;
    }

    private static Uni<Void> addMembers(SqlClient tx, String organization, List<String> members) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String email : members) {
            chain = chain.flatMap(ignored -> run(tx, ADD_MEMBER, Tuple.of(organization, email)));
        }
        return chain;
    }

    private static Uni<Void> run(SqlClient tx, String sql, Tuple params) {
        return tx.preparedQuery(sql).execute(params).replaceWithVoid();
    }

    private static Plan mapPlan(Row row) {
        return new Plan(
                row.getBigDecimal("seat_price_usd"),
                row.getLong("tokens_per_seat"),
                row.getBigDecimal("yearly_discount_pct"),
                row.getString("updated_by"),
                row.getOffsetDateTime("updated_at"));
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = clientInstance.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }
}
