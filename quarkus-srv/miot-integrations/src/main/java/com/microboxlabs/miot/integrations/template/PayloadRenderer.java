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
 * <p>Per field: render the template, coerce the result to the type the channel's
 * {@link PayloadSchema} declares, and decide whether an empty result may be sent. Every
 * problem is collected before throwing, so an operator sees a whole broken mapping at once
 * rather than one fault per attempt.
 *
 * <p>Two rules worth knowing:
 *
 * <ul>
 *   <li><b>An empty optional field is omitted, not sent blank.</b> Most partners treat an
 *       absent key and {@code ""} differently, and "no reviewer comment" means the former.
 *       An empty <i>required</i> field is an error — silently writing a blank into a
 *       required slot is worse than failing.
 *   <li><b>A template that is exactly one variable keeps the context value's own type.</b>
 *       {@code {{review.verdict}}} over a real boolean sends JSON {@code false}, not
 *       {@code "false"}, without depending on a string round-trip.
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
        Map<String, String> safeTemplates = templates == null ? Map.of() : templates;
        List<String> problems = new ArrayList<>();
        Map<String, Object> payload = new LinkedHashMap<>();

        for (String fieldId : fieldOrder(safeTemplates, schema)) {
            PayloadSchema.Field field = schema.field(fieldId);
            boolean required = field != null && field.required();
            String template = safeTemplates.get(fieldId);

            if (template == null || template.isBlank()) {
                if (required) {
                    problems.add("'" + fieldId + "' is required but has no mapping");
                }
                continue;
            }

            String rendered;
            try {
                rendered = PayloadTemplate.render(template, context);
            } catch (TemplateSyntaxException e) {
                // Save-time validation should have caught this; a stored binding can still be
                // older than the validator, so fail loudly instead of sending the raw template.
                problems.add("'" + fieldId + "' has an invalid template: " + e.getMessage());
                continue;
            }

            if (rendered.isEmpty()) {
                if (required) {
                    problems.add("'" + fieldId + "' is required but its mapping produced no value");
                }
                continue;
            }

            PayloadSchema.FieldType type = field == null ? PayloadSchema.FieldType.STRING : field.type();
            try {
                payload.put(fieldId, coerce(template, rendered, type, context));
            } catch (IllegalArgumentException e) {
                problems.add("'" + fieldId + "' expects " + type.name().toLowerCase()
                        + " but produced " + excerpt(rendered));
            }
        }

        if (!problems.isEmpty()) {
            throw new PayloadRenderException(problems);
        }
        return payload;
    }

    /**
     * Checks a mapping before it is stored: templates parse, read known variables, and cover
     * every required field.
     *
     * @return every problem found; empty when the mapping is storable
     */
    public List<String> validate(
            Map<String, String> templates, PayloadSchema schema, Set<String> allowedRoots) {
        Map<String, String> safeTemplates = templates == null ? Map.of() : templates;
        List<String> problems = new ArrayList<>();

        for (PayloadSchema.Field field : schema.requiredFields()) {
            String template = safeTemplates.get(field.id());
            if (template == null || template.isBlank()) {
                problems.add("'" + field.id() + "' is required but has no mapping");
            }
        }
        safeTemplates.forEach((fieldId, template) -> {
            if (template == null || template.isBlank()) {
                return;
            }
            try {
                PayloadTemplate.validate(template, allowedRoots);
            } catch (TemplateSyntaxException e) {
                problems.add("'" + fieldId + "': " + e.getMessage());
            }
        });
        return problems;
    }

    /**
     * Declared fields first, in contract order, then any mapped field the contract does not
     * declare — an operator may legitimately send an extra key a stale schema omits.
     */
    private static Set<String> fieldOrder(Map<String, String> templates, PayloadSchema schema) {
        Set<String> order = new LinkedHashSet<>();
        schema.fields().forEach(field -> order.add(field.id()));
        order.addAll(templates.keySet());
        return order;
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
            case STRING -> rendered;
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
}
