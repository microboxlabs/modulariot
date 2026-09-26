package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.dto.ModelUsageDtos.UsageTotal;
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
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Storage for model token usage. Unit tests subclass it with no pool. */
@ApplicationScoped
public class ModelUsageRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final String INSERT = """
            INSERT INTO miot_integrations.model_usage (
                run_id, organization, tenant_id, user_id, provider, model, calls,
                input_tokens, output_tokens, cache_read_tokens, cache_write_tokens,
                input_per_mtok, output_per_mtok, cost_usd
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            ON CONFLICT (run_id, provider, model) DO NOTHING""";

    private static final String TOTALS = """
            SELECT organization, provider, model,
                   count(DISTINCT run_id) AS runs,
                   sum(calls) AS calls,
                   sum(input_tokens) AS input_tokens,
                   sum(output_tokens) AS output_tokens,
                   sum(cache_read_tokens) AS cache_read_tokens,
                   sum(cache_write_tokens) AS cache_write_tokens,
                   sum(cost_usd) AS cost_usd,
                   count(DISTINCT run_id) FILTER (WHERE cost_usd IS NULL) AS unpriced_runs
              FROM miot_integrations.model_usage
             WHERE recorded_at >= $1 AND recorded_at < $2
               AND ($3::text IS NULL OR organization = $3)
             GROUP BY organization, provider, model
             ORDER BY organization, provider, model""";

    /** One row to insert; prices and cost are already resolved. */
    public record UsageRow(
            String runId,
            String organization,
            String tenantId,
            String userId,
            String provider,
            String model,
            int calls,
            long inputTokens,
            long outputTokens,
            long cacheReadTokens,
            long cacheWriteTokens,
            BigDecimal inputPerMtok,
            BigDecimal outputPerMtok,
            BigDecimal costUsd) {
    }

    private final Instance<Pool> clientInstance;

    @Inject
    public ModelUsageRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /** Returns false when the run already reported this model. */
    public boolean insert(UsageRow r) {
        Tuple params = Tuple.tuple()
                .addString(r.runId())
                .addString(r.organization())
                .addString(r.tenantId())
                .addString(r.userId())
                .addString(r.provider())
                .addString(r.model())
                .addInteger(r.calls())
                .addLong(r.inputTokens())
                .addLong(r.outputTokens())
                .addLong(r.cacheReadTokens())
                .addLong(r.cacheWriteTokens())
                .addValue(numeric(r.inputPerMtok()))
                .addValue(numeric(r.outputPerMtok()))
                .addValue(numeric(r.costUsd()));
        return execute(INSERT, params).rowCount() > 0;
    }

    public List<UsageTotal> totals(OffsetDateTime from, OffsetDateTime to, String organization) {
        List<UsageTotal> out = new ArrayList<>();
        for (Row row : execute(TOTALS, Tuple.of(from, to, organization))) {
            out.add(new UsageTotal(
                    row.getString("organization"),
                    row.getString("provider"),
                    row.getString("model"),
                    row.getLong("runs"),
                    row.getLong("calls"),
                    row.getLong("input_tokens"),
                    row.getLong("output_tokens"),
                    row.getLong("cache_read_tokens"),
                    row.getLong("cache_write_tokens"),
                    row.getBigDecimal("cost_usd"),
                    row.getLong("unpriced_runs")));
        }
        return out;
    }

    private static Numeric numeric(BigDecimal value) {
        return value == null ? null : Numeric.create(value);
    }

    private RowSet<Row> execute(String sql, Tuple params) {
        Uni<RowSet<Row>> query = clientInstance.get().preparedQuery(sql).execute(params);
        return query.await().atMost(QUERY_TIMEOUT);
    }
}
