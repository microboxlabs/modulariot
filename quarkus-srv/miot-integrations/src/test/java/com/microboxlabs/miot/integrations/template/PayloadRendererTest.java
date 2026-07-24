package com.microboxlabs.miot.integrations.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.math.BigDecimal;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class PayloadRendererTest {

    private final PayloadRenderer renderer = new PayloadRenderer();

    private static final Map<String, Object> CONTEXT = Map.of(
            "task", Map.of("serviceCode", "SRV-1"),
            "content", Map.of("mediaId", "19f8-a8ad"),
            "review", Map.of("verdict", false, "comment", "", "score", 7),
            "session", Map.of("user", "revisor.demo"));

    /** The partner contract as it would be stored in integration_operations.request_schema. */
    private static PayloadSchema schema() {
        Map<String, Object> properties = new LinkedHashMap<>();
        properties.put("guidMultimedia", Map.of("type", "string"));
        properties.put("aprobado", Map.of("type", "boolean"));
        properties.put("mensaje", Map.of("type", "string"));
        properties.put("intentos", Map.of("type", "integer"));
        return PayloadSchema.of(Map.of(
                "type", "object",
                "properties", properties,
                "required", List.of("guidMultimedia", "aprobado")));
    }

    @Test
    void buildsThePayloadFromTheMappedTemplates() {
        Map<String, Object> payload = renderer.render(Map.of(
                "guidMultimedia", "{{content.mediaId}}",
                "aprobado", "{{review.verdict}}"), schema(), CONTEXT);

        assertEquals("19f8-a8ad", payload.get("guidMultimedia"));
        assertEquals(Boolean.FALSE, payload.get("aprobado"));
    }

    @Test
    void aBooleanFieldLeavesAsJsonBooleanNotAString() {
        Map<String, Object> payload = renderer.render(Map.of(
                "guidMultimedia", "{{content.mediaId}}",
                "aprobado", "{{review.verdict}}"), schema(), CONTEXT);

        assertTrue(payload.get("aprobado") instanceof Boolean,
                "aprobado was " + payload.get("aprobado").getClass());
    }

    @Test
    void coercesTextFormsOfBooleansToo() {
        Map<String, Object> payload = renderer.render(Map.of(
                "guidMultimedia", "x", "aprobado", "true"), schema(), CONTEXT);
        assertEquals(Boolean.TRUE, payload.get("aprobado"));

        payload = renderer.render(Map.of("guidMultimedia", "x", "aprobado", "0"), schema(), CONTEXT);
        assertEquals(Boolean.FALSE, payload.get("aprobado"));
    }

    @Test
    void refusesAValueThatIsNotRecognizablyBoolean() {
        // Treating any non-empty string as true would turn a mapping slip into a wrong verdict.
        PayloadRenderException failure = assertThrows(PayloadRenderException.class,
                () -> renderer.render(Map.of(
                        "guidMultimedia", "x", "aprobado", "quizás"), schema(), CONTEXT));

        assertTrue(failure.getMessage().contains("aprobado"), failure.getMessage());
        assertTrue(failure.getMessage().contains("boolean"), failure.getMessage());
    }

    @Test
    void coercesIntegersAndKeepsNumericTypesFromContext() {
        Map<String, Object> payload = renderer.render(Map.of(
                "guidMultimedia", "x", "aprobado", "true", "intentos", "{{review.score}}"),
                schema(), CONTEXT);

        assertEquals(7L, payload.get("intentos"));
    }

    @Test
    void anEmptyOptionalFieldIsOmittedRatherThanSentBlank() {
        // review.comment is "" — most partners treat an absent key and "" differently.
        Map<String, Object> payload = renderer.render(Map.of(
                "guidMultimedia", "{{content.mediaId}}",
                "aprobado", "{{review.verdict}}",
                "mensaje", "{{review.comment}}"), schema(), CONTEXT);

        assertFalse(payload.containsKey("mensaje"), "empty optional field should be omitted");
    }

    @Test
    void anEmptyRequiredFieldIsAnErrorNotABlankWrite() {
        PayloadRenderException failure = assertThrows(PayloadRenderException.class,
                () -> renderer.render(Map.of(
                        "guidMultimedia", "{{task.missing}}",
                        "aprobado", "{{review.verdict}}"), schema(), CONTEXT));

        assertTrue(failure.getMessage().contains("guidMultimedia"), failure.getMessage());
    }

    @Test
    void anUnmappedRequiredFieldIsAnError() {
        PayloadRenderException failure = assertThrows(PayloadRenderException.class,
                () -> renderer.render(Map.of("aprobado", "{{review.verdict}}"), schema(), CONTEXT));

        assertTrue(failure.getMessage().contains("guidMultimedia"), failure.getMessage());
    }

    @Test
    void reportsEveryProblemAtOnce() {
        PayloadRenderException failure = assertThrows(PayloadRenderException.class,
                () -> renderer.render(Map.of("aprobado", "nope"), schema(), CONTEXT));

        // Both the missing required field and the bad boolean, in one pass.
        assertEquals(2, failure.problems().size(), failure.getMessage());
    }

    @Test
    void anUndeclaredMappedFieldIsSentAsText() {
        Map<String, Object> payload = renderer.render(Map.of(
                "guidMultimedia", "x", "aprobado", "true",
                "extraCampo", "{{session.user}}"), schema(), CONTEXT);

        assertEquals("revisor.demo", payload.get("extraCampo"));
    }

    @Test
    void withoutASchemaEverythingIsSentAsText() {
        Map<String, Object> payload = renderer.render(
                Map.of("anything", "{{review.verdict}}"), PayloadSchema.empty(), CONTEXT);

        assertEquals("false", payload.get("anything"));
    }

    @Test
    void declaredFieldsKeepContractOrder() {
        Map<String, Object> payload = renderer.render(Map.of(
                "mensaje", "hola", "aprobado", "true", "guidMultimedia", "x"), schema(), CONTEXT);

        assertEquals(List.of("guidMultimedia", "aprobado", "mensaje"),
                List.copyOf(payload.keySet()));
    }

    /* ---- save-time validation ---- */

    @Test
    void validateAcceptsACompleteMapping() {
        List<String> problems = renderer.validate(Map.of(
                "guidMultimedia", "{{content.mediaId}}",
                "aprobado", "{{review.verdict}}"), schema(), PayloadTemplate.DEFAULT_ROOTS);

        assertTrue(problems.isEmpty(), problems.toString());
    }

    @Test
    void validateFlagsMissingRequiredFieldsAndBadSyntax() {
        List<String> problems = renderer.validate(Map.of(
                "aprobado", "{{#if review.verdict}}si{{/if}}"), schema(), PayloadTemplate.DEFAULT_ROOTS);

        assertEquals(2, problems.size(), problems.toString());
        assertTrue(problems.toString().contains("guidMultimedia"), problems.toString());
        assertTrue(problems.toString().contains("aprobado"), problems.toString());
    }

    @Test
    void validateFlagsAnUnknownVariableRoot() {
        List<String> problems = renderer.validate(Map.of(
                "guidMultimedia", "{{invoice.total}}",
                "aprobado", "true"), schema(), PayloadTemplate.DEFAULT_ROOTS);

        assertEquals(1, problems.size(), problems.toString());
        assertTrue(problems.get(0).contains("invoice"), problems.toString());
    }

    @Test
    void numberFieldsKeepDecimalPrecision() {
        PayloadSchema numeric = PayloadSchema.of(Map.of(
                "type", "object",
                "properties", Map.of("monto", Map.of("type", "number"))));

        Map<String, Object> payload = renderer.render(Map.of("monto", "10.50"), numeric, CONTEXT);

        assertEquals(new BigDecimal("10.50"), payload.get("monto"));
    }
}
