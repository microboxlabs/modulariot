package com.microboxlabs.miot.conversational.rules.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.Map;
import java.util.UUID;

/** Small helpers shared by the rule stores. JSONB columns are written as text cast to jsonb and read as text. */
final class Pg {

    static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);
    static final String SELECT = "SELECT ";
    private static final String UNIQUE_VIOLATION = "23505";
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };

    private Pg() {
    }

    static RowSet<Row> query(Pool pool, String sql, Tuple params) {
        return pool.preparedQuery(sql).execute(params).await().indefinitely();
    }

    static boolean uniqueViolation(Throwable e) {
        Throwable t = e;
        while (t != null) {
            if (t instanceof PgException pg && UNIQUE_VIOLATION.equals(pg.getSqlState())) {
                return true;
            }
            t = t.getCause();
        }
        return false;
    }

    static OffsetDateTime time(Instant at) {
        return at == null ? null : at.atOffset(ZoneOffset.UTC);
    }

    static Instant instant(Row row, String column) {
        OffsetDateTime t = row.getOffsetDateTime(column);
        return t == null ? null : t.toInstant();
    }

    static UUID uuid(String id) {
        return id == null ? null : UUID.fromString(id);
    }

    /** A UUID, or null for text that is not one, so a bad id finds nothing. */
    static UUID uuidOrNull(String id) {
        try {
            return id == null ? null : UUID.fromString(id.trim());
        } catch (IllegalArgumentException e) {
            return null;
        }
    }

    static String string(Row row, String column) {
        UUID id = row.getUUID(column);
        return id == null ? null : id.toString();
    }

    static String write(Object value) {
        if (value == null) {
            return null;
        }
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalArgumentException("Not JSON: " + e.getOriginalMessage());
        }
    }

    static JsonNode node(String text) {
        if (text == null) {
            return null;
        }
        try {
            return JSON.readTree(text);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored JSON is not valid", e);
        }
    }

    static Map<String, Object> map(String text) {
        if (text == null) {
            return Map.of();
        }
        try {
            return JSON.readValue(text, MAP);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored JSON is not valid", e);
        }
    }

    static <T> T read(String text, Class<T> type) {
        if (text == null) {
            return null;
        }
        try {
            return JSON.readValue(text, type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Stored JSON is not valid", e);
        }
    }
}
