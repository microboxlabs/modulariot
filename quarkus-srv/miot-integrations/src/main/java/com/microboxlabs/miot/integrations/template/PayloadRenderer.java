package com.microboxlabs.miot.integrations.template;

import jakarta.enterprise.context.ApplicationScoped;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

/**
 * Builds a channel's outbound JSON body from the binding's field templates.
 *
 * <p>Per scalar field: render the template, coerce the result to the type the channel's
 * {@link PayloadSchema} declares, and decide whether an empty result may be sent. A structural
 * field (an object, or an array over a context collection) expands into a nested node instead.
 * Every problem is collected before throwing, so an operator sees a whole broken mapping at once
 * rather than one fault per attempt.
 *
 * <p>Rules worth knowing:
 *
 * <ul>
 *   <li><b>An empty optional field is omitted, not sent blank.</b> Most partners treat an
 *       absent key and {@code ""} differently, and "no reviewer comment" means the former.
 *       An empty <i>required</i> field is an error — silently writing a blank into a
 *       required slot is worse than failing. A structural field whose expansion is empty is
 *       treated the same: omitted when optional, kept when required.
 *   <li><b>A template that is exactly one variable keeps the context value's own type.</b>
 *       {@code {{review.verdict}}} over a real boolean sends JSON {@code false}, not
 *       {@code "false"}, without depending on a string round-trip.
 *   <li><b>Nested mapping rows are keyed by their dotted path.</b> An {@code array} field
 *       {@code fotos} whose element declares {@code guidMultimedia} looks up the template
 *       {@code fotos.guidMultimedia}, so a leaf name reused at two depths ({@code aprobada}
 *       on the envelope and on each foto) never collides. Only the top level accepts an
 *       undeclared mapped key as a passthrough.
 * </ul>
 */
@ApplicationScoped
public class PayloadRenderer {

    /**
     * @param templates field id → template, as stored on the binding
     * @param schema the channel's contract; {@link PayloadSchema#empty()} sends everything as text
     * @param context {@code {task, content, review, session}}
     * @throws PayloadRenderException listing every field that could not be produced
     */
    public Map<String, Object> render(
            Map<String, String> templates, PayloadSchema schema, Map<String, Object> context) {
        return renderObject(safeTemplates(templates), schema, safeContext(context), "");
    }

    /**
     * The body to send: a JSON object for an object contract, a JSON array for an array one.
     *
     * <p>An array contract renders its declared fields once per element of the context
     * collection it names ({@link PayloadSchema#itemsFrom()}, e.g. {@code content}), binding
     * that name to each element in turn — so {@code {{content.mediaId}}} means "this element's
     * media id". Shared roots ({@code task}, {@code session}) stay visible to every element.
     * The object case delegates to {@link #render}, which now also expands nested object and
     * array fields.
     *
     * @throws PayloadRenderException listing every element/field that could not be produced
     */
    public Object renderBody(
            Map<String, String> templates, PayloadSchema schema, Map<String, Object> context) {
        if (!schema.array()) {
            return render(templates, schema, context);
        }
        return renderElements(
                safeTemplates(templates), schema.itemsFrom(), schema.itemSchema(), safeContext(context), "");
    }

    /**
     * Checks a mapping before it is stored: templates parse, read known variables, and cover
     * every required field. Required coverage follows nested structure by the dotted path the
     * renderer looks a nested field up under.
     *
     * @return every problem found; empty when the mapping is storable
     */
    public List<String> validate(
            Map<String, String> templates, PayloadSchema schema, Set<String> allowedRoots) {
        Map<String, String> mappings = safeTemplates(templates);
        List<String> problems = new ArrayList<>();

        for (String requiredPath : requiredLeafPaths(schema, "")) {
            String template = mappings.get(requiredPath);
            if (template == null || template.isBlank()) {
                problems.add("'" + requiredPath + "' is required but has no mapping");
            }
        }
        // A nested array binds each element under its collection's own name, so a template inside
        // it legitimately reads a root the caller never declared ({{reasons.code}} within a
        // content.reasons array). Those roots come from the schema, not the caller, so add them.
        Set<String> roots = new LinkedHashSet<>(allowedRoots);
        roots.addAll(schema.arrayBindNames());
        mappings.forEach((fieldId, template) -> {
            if (template == null || template.isBlank()) {
                return;
            }
            try {
                PayloadTemplate.validate(template, roots);
            } catch (TemplateSyntaxException e) {
                problems.add("'" + fieldId + "': " + e.getMessage());
            }
        });
        return problems;
    }

