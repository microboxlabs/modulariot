package com.microboxlabs.miot.teltonika.store;

import io.vertx.pgclient.PgException;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.util.List;
import java.util.function.Function;
import java.util.function.Supplier;

/**
 * Blocking access to the modulith database for the Teltonika stores, same conventions as the places
 * store: one timeout per statement and constraint violations mapped to the exceptions
 * {@code OrgResourceSupport} turns into HTTP status codes.
 */
public final class PgSupport {

    public static final Duration TIMEOUT = Duration.ofSeconds(10);
    public static final String DEFAULT_SCHEMA = "miot_teltonika";

    private final Supplier<Pool> pool;
    private final String schema;

    public PgSupport(Supplier<Pool> pool, String schema) {
        this.pool = pool;
        this.schema = schema;
    }

    /** Qualified table name in the store's schema. */
    public String table(String name) {
        return schema + "." + name;
    }

    public RowSet<Row> query(String sql, Tuple params) {
        return query(pool.get(), sql, params);
    }

    public void batch(String sql, List<Tuple> rows) {
        if (rows.isEmpty()) {
            return;
        }
        try {
            pool.get().preparedQuery(sql).executeBatch(rows).await().atMost(TIMEOUT);
        } catch (PgException e) {
            throw translate(e);
        }
    }

    /** Runs {@code work} in one transaction; the client passed in must be used for every statement. */
    public <T> T inTransaction(Function<SqlClient, T> work) {
        var connection = pool.get().getConnection().await().atMost(TIMEOUT);
        try {
            var tx = connection.begin().await().atMost(TIMEOUT);
            try {
                T result = work.apply(connection);
                tx.commit().await().atMost(TIMEOUT);
                return result;
            } catch (RuntimeException e) {
                tx.rollback().await().atMost(TIMEOUT);
                throw e;
            }
        } finally {
            connection.close().await().atMost(TIMEOUT);
        }
    }

    public static RowSet<Row> query(SqlClient client, String sql, Tuple params) {
        try {
            return client.preparedQuery(sql).execute(params).await().atMost(TIMEOUT);
        } catch (PgException e) {
            throw translate(e);
        }
    }

    static RuntimeException translate(PgException e) {
        return switch (e.getSqlState() == null ? "" : e.getSqlState()) {
            case "23505" -> new IllegalStateException(duplicate(e.getConstraint()));
            case "23503" -> new IllegalArgumentException("the device is not registered");
            case "23514" -> new IllegalArgumentException("a value is outside its allowed set");
            case "23502" -> new IllegalArgumentException("a required value is missing");
            case "22001" -> new IllegalArgumentException("a value is longer than its field allows");
            default -> e;
        };
    }

    private static String duplicate(String constraint) {
        if ("uq_assignment_open".equals(constraint)) {
            return "the device already has an open assignment";
        }
        if (constraint != null && constraint.contains("profile")) {
            return "a profile with that name already exists in this organization";
        }
        return "a device with that id is already registered";
    }
}
