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
 * <p><b>Nested fields.</b> A partner that wants an <i>object</i> wrapping that array — a
 * {@code Command} envelope carrying {@code serviceCode} and a {@code fotos} list — declares a
 * property whose own {@code type} is {@code object} or {@code array}. An {@code array} property
 * iterates its own {@code itemsFrom} collection (default {@code content}) and renders {@code items}
 * once per element; an {@code object} property renders its {@code properties} against the same
 * context. Nesting composes to any depth, so an element of {@code fotos} may itself declare a
 * {@code mensaje} array. A nested field's mapping rows are keyed by their dotted path
 * ({@code fotos.guidMultimedia}), which keeps a reused leaf name ({@code aprobada} on both the
 * envelope and each foto) unambiguous.
 *
 * <pre>{@code
 * { "type": "object",
 *   "properties": {
 *     "serviceCode": { "type": "string" },
 *     "fotos": { "type": "array", "itemsFrom": "content",
 *                "items": { "type": "object",
 *                           "properties": { "guidMultimedia": { "type": "string" } } } } },
 *   "required": ["serviceCode", "fotos"] }
 * }</pre>
 *
 * <p>The declared {@link #fields()} are the mapping rows an operator fills in — so the settings
 * UI and save-time validation treat an array contract exactly like an object one. Only the
 * renderer cares about the difference: it renders those fields once per element of
 * {@link #itemsFrom()} instead of once total, and a structural field expands into a nested
 * object or array rather than a scalar.
 *
 * <p>Validation keywords ({@code oneOf}, {@code minLength}, …) are ignored rather than rejected —
 * an operator may have pasted a fuller schema, and the parts we do understand are still the parts
 * we act on. A property with no usable {@code type}, including {@code string} with
 * {@code "format": "date-time"}, is treated as {@link FieldType#STRING} and passed through
 * verbatim; an {@code object}/{@code array} property that declares no usable sub-fields degrades
 * to the same string passthrough rather than an empty nested node.
 */
public record PayloadSchema(List<Field> fields, boolean array, String itemsFrom) {

    /** The JSON types a channel field can be sent as. */
    public enum FieldType {
        STRING,
        BOOLEAN,
        INTEGER,
        NUMBER,
        OBJECT,
        ARRAY
    }

    /**
     * One declared field. A scalar leaf ({@code child == null}) is produced from its mapped
     * template. A structural field carries a nested contract: {@link FieldType#OBJECT} renders
     * {@code child} against the same context, {@link FieldType#ARRAY} renders {@code child} once
     * per element of the context collection named by {@code itemsFrom}.
     */
    public record Field(String id, FieldType type, boolean required, PayloadSchema child, String itemsFrom) {

        /** A scalar leaf — the shape every existing caller assumes. */
        public Field(String id, FieldType type, boolean required) {
            this(id, type, required, null, null);
        }

        public boolean structural() {
            return type == FieldType.OBJECT || type == FieldType.ARRAY;
        }
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
            List<Field> fields = itemFieldsOf(requestSchema);
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

    /**
     * Every scalar leaf as a field whose id is its dotted path — the mapping rows an operator
     * actually fills in. A structural field contributes its leaves ({@code fotos.guidMultimedia},
     * {@code fotos.mensaje.codigo}), not itself: an array/object is a container, not a value to
     * template. Used by the settings UI so it renders one editable row per leaf.
     */
    public List<Field> leafFields() {
        return leaves().stream()
                .map(leaf -> new Field(leaf.id(), leaf.type(), leaf.required()))
                .toList();
    }

    /**
     * A scalar leaf together with the template root in scope where it renders.
     *
     * <p>{@code contextRoot} is what an operator's template must read from on that row. It is
     * null for envelope leaves, which see the whole context ({@code task}, {@code session}, …).
     * Inside an array it is that array's bind name, because the renderer rebinds each element
     * under the last segment of {@code itemsFrom}: a leaf of {@code fotos} (iterating
     * {@code content}) reads {@code content.*}, and a leaf of {@code fotos.mensaje} (iterating
     * {@code content.reasons}) reads {@code reasons.*} — *this* photo's reasons, not a global list.
     */
    public record Leaf(String id, FieldType type, boolean required, String contextRoot) {
    }

    /** Every scalar leaf, dotted path and rendering scope — see {@link Leaf}. */
    public List<Leaf> leaves() {
        List<Leaf> leaves = new ArrayList<>();
        collectLeaves("", null, fields, leaves);
        return List.copyOf(leaves);
    }

    /**
     * The extra template roots this contract's arrays introduce, beyond the always-present ones.
     * Save-time validation accepts these, so the UI must offer them too or it would reject a
     * mapping the server stores happily.
     */
    public List<String> arrayBindNames() {
        List<String> names = new ArrayList<>();
        collectArrayBindNames(fields, names);
        return List.copyOf(names);
    }

    private static void collectLeaves(String prefix, String scope, List<Field> fields, List<Leaf> out) {
        for (Field field : fields) {
            String id = prefix + field.id();
            if (!field.structural()) {
                out.add(new Leaf(id, field.type(), field.required(), scope));
                continue;
            }
            if (field.child() != null) {
                // An array rebinds its elements, so its leaves see a new root; an object only
                // nests the payload and keeps whatever scope it inherited.
                String childScope = field.type() == FieldType.ARRAY ? bindNameOf(field) : scope;
                collectLeaves(id + ".", childScope, field.child().fields(), out);
            }
        }
    }

    private static void collectArrayBindNames(List<Field> fields, List<String> out) {
        for (Field field : fields) {
            if (field.type() == FieldType.ARRAY) {
                String name = bindNameOf(field);
                if (!out.contains(name)) {
                    out.add(name);
                }
            }
            if (field.child() != null) {
                collectArrayBindNames(field.child().fields(), out);
            }
        }
    }

    /** The root an array's elements are bound under: the last segment of its {@code itemsFrom}. */
    private static String bindNameOf(Field field) {
        String itemsFrom = field.itemsFrom() == null ? DEFAULT_ITEMS_FROM : field.itemsFrom();
        int dot = itemsFrom.lastIndexOf('.');
        return dot < 0 ? itemsFrom : itemsFrom.substring(dot + 1);
    }

    /* ---------------------------------------------------------------------- */

    private static boolean isArray(Map<?, ?> schema) {
        return "array".equalsIgnoreCase(String.valueOf(schema.get("type")));
    }

    private static String itemsFrom(Map<?, ?> schema) {
        Object raw = schema.get("itemsFrom");
        if (raw == null || String.valueOf(raw).isBlank()) {
            return DEFAULT_ITEMS_FROM;
        }
        return String.valueOf(raw).trim();
    }

    /** The element (object) fields of an array schema, read from its {@code items}. */
    private static List<Field> itemFieldsOf(Map<?, ?> arraySchema) {
        Object rawItems = arraySchema.get("items");
        Map<?, ?> items = rawItems instanceof Map<?, ?> map ? map : Map.of();
        return fieldsOf(items);
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
            fields.add(fieldOf(id, definition, required.contains(id)));
        });
        return List.copyOf(fields);
    }

    /** One field, structural (object/array) when it declares a usable nested contract. */
    private static Field fieldOf(String id, Object definition, boolean required) {
        if (!(definition instanceof Map<?, ?> def)) {
            return new Field(id, FieldType.STRING, required);
        }
        String type = def.get("type") == null ? "" : String.valueOf(def.get("type")).toLowerCase();
        if ("array".equals(type)) {
            List<Field> items = itemFieldsOf(def);
            // An array of scalars is not a mapping surface we render element fields for; keep the
            // node rather than reject, degrading to a string passthrough as any unknown type does.
            return items.isEmpty()
                    ? new Field(id, FieldType.STRING, required)
                    : new Field(id, FieldType.ARRAY, required, new PayloadSchema(items), itemsFrom(def));
        }
        if ("object".equals(type) || (type.isEmpty() && def.get("properties") instanceof Map<?, ?>)) {
            List<Field> childFields = fieldsOf(def);
            return childFields.isEmpty()
                    ? new Field(id, FieldType.STRING, required)
                    : new Field(id, FieldType.OBJECT, required, new PayloadSchema(childFields), null);
        }
        return new Field(id, scalarType(type), required);
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

    private static FieldType scalarType(String type) {
        return switch (type) {
            case "boolean" -> FieldType.BOOLEAN;
            case "integer" -> FieldType.INTEGER;
            case "number" -> FieldType.NUMBER;
            // "string" and anything unrecognized (including date-time formats) pass through.
            default -> FieldType.STRING;
        };
    }
}
