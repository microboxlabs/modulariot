package com.microboxlabs.miot.symptoms.persistence;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Row;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/** Small helpers shared by the module's Vert.x repositories. */
final class RowMappers {

    private RowMappers() {
    }

    static String uuid(Row row, String column) {
        UUID value = row.getUUID(column);
        return value == null ? null : value.toString();
    }

    static UUID toUuid(String value) {
        if (value == null || value.isBlank()) {
            return null;
        }
        try {
            return UUID.fromString(value);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("not a UUID: " + value);
        }
    }

    static List<String> stringList(JsonArray array) {
        List<String> out = new ArrayList<>();
        if (array == null) {
            return out;
        }
        for (int i = 0; i < array.size(); i++) {
            Object v = array.getValue(i);
            if (v != null) {
                out.add(v.toString());
            }
        }
        return out;
    }

    static JsonArray toJsonArray(List<?> values) {
        JsonArray array = new JsonArray();
        if (values != null) {
            values.forEach(v -> array.add(v == null ? null : v.toString()));
        }
        return array;
    }

    static Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }

    static JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }
}
