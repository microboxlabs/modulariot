package com.microboxlabs.miot.integrations.template;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class PayloadTemplateTest {

    private static final Map<String, Object> CONTEXT = Map.of(
            "task", Map.of("serviceCode", "SRV-1", "priority", "UR"),
            "content", Map.of("mediaId", "19f8-a8ad"),
            "review", Map.of("verdict", false, "comment", "Falta señalética"),
            "session", Map.of("user", "revisor.demo"));

    @Test
    void substitutesAVariableWithItsContextValue() {
        assertEquals("19f8-a8ad", PayloadTemplate.render("{{content.mediaId}}", CONTEXT));
    }

    @Test
    void interpolatesVariablesInsideLiteralText() {
        assertEquals("svc SRV-1 / UR",
                PayloadTemplate.render("svc {{task.serviceCode}} / {{task.priority}}", CONTEXT));
    }

    @Test
    void toleratesWhitespaceAroundThePath() {
        assertEquals("SRV-1", PayloadTemplate.render("{{  task.serviceCode  }}", CONTEXT));
    }

    @Test
    void aMissingVariableRendersEmptyRatherThanLeakingTheTemplate() {
        assertEquals("", PayloadTemplate.render("{{task.doesNotExist}}", CONTEXT));
        assertEquals("a-b", PayloadTemplate.render("a{{task.nope}}-b", CONTEXT));
    }

    @Test
    void rendersNonStringValuesViaTheirTextForm() {
        assertEquals("false", PayloadTemplate.render("{{review.verdict}}", CONTEXT));
    }

    @Test
    void anEmptyTemplateRendersEmpty() {
        assertEquals("", PayloadTemplate.render("", CONTEXT));
        assertEquals("", PayloadTemplate.render(null, CONTEXT));
    }

    @Test
    void literalTextWithoutVariablesPassesThrough() {
        assertEquals("plain text", PayloadTemplate.render("plain text", CONTEXT));
    }

    /* ---- the parity guarantee: anything the UI's Handlebars would treat differently ---- */

    @Test
    void rejectsBlockHelpers() {
        assertThrows(TemplateSyntaxException.class,
                () -> PayloadTemplate.validate("{{#if review.verdict}}si{{/if}}",
                        PayloadTemplate.DEFAULT_ROOTS));
    }

    @Test
    void rejectsHelperCalls() {
        TemplateSyntaxException failure = assertThrows(TemplateSyntaxException.class,
                () -> PayloadTemplate.validate("{{formatDate review.reviewedAt}}",
                        PayloadTemplate.DEFAULT_ROOTS));
        assertTrue(failure.getMessage().contains("helper"), failure.getMessage());
    }

    @Test
    void rejectsPartialsCommentsAndUnescapedStashes() {
        for (String template : new String[] {"{{> part}}", "{{! note}}", "{{&raw}}", "{{^inv}}x{{/inv}}"}) {
            assertThrows(TemplateSyntaxException.class,
                    () -> PayloadTemplate.validate(template, PayloadTemplate.DEFAULT_ROOTS),
                    "should reject " + template);
        }
        assertThrows(TemplateSyntaxException.class,
                () -> PayloadTemplate.validate("{{{task.serviceCode}}}", PayloadTemplate.DEFAULT_ROOTS));
    }

    @Test
    void rejectsAnUnclosedVariable() {
        assertThrows(TemplateSyntaxException.class,
                () -> PayloadTemplate.validate("{{task.serviceCode", PayloadTemplate.DEFAULT_ROOTS));
    }

    @Test
    void rejectsAnUnknownVariableRoot() {
        TemplateSyntaxException failure = assertThrows(TemplateSyntaxException.class,
                () -> PayloadTemplate.validate("{{invoice.total}}", PayloadTemplate.DEFAULT_ROOTS));
        assertTrue(failure.getMessage().contains("invoice"), failure.getMessage());
    }

    @Test
    void rejectsAWholeObjectReference() {
        // {{task}} would stringify a Map into the payload — a half-typed path, not an intent.
        assertThrows(TemplateSyntaxException.class,
                () -> PayloadTemplate.validate("{{task}}", PayloadTemplate.DEFAULT_ROOTS));
    }

    @Test
    void rejectsMalformedPaths() {
        for (String bad : new String[] {"{{.task}}", "{{task.}}", "{{task..code}}", "{{}}"}) {
            assertThrows(TemplateSyntaxException.class,
                    () -> PayloadTemplate.validate(bad, PayloadTemplate.DEFAULT_ROOTS),
                    "should reject " + bad);
        }
    }

    @Test
    void acceptsAndReportsTheVariablesItReads() {
        Set<String> paths = PayloadTemplate.validate(
                "{{task.serviceCode}} {{review.comment}}", PayloadTemplate.DEFAULT_ROOTS);

        assertEquals(Set.of("task.serviceCode", "review.comment"), paths);
    }

    @Test
    void recognizesASingleVariableTemplate() {
        assertTrue(PayloadTemplate.isSingleVariable("{{review.verdict}}"));
        assertTrue(PayloadTemplate.isSingleVariable("  {{review.verdict}}  ".trim()));
        assertFalse(PayloadTemplate.isSingleVariable("x {{review.verdict}}"));
        assertFalse(PayloadTemplate.isSingleVariable("{{a.b}}{{c.d}}"));
    }

    @Test
    void resolveReturnsTheRawTypedValue() {
        assertEquals(Boolean.FALSE, PayloadTemplate.resolve("review.verdict", CONTEXT));
        assertEquals("SRV-1", PayloadTemplate.resolve("task.serviceCode", CONTEXT));
        assertEquals(null, PayloadTemplate.resolve("task.missing", CONTEXT));
        assertEquals(null, PayloadTemplate.resolve("task.serviceCode.deeper", CONTEXT));
    }
}
