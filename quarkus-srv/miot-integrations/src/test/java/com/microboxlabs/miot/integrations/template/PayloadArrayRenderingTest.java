package com.microboxlabs.miot.integrations.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Array bodies: a review that covers several media reports one element per media, each keyed
 * by its own {@code mediaId} — the shape the Dev-Mentor callback expects.
 */
class PayloadArrayRenderingTest {

    private final PayloadRenderer renderer = new PayloadRenderer();

    /** {@code type: array}, three item fields, two required — as stored in request_schema. */
    private static PayloadSchema arraySchema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("guidMultimedia", Map.of("type", "string"));
        properties.put("aprobado", Map.of("type", "boolean"));
        properties.put("mensaje", Map.of("type", "string"));
        return PayloadSchema.of(Map.of(
                "type", "array",
                "itemsFrom", "content",
                "items", Map.of(
                        "type", "object",
                        "properties", properties,
                        "required", List.of("guidMultimedia", "aprobado"))));
    }

    private static final Map<String, String> TEMPLATES = Map.of(
            "guidMultimedia", "{{content.mediaId}}",
            "aprobado", "{{content.verdict}}",
            "mensaje", "{{content.comment}}",
            "servicio", "{{task.serviceCode}}");

    private static Map<String, Object> contextWith(List<Map<String, Object>> content) {
        return Map.of("task", Map.of("serviceCode", "1625094"), "content", content);
    }

    @Test
    void detectsAnArrayContractAndItsItemFields() {
        PayloadSchema schema = arraySchema();
        assertTrue(schema.array());
        assertEquals("content", schema.itemsFrom());
        // The declared fields are the item fields — what the drawer maps and validation checks.
        assertEquals(List.of("guidMultimedia", "aprobado"),
                schema.requiredFields().stream().map(PayloadSchema.Field::id).toList());
    }

    @Test
    void rendersOneObjectPerContentElement() {
        Object body = renderer.renderBody(TEMPLATES, arraySchema(), contextWith(List.of(
                mediaItem("19f8-a8ad", true, ""),
                mediaItem("77bc-1e20", false, "Foto borrosa"))));

        List<?> array = assertInstanceOf(List.class, body);
        assertEquals(2, array.size());

        Map<?, ?> first = (Map<?, ?>) array.get(0);
        assertEquals("19f8-a8ad", first.get("guidMultimedia"));
        assertEquals(Boolean.TRUE, first.get("aprobado"));
        assertEquals("1625094", first.get("servicio"));   // a shared root stays visible per element
        assertFalse(first.containsKey("mensaje"), "an empty optional is omitted, not sent blank");

        Map<?, ?> second = (Map<?, ?>) array.get(1);
        assertEquals(Boolean.FALSE, second.get("aprobado"));
        assertEquals("Foto borrosa", second.get("mensaje"));
    }

    @Test
    void namesTheOffendingElementWhenARequiredItemFieldIsMissing() {
        Map<String, Object> noMediaId = new LinkedHashMap<>();
        noMediaId.put("verdict", true);
        PayloadRenderException e = assertThrows(PayloadRenderException.class, () ->
                renderer.renderBody(TEMPLATES, arraySchema(), contextWith(List.of(
                        mediaItem("ok-1", true, ""), noMediaId))));
        assertTrue(e.problems().stream().anyMatch(p -> p.contains("content[1]")),
                "expected the failure to point at content[1], got " + e.problems());
    }

    @Test
    void rejectsAContextCollectionThatIsNotAnArray() {
        Map<String, Object> context = Map.of("content", Map.of("mediaId", "x"));
        assertThrows(PayloadRenderException.class, () ->
                renderer.renderBody(TEMPLATES, arraySchema(), context));
    }

    @Test
    void anObjectContractStillRendersASingleObject() {
        PayloadSchema object = PayloadSchema.of(Map.of(
                "type", "object",
                "properties", Map.of("guidMultimedia", Map.of("type", "string"))));
        Object body = renderer.renderBody(
                Map.of("guidMultimedia", "{{content.mediaId}}"),
                object,
                Map.of("content", Map.of("mediaId", "single")));
        Map<?, ?> map = assertInstanceOf(Map.class, body);
        assertEquals("single", map.get("guidMultimedia"));
    }

    private static Map<String, Object> mediaItem(String mediaId, boolean verdict, String comment) {
        Map<String, Object> item = new LinkedHashMap<>();
        item.put("mediaId", mediaId);
        item.put("verdict", verdict);
        item.put("comment", comment);
        return item;
    }
}