    /* ---------------------------------------------------------------------- */

    /**
     * Renders one object level. Scalar fields come from their templates; an {@code array} field
     * expands into a list over its context collection and an {@code object} field into a nested
     * map, each keyed for template lookup by {@code prefix + fieldId}. Only the top level (empty
     * prefix) also emits undeclared, undotted mapped keys as string passthroughs.
     */
    private Map<String, Object> renderObject(
            Map<String, String> templates, PayloadSchema schema, Map<String, Object> context, String prefix) {
        List<String> problems = new ArrayList<>();
        Map<String, Object> payload = new LinkedHashMap<>();

        for (PayloadSchema.Field field : schema.fields()) {
            String path = prefix + field.id();
            switch (field.type()) {
                case ARRAY -> {
                    try {
                        List<Object> value =
                                renderElements(templates, field.itemsFrom(), field.child(), context, path + ".");
                        if (!value.isEmpty() || field.required()) {
                            payload.put(field.id(), value);
                        }
                    } catch (PayloadRenderException e) {
                        problems.addAll(e.problems());
                    }
                }
                case OBJECT -> {
                    try {
                        Map<String, Object> value = renderObject(templates, field.child(), context, path + ".");
                        if (!value.isEmpty() || field.required()) {
                            payload.put(field.id(), value);
                        }
                    } catch (PayloadRenderException e) {
                        problems.addAll(e.problems());
                    }
                }
                default -> renderScalar(payload, problems, field, field.id(), path, templates, context);
            }
        }

        if (prefix.isEmpty()) {
            for (String key : templates.keySet()) {
                if (!key.contains(".") && schema.field(key) == null) {
                    renderScalar(payload, problems, null, key, key, templates, context);
                }
            }
        }

        if (!problems.isEmpty()) {
            throw new PayloadRenderException(problems);
        }
        return payload;
    }

    /**
     * Renders an array node: one object per element of the {@code itemsFrom} context collection,
     * with that element bound under the collection's own name so an item template
     * ({@code {{content.mediaId}}}) reads this element. Used for a top-level array body and for a
     * nested array field alike.
     */
    private List<Object> renderElements(Map<String, String> templates, String itemsFrom,
            PayloadSchema itemSchema, Map<String, Object> context, String prefix) {
        Object collection = resolveCollection(context, itemsFrom);
        if (collection == null) {
            // Nothing to report is a valid empty array, not a fault. In practice the producer
            // skips emitting at all in this case; rendering stays total regardless.
            return List.of();
        }
        if (!(collection instanceof List<?> elements)) {
            throw new PayloadRenderException(List.of(
                    "context '" + itemsFrom + "' must be an array to render an array body"));
        }

        String bindName = lastSegment(itemsFrom);
        List<Object> rendered = new ArrayList<>(elements.size());
        List<String> problems = new ArrayList<>();
        for (int i = 0; i < elements.size(); i++) {
            if (!(elements.get(i) instanceof Map<?, ?> element)) {
                problems.add(itemsFrom + "[" + i + "] is not an object");
                continue;
            }
            Map<String, Object> itemContext = new LinkedHashMap<>(context);
            @SuppressWarnings("unchecked")
            Map<String, Object> asMap = (Map<String, Object>) element;
            itemContext.put(bindName, asMap);
            try {
                rendered.add(renderObject(templates, itemSchema, itemContext, prefix));
            } catch (PayloadRenderException e) {
                int index = i;
                e.problems().forEach(problem -> problems.add(itemsFrom + "[" + index + "]: " + problem));
            }
        }
        if (!problems.isEmpty()) {
            throw new PayloadRenderException(problems);
        }
        return rendered;
    }

