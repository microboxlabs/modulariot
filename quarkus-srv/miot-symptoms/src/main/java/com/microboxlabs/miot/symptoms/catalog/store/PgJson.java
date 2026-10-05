package com.microboxlabs.miot.symptoms.catalog.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.vertx.mutiny.sqlclient.Row;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;

/** JSON and column helpers shared by the Postgres stores. */
public final class PgJson {

    public static final Duration QUERY_TIMEOUT = Duration.ofSeconds(10);

    private static final ObjectMapper JSON = new ObjectMapper()
            .configure(DeserializationFeature.FAIL_ON_UNKNOWN_PROPERTIES, false);

    private PgJson() {
    }

    /** JSON text for a {@code $n::jsonb} parameter. */
    public static String write(Object value) {
        try {
            return JSON.writeValueAsString(value);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not write JSON", e);
        }
    }

    public static <T> T read(Row row, String column, Class<T> type) {
        try {
            return JSON.readValue(text(row, column), type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read " + column, e);
        }
    }

    public static <T> T read(Row row, String column, TypeReference<T> type) {
        try {
            return JSON.readValue(text(row, column), type);
        } catch (JsonProcessingException e) {
            throw new IllegalStateException("Could not read " + column, e);
        }
    }

    public static OffsetDateTime time(Row row, String column) {
        OffsetDateTime value = row.getOffsetDateTime(column);
        return value == null ? null : value.withOffsetSameInstant(ZoneOffset.UTC);
    }

    private static String text(Row row, String column) {
        Object value = row.getValue(column);
        return value == null ? "null" : value.toString();
    }
}
