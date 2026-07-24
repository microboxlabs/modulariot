package com.microboxlabs.miot.integrations.template;

import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * The channel's data contract, read from {@code integration_operations.request_schema}.
 *
 * <p>That column has existed since the schema was created and, until now, nothing ever read
 * it. This is its first reader: it tells the renderer which fields exist, what JSON type each
 * must leave as, and which ones may not be omitted — and it is the same list the settings UI
 * renders as mapping rows.
 *
 * <p>Interpreted as a JSON-Schema subset:
 *
 * <pre>{@code
 * { "type": "object",
 *   "properties": { "aprobado": { "type": "boolean", "title": "Approved" } },
 *   "required": ["aprobado"] }
 * }</pre>
 *
 * <p><b>Array bodies.</b> A partner that wants a JSON array — "here are the N media I
 * reviewed" — declares {@code "type": "array"} with the per-element contract under
 * {@code items}, and names the context collection to iterate with {@code itemsFrom}
 * (default {@code content}):
 *
 * <pre>{@code
 * { "type": "array", "itemsFrom": "content",
 *   "items": { "type": "object",
 *              "properties": { "guidMultimedia": { "type": "string" } },
 *              "required": ["guidMultimedia"] } }
 * }</pre>
 *
 * <p>The declared {@link #fields()} are the same either way — the mapping rows an operator
 * fills in — so the settings UI and save-time validation treat an array contract exactly
 * like an object one. Only the renderer cares about the difference: it renders those fields
 * once per element of {@link #itemsFrom()} instead of once total.
 *
 * <p>Anything richer (nested objects, {@code oneOf}, validation keywords) is ignored rather
 * than rejected — an operator may have pasted a fuller schema, and the parts we do understand
 * are still the parts we act on. A property with no usable {@code type}, including
 * {@code string} with {@code "format": "date-time"}, is treated as {@link FieldType#STRING}
 * and passed through verbatim.
 */
public record PayloadSchema(List<Field> fields, boolean array, String itemsFrom) {

    /** The JSON types a channel field can be sent as. */
    public enum FieldType {
        STRING,
        BOOLEAN,
        INTEGER,
        NUMBER
    }

    public record Field(String id, FieldType type, boolean required) {
    }

    /** The context collection an array schema iterates when {@code itemsFrom} is absent. */
    private static final String DEFAULT_ITEMS_FROM = "content";

    private static final PayloadSchema EMPTY = new PayloadSchema(List.of());

    /** An object contract over {@code fields} — the shape every existing caller assumes. */
    public PayloadSchema(List<Field> fields) {
        this(fields, false, null);
    }

    /** A schema declaring nothing — every mapped field is then sent as a string. */
    public static PayloadSchema empty() {
        return EMPTY;
    }

    /** Property order is preserved, so the UI lists fields the way the contract declares them. */
    public static PayloadSchema of(Map<String, Object> requestSchema) {
        if (requestSchema == null || requestSchema.isEmpty()) {
            return EMPTY;
        }
        if (isArray(requestSchema)) {
            Object rawItems = requestSchema.get("items");
            Map<?, ?> items = rawItems instanceof Map<?, ?> map ? map : Map.of();
            List<Field> fields = fieldsOf(items);
            return fields.isEmpty() ? EMPTY : new PayloadSchema(fields, true, itemsFrom(requestSchema));
        }
        List<Field> fields = fieldsOf(requestSchema);
        return fields.isEmpty() ? EMPTY : new PayloadSchema(fields);
    }

    /** The per-element object contract of an array schema, for rendering one element. */
    public PayloadSchema itemSchema() {
        return new PayloadSchema(fields);
    }

    public Field field(String id) {
        return fields.stream().filter(field -> field.id().equals(id)).findFirst().orElse(null);
    }

    public List<Field> requiredFields() {
        return fields.stream().filter(Field::required).toList();
    }

    /* ---------------------------------------------------------------------- */

    private static boolean isArray(Map<String, Object> requestSchema) {
        return "array".equalsIgnoreCase(String.valueOf(requestSchema.get("type")));
    }

    private static String itemsFrom(Map<String, Object> requestSchema) {
        Object raw = requestSchema.get("itemsFrom");
        if (raw == null || String.valueOf(raw).isBlank()) {
            return DEFAULT_ITEMS_FROM;
        }
        return String.valueOf(raw).trim();
    }

    /** Reads {@code properties}/{@code required} of an object schema map into fields. */
    private static List<Field> fieldsOf(Map<?, ?> schema) {
        Object rawProperties = schema.get("properties");
        if (!(rawProperties instanceof Map<?, ?> properties) || properties.isEmpty()) {
            return List.of();
        }
        Set<String> required = requiredNames(schema.get("required"));
        List<Field> fields = new ArrayList<>(properties.size());
        properties.forEach((name, definition) -> {
            String id = String.valueOf(name);
            fields.add(new Field(id, typeOf(definition), required.contains(id)));
        });
        return List.copyOf(fields);
    }

    private static Set<String> requiredNames(Object raw) {
        if (!(raw instanceof Iterable<?> items)) {
            return Set.of();
        }
        Set<String> names = new LinkedHashSet<>();
        for (Object item : items) {
            if (item != null) {
                names.add(String.valueOf(item));
            }
        }
        return names;
    }

    private static FieldType typeOf(Object definition) {
        if (!(definition instanceof Map<?, ?> map)) {
            return FieldType.STRING;
        }
        Object type = map.get("type");
        if (type == null) {
            return FieldType.STRING;
        }
        return switch (String.valueOf(type).toLowerCase()) {
            case "boolean" -> FieldType.BOOLEAN;
            case "integer" -> FieldType.INTEGER;
            case "number" -> FieldType.NUMBER;
            // "string" and anything unrecognized (including date-time formats) pass through.
            default -> FieldType.STRING;
        };
    }
}
