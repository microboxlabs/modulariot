package com.microboxlabs.miot.fleet.resources.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.db.PgTx;
import io.vertx.pgclient.PgException;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlClient;
import io.vertx.mutiny.sqlclient.Tuple;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.UUID;

/** Query, id, JSON and time helpers shared by the trips Postgres stores. */
public final class Pg {

    public static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private Pg() {
    }

    /** Runs on the open transaction ({@link PgTx}) when there is one, on {@code client} otherwise. */
    public static RowSet<Row> query(SqlClient client, String sql, Tuple params) {
        try {
            return PgTx.client(client).preparedQuery(sql).execute(params).await().atMost(QUERY_TIMEOUT);
        } catch (PgException e) {
            PgTx.statementFailed();
            throw translate(e);
        }
    }

    /** {@code " FOR UPDATE"} inside a transaction. */
    public static String lock() {
        return PgTx.lock();
    }

    /** Constraint violations become domain exceptions the resource layer already maps (400/409). */
    private static RuntimeException translate(PgException e) {
        return switch (e.getSqlState() == null ? "" : e.getSqlState()) {
            case "23505" -> new IllegalStateException("conflict: another row already holds that state");
            case "23503" -> new IllegalArgumentException("a referenced entity does not exist");
            case "23514" -> new IllegalArgumentException("a value is outside its allowed set");
            default -> PgTx.conflictOr(e);
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
