package com.microboxlabs.miot.integrations.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertInstanceOf;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Nested bodies: a partner's photo-verdict contract is an object envelope ({@code serviceCode},
 * an overall {@code aprobada}, {@code username}) wrapping a {@code fotos} array, and each foto may
 * carry its own {@code mensaje} array of reason objects. This proves the renderer builds that whole
 * shape from one flat template map keyed by dotted path — including the deepest {@code mensaje}
 * nesting, so once the producer supplies per-photo reasons no further renderer work is needed.
 *
 * <p>Doubles as the executable spec of the mapping an operator fills in, which is why the template
 * map below is the literal set of rows the settings drawer shows.
 */
class PayloadNestedRenderingTest {

    private final PayloadRenderer renderer = new PayloadRenderer();

    /** The request_schema as it would be stored for the partner's operation. */
    private static PayloadSchema partnerSchema() {
        Map<String, Object> reasonProps = new LinkedHashMap<>();
        reasonProps.put("codigo", Map.of("type", "string"));
        reasonProps.put("nombre", Map.of("type", "string"));
        Map<String, Object> mensaje = Map.of(
                "type", "array",
                "itemsFrom", "content.reasons",
                "items", Map.of("type", "object", "properties", reasonProps,
                        "required", List.of("codigo", "nombre")));

        Map<String, Object> fotoProps = new LinkedHashMap<>();
        fotoProps.put("guidMultimedia", Map.of("type", "string"));
        fotoProps.put("aprobada", Map.of("type", "boolean"));
        fotoProps.put("mensaje", mensaje);
        Map<String, Object> fotos = Map.of(
                "type", "array",
                "itemsFrom", "content",
                "items", Map.of("type", "object", "properties", fotoProps,
                        "required", List.of("guidMultimedia", "aprobada")));

        Map<String, Object> envelope = new LinkedHashMap<>();
        envelope.put("serviceCode", Map.of("type", "string"));
        envelope.put("aprobada", Map.of("type", "boolean"));
        envelope.put("username", Map.of("type", "string"));
        envelope.put("fotos", fotos);
        return PayloadSchema.of(Map.of(
                "type", "object",
                "properties", envelope,
                "required", List.of("serviceCode", "aprobada", "username", "fotos")));
    }

    private static final Map<String, String> TEMPLATES = Map.ofEntries(
            Map.entry("serviceCode", "{{task.serviceCode}}"),
            Map.entry("aprobada", "{{task.approved}}"),
            Map.entry("username", "{{session.reviewer}}"),
            Map.entry("fotos.guidMultimedia", "{{content.mediaId}}"),
            Map.entry("fotos.aprobada", "{{content.verdict}}"),
            Map.entry("fotos.mensaje.codigo", "{{reasons.codigo}}"),
            Map.entry("fotos.mensaje.nombre", "{{reasons.nombre}}"));

    @Test
    void schemaParsesTheEnvelopeAndItsNestedArrayAndObjectFields() {
        PayloadSchema schema = partnerSchema();
        assertFalse(schema.array(), "the envelope is an object, not a top-level array");

        PayloadSchema.Field fotos = schema.field("fotos");
        assertEquals(PayloadSchema.FieldType.ARRAY, fotos.type());
        assertEquals("content", fotos.itemsFrom());

        PayloadSchema.Field mensaje = fotos.child().field("mensaje");
        assertEquals(PayloadSchema.FieldType.ARRAY, mensaje.type());
        assertEquals("content.reasons", mensaje.itemsFrom());
        assertEquals(List.of("codigo", "nombre"),
                mensaje.child().fields().stream().map(PayloadSchema.Field::id).toList());
    }

    @Test
    void buildsTheFullEnvelopeWithFotosAndPerPhotoReasons() {
        Object body = renderer.renderBody(TEMPLATES, partnerSchema(), context());

        Map<?, ?> envelope = assertInstanceOf(Map.class, body);
        assertEquals("1656793", envelope.get("serviceCode"));
        assertEquals(Boolean.FALSE, envelope.get("aprobada"), "overall verdict, from the envelope template");
        assertEquals("revisor.demo", envelope.get("username"));

        List<?> fotos = assertInstanceOf(List.class, envelope.get("fotos"));
        assertEquals(2, fotos.size());

        // Approved photo: its per-photo verdict wins over the reused leaf name, and with no
        // reasons the optional mensaje array is omitted, not sent empty.
        Map<?, ?> approved = (Map<?, ?>) fotos.get(0);
        assertEquals("g1", approved.get("guidMultimedia"));
        assertEquals(Boolean.TRUE, approved.get("aprobada"));
        assertFalse(approved.containsKey("mensaje"), "no reasons → no mensaje key");

        // Rejected photo: mensaje is an array of {codigo, nombre} reason objects.
        Map<?, ?> rejected = (Map<?, ?>) fotos.get(1);
        assertEquals("g2", rejected.get("guidMultimedia"));
        assertEquals(Boolean.FALSE, rejected.get("aprobada"));
        List<?> mensaje = assertInstanceOf(List.class, rejected.get("mensaje"));
        assertEquals(1, mensaje.size());
        Map<?, ?> reason = (Map<?, ?>) mensaje.get(0);
        assertEquals("wrong_format", reason.get("codigo"));
        assertEquals("Formato incorrecto", reason.get("nombre"));
    }

