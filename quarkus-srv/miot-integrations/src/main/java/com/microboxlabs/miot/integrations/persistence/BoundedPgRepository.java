package com.microboxlabs.miot.integrations.persistence;

import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.inject.Instance;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;

/**
 * Blocking access to the reactive PG pool with a bounded wait, as in
 * {@link HarnessThreadRepository}: a pooled connection that dies without
 * closing would otherwise park the caller forever.
 */
abstract class BoundedPgRepository {

    static final Duration DEFAULT_QUERY_TIMEOUT = Duration.ofSeconds(10);

    private final Instance<Pool> clientInstance;
    private final Duration queryTimeout;

    BoundedPgRepository(Instance<Pool> clientInstance, Duration queryTimeout) {
        this.clientInstance = clientInstance;
        this.queryTimeout = queryTimeout == null || queryTimeout.isZero() || queryTimeout.isNegative()
                ? DEFAULT_QUERY_TIMEOUT
                : queryTimeout;
    }

    RowSet<Row> execute(String sql, Tuple params) {
        return awaitRows(clientInstance.get().preparedQuery(sql).execute(params));
    }

    RowSet<Row> awaitRows(Uni<RowSet<Row>> query) {
        return query.await().atMost(queryTimeout);
    }

    static Row first(RowSet<Row> rows) {
        return rows.iterator().hasNext() ? rows.iterator().next() : null;
    }

    static JsonObject toJson(Map<String, Object> value) {
        return value == null ? null : new JsonObject(value);
    }

    static Map<String, Object> toMap(JsonObject value) {
        return value == null ? null : new LinkedHashMap<>(value.getMap());
    }
}
