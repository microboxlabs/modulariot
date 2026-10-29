package com.microboxlabs.miot.integrations.persistence;

import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.sqlclient.data.Numeric;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.math.BigDecimal;
import java.time.Duration;

/** Storage for geocoding usage. Unit tests subclass it with no pool. */
@ApplicationScoped
public class GeocodeUsageRepository {

    private static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final String INSERT = """
            INSERT INTO miot_integrations.geocode_usage (
                tenant_id, user_id, source, result, provider, cache_hit, cost_usd
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)""";

    public record UsageRow(String tenantId, String userId, String source, String result, String provider,
            boolean cacheHit, BigDecimal costUsd) {
    }

    private final Instance<Pool> clientInstance;

    @Inject
    public GeocodeUsageRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public void insert(UsageRow r) {
        Tuple params = Tuple.tuple()
                .addString(r.tenantId())
                .addString(r.userId())
                .addString(r.source())
                .addString(r.result())
                .addString(r.provider())
                .addBoolean(r.cacheHit())
                .addValue(r.costUsd() == null ? null : Numeric.create(r.costUsd()));
        clientInstance.get().preparedQuery(INSERT).execute(params).await().atMost(QUERY_TIMEOUT);
    }
}