    @Test
    void reusedLeafNameDoesNotCollideAcrossDepths() {
        // Both the envelope and each foto declare "aprobada"; the dotted template keys keep them
        // apart — the envelope's overall verdict must not be overwritten by a photo's.
        Object body = renderer.renderBody(TEMPLATES, partnerSchema(), context());
        Map<?, ?> envelope = (Map<?, ?>) body;

        assertEquals(Boolean.FALSE, envelope.get("aprobada"));
        List<?> fotos = (List<?>) envelope.get("fotos");
        assertEquals(Boolean.TRUE, ((Map<?, ?>) fotos.get(0)).get("aprobada"));
        assertTrue(((Map<?, ?>) fotos.get(1)).get("aprobada") == Boolean.FALSE);
    }

    @Test
    void leafFieldsAreTheDottedScalarMappingRowsTheUiRenders() {
        List<PayloadSchema.Field> leaves = partnerSchema().leafFields();

        // One editable row per value, in contract order — never the fotos/mensaje containers.
        assertEquals(
                List.of("serviceCode", "aprobada", "username",
                        "fotos.guidMultimedia", "fotos.aprobada",
                        "fotos.mensaje.codigo", "fotos.mensaje.nombre"),
                leaves.stream().map(PayloadSchema.Field::id).toList());
        // Every leaf is scalar (no ARRAY/OBJECT leaks to the type label the UI shows).
        assertTrue(leaves.stream().noneMatch(PayloadSchema.Field::structural));
        assertEquals(PayloadSchema.FieldType.BOOLEAN, leaf(leaves, "fotos.aprobada").type());
        assertTrue(leaf(leaves, "fotos.mensaje.codigo").required());
    }

    @Test
    void leavesCarryTheTemplateRootEachRowRendersUnder() {
        // What the drawer needs to hint the right variable per row: the dotted path alone cannot
        // reveal it, because the root comes from the array's itemsFrom.
        List<PayloadSchema.Leaf> leaves = partnerSchema().leaves();

        assertNull(rootOf(leaves, "serviceCode"), "an envelope row sees the whole context");
        assertNull(rootOf(leaves, "username"), "an envelope row sees the whole context");
        assertEquals("content", rootOf(leaves, "fotos.guidMultimedia"), "fotos iterates content");
        assertEquals("content", rootOf(leaves, "fotos.aprobada"));
        // The deepest rows read *this photo's* reasons, not a list across the task.
        assertEquals("reasons", rootOf(leaves, "fotos.mensaje.codigo"),
                "mensaje iterates content.reasons, bound as reasons");
        assertEquals("reasons", rootOf(leaves, "fotos.mensaje.nombre"));
    }

    @Test
    void arrayBindNamesAreTheExtraRootsTheContractIntroduces() {
        // The set the UI must also accept: validating against only the static roots would reject
        // {{reasons.*}}, which the server stores happily.
        assertEquals(List.of("content", "reasons"), partnerSchema().arrayBindNames());
    }

    @Test
    void aNestedArrayWithoutItemsFromSilentlyBindsToContent() {
        // The trap this contract exists to avoid, pinned so nobody "fixes" the default away
        // without knowing what it costs. A plain JSON Schema pasted by an operator carries no
        // itemsFrom, so `mensaje` falls back to `content` — the same root as its parent. The
        // payload still renders, but every reason row reads the photo rather than the photo's
        // reasons, and no `reasons` root is ever offered.
        Map<String, Object> mensaje = Map.of(
                "type", "array",
                "items", Map.of("type", "object", "properties",
                        Map.of("codigo", Map.of("type", "string"))));
        Map<String, Object> fotoProps = new LinkedHashMap<>();
        fotoProps.put("guidMultimedia", Map.of("type", "string"));
        fotoProps.put("mensaje", mensaje);
        PayloadSchema schema = PayloadSchema.of(Map.of(
                "type", "object",
                "properties", Map.of("fotos", Map.of(
                        "type", "array",
                        "items", Map.of("type", "object", "properties", fotoProps)))));

        assertEquals("content", rootOf(schema.leaves(), "fotos.mensaje.codigo"),
                "no itemsFrom → the nested array binds to content, not to the photo's reasons");
        assertEquals(List.of("content"), schema.arrayBindNames(),
                "so no reasons root is offered and {{reasons.*}} reads as unknown");
    }

    @Test
    void validateAcceptsTheDynamicPerElementArrayRoot() {
        // {{reasons.code}} reads a root bound only while rendering the content.reasons array — it
        // is derived from the schema, so save-time validation must accept it, not flag it.
        List<String> problems =
                renderer.validate(TEMPLATES, partnerSchema(), PayloadTemplate.DEFAULT_ROOTS);

        assertTrue(problems.isEmpty(), problems.toString());
    }

    private static PayloadSchema.Field leaf(List<PayloadSchema.Field> leaves, String id) {
        return leaves.stream().filter(field -> field.id().equals(id)).findFirst().orElseThrow();
    }

    private static String rootOf(List<PayloadSchema.Leaf> leaves, String id) {
        return leaves.stream()
                .filter(leaf -> leaf.id().equals(id))
                .findFirst()
                .orElseThrow()
                .contextRoot();
    }

    private static Map<String, Object> context() {
        Map<String, Object> approvedPhoto = new LinkedHashMap<>();
        approvedPhoto.put("mediaId", "g1");
        approvedPhoto.put("verdict", true);

        Map<String, Object> rejectedPhoto = new LinkedHashMap<>();
        rejectedPhoto.put("mediaId", "g2");
        rejectedPhoto.put("verdict", false);
        rejectedPhoto.put("reasons", List.of(
                Map.of("codigo", "wrong_format", "nombre", "Formato incorrecto")));

        Map<String, Object> context = new LinkedHashMap<>();
        context.put("task", Map.of("serviceCode", "1656793", "approved", false));
        context.put("session", Map.of("reviewer", "revisor.demo"));
        context.put("content", List.of(approvedPhoto, rejectedPhoto));
        return context;
    }
}
