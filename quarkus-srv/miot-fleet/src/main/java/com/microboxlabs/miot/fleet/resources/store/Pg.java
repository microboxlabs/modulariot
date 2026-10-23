package com.microboxlabs.miot.fleet.resources.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.pgclient.PgException;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;
import java.util.function.Supplier;

/** Query, id, JSON and time helpers shared by the fleet resource Postgres stores. */
public final class Pg {

    public static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    /** The transaction this thread runs in; every query joins it. */
    private static final ThreadLocal<Tx> TX = new ThreadLocal<>();

    private static final class Tx {
        private final SqlConnection conn;
        private int savepoints;
        private boolean failed;

        private Tx(SqlConnection conn) {
            this.conn = conn;
        }
    }

    private Pg() {
    }

    /** Runs on the open transaction when there is one, on {@code client} otherwise. */
    public static RowSet<Row> query(SqlClient client, String sql, Tuple params) {
        Tx tx = TX.get();
        try {
            return (tx == null ? client : tx.conn).preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
        } catch (PgException e) {
            if (tx != null && tx.savepoints == 0) {
                tx.failed = true;
            }
            throw translate(e);
        }
    }

    /**
     * Runs {@code work} in one transaction on one connection: commits when it returns, rolls back
     * when it throws. A nested call joins the outer transaction. Blocking: call it off the event loop.
     * BEGIN/COMMIT are plain statements, not a Vert.x Transaction, which would roll everything back
     * on the first failed statement, even one inside a savepoint.
     */
    public static <T> T inTransaction(Pool pool, Supplier<T> work) {
        if (TX.get() != null) {
            return work.get();
        }
        SqlConnection conn = pool.getConnection().await().atMost(QUERY_TIMEOUT);
        try {
            simple(conn, "BEGIN");
            Tx tx = new Tx(conn);
            TX.set(tx);
            T result;
            try {
                result = work.get();
            } catch (RuntimeException | Error e) {
                TX.remove();
                rollback(conn, e);
                throw e;
            }
            TX.remove();
            if (tx.failed) {
                IllegalStateException e = new IllegalStateException("a statement failed in the transaction");
                rollback(conn, e);
                throw e;
            }
            simple(conn, "COMMIT");
            return result;
        } finally {
            TX.remove();
            conn.close().await().atMost(QUERY_TIMEOUT);
        }
    }

    /**
     * Inside a transaction, runs {@code work} under a savepoint: when it throws, only its own
     * statements are undone and the transaction stays usable. Outside one, just runs it.
     */
    public static <T> T savepoint(Supplier<T> work) {
        Tx tx = TX.get();
        if (tx == null) {
            return work.get();
        }
        String name = "miot_sp" + tx.savepoints;
        simple(tx.conn, "SAVEPOINT " + name);
        tx.savepoints++;
        try {
            T result = work.get();
            tx.savepoints--;
            simple(tx.conn, "RELEASE SAVEPOINT " + name);
            return result;
        } catch (RuntimeException e) {
            tx.savepoints--;
            simple(tx.conn, "ROLLBACK TO SAVEPOINT " + name);
            throw e;
        }
    }

    /** {@code " FOR UPDATE"} inside a transaction: a row read there stays locked until it ends. */
    public static String lock() {
        return TX.get() == null ? "" : " FOR UPDATE";
    }

    private static void simple(SqlConnection conn, String sql) {
        try {
            conn.query(sql).execute().await().atMost(QUERY_TIMEOUT);
        } catch (PgException e) {
            throw translate(e);
        }
    }

    private static void rollback(SqlConnection conn, Throwable cause) {
        try {
            simple(conn, "ROLLBACK");
        } catch (RuntimeException e) {
            cause.addSuppressed(e);
        }
    }

    /** Constraint violations become domain exceptions the resource layer already maps (400/409). */
    private static RuntimeException translate(PgException e) {
        return switch (e.getSqlState() == null ? "" : e.getSqlState()) {
            case "23505" -> new IllegalStateException("conflict: another row already holds that state");
            case "23503" -> new IllegalArgumentException("a referenced entity does not exist");
            case "23514" -> new IllegalArgumentException("a value is outside its allowed set");
            case "40001", "40P01" -> new IllegalStateException("conflict: a concurrent change won, retry");
            default -> e;
        };
    }

    /** The UUID an API id stands for, or null when it is not one (such an id matches no row). */
    public static UUID parse(String id) {
        if (id == null) {
            return null;
        }
        try {
            return UUID.fromString(id);
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    public static String text(UUID id) {
        return id == null ? null : id.toString();
    }

    /** JSON text for a {@code $n::jsonb} parameter. */
    public static String json(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not write JSON", e);
        }
    }

    public static <T> T json(Row row, String column, TypeReference<T> type) {
        String text = text(row, column);
        if (text == null) {
            return null;
        }
        try {
            return JSON.readValue(text, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read " + column, e);
        }
    }

    public static String text(Row row, String column) {
        Object value = row.getValue(column);
        return value == null ? null : value.toString();
    }

    /** Timestamps normalized to UTC so views compare equal across sessions. */
    public static OffsetDateTime time(Row row, String column) {
        OffsetDateTime value = row.getOffsetDateTime(column);
        return value == null ? null : value.withOffsetSameInstant(ZoneOffset.UTC);
    }
}