    /**
     * Renders one scalar field into {@code payload} under {@code jsonKey}, looking its template
     * up by {@code templateKey} (the dotted path) and reporting problems against that same key.
     * A null {@code field} is an undeclared passthrough, sent as text.
     */
    private void renderScalar(Map<String, Object> payload, List<String> problems,
            PayloadSchema.Field field, String jsonKey, String templateKey,
            Map<String, String> templates, Map<String, Object> context) {
        boolean required = field != null && field.required();
        String template = templates.get(templateKey);

        if (template == null || template.isBlank()) {
            if (required) {
                problems.add("'" + templateKey + "' is required but has no mapping");
            }
            return;
        }

        String rendered;
        try {
            rendered = PayloadTemplate.render(template, context);
        } catch (TemplateSyntaxException e) {
            // Save-time validation should have caught this; a stored binding can still be
            // older than the validator, so fail loudly instead of sending the raw template.
            problems.add("'" + templateKey + "' has an invalid template: " + e.getMessage());
            return;
        }

        if (rendered.isEmpty()) {
            if (required) {
                problems.add("'" + templateKey + "' is required but its mapping produced no value");
            }
            return;
        }

        PayloadSchema.FieldType type = field == null ? PayloadSchema.FieldType.STRING : field.type();
        try {
            payload.put(jsonKey, coerce(template, rendered, type, context));
        } catch (IllegalArgumentException e) {
            problems.add("'" + templateKey + "' expects " + type.name().toLowerCase()
                    + " but produced " + excerpt(rendered));
        }
    }

    /** The required scalar leaves of a schema, as the dotted paths they are mapped under. */
    private static List<String> requiredLeafPaths(PayloadSchema schema, String prefix) {
        List<String> paths = new ArrayList<>();
        for (PayloadSchema.Field field : schema.fields()) {
            String path = prefix + field.id();
            if (field.structural()) {
                if (field.child() != null) {
                    paths.addAll(requiredLeafPaths(field.child(), path + "."));
                }
            } else if (field.required()) {
                paths.add(path);
            }
        }
        return paths;
    }

    /** Resolves a (possibly dotted) context path to the collection an array field iterates. */
    private static Object resolveCollection(Map<String, Object> context, String itemsFrom) {
        if (itemsFrom == null || itemsFrom.isBlank()) {
            return null;
        }
        Object current = context;
        for (String segment : itemsFrom.split("\\.")) {
            if (!(current instanceof Map<?, ?> map)) {
                return null;
            }
            current = map.get(segment);
            if (current == null) {
                return null;
            }
        }
        return current;
    }

    private static String lastSegment(String itemsFrom) {
        int dot = itemsFrom.lastIndexOf('.');
        return dot < 0 ? itemsFrom : itemsFrom.substring(dot + 1);
    }

    private static Object coerce(
            String template, String rendered, PayloadSchema.FieldType type, Map<String, Object> context) {
        if (type == PayloadSchema.FieldType.STRING) {
            return rendered;
        }
        // A lone variable already holds a typed value; prefer it over re-parsing its text.
        if (PayloadTemplate.isSingleVariable(template)) {
            Object raw = PayloadTemplate.resolve(
                    PayloadTemplate.parse(template).get(0).text(), context);
            if (raw instanceof Boolean && type == PayloadSchema.FieldType.BOOLEAN) {
                return raw;
            }
            if (raw instanceof Number number) {
                return type == PayloadSchema.FieldType.INTEGER ? number.longValue() : raw;
            }
        }
        String text = rendered.trim();
        return switch (type) {
            case BOOLEAN -> toBoolean(text);
            case INTEGER -> Long.valueOf(text);
            case NUMBER -> new BigDecimal(text);
            // STRING is handled above; OBJECT/ARRAY never reach coerce (they expand structurally).
            default -> rendered;
        };
    }

    /**
     * Accepts only the forms a partner would recognize. Being lenient here (treating any
     * non-empty string as true, say) would turn a mapping mistake into a wrong verdict.
     */
    private static Boolean toBoolean(String text) {
        return switch (text.toLowerCase()) {
            case "true", "1" -> Boolean.TRUE;
            case "false", "0" -> Boolean.FALSE;
            default -> throw new IllegalArgumentException(text);
        };
    }

    /** Values are business data, not secrets, but an error line is no place for a whole document. */
    private static String excerpt(String value) {
        String text = value.strip();
        return "'" + (text.length() <= 60 ? text : text.substring(0, 60) + "…") + "'";
    }

    private static Map<String, String> safeTemplates(Map<String, String> templates) {
        return templates == null ? Map.of() : templates;
    }

    private static Map<String, Object> safeContext(Map<String, Object> context) {
        return context == null ? Map.of() : context;
    }
}
