package com.microboxlabs.miot.core.mail;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.mail.MailTemplateEngine.Rendered;
import java.util.Map;
import org.junit.jupiter.api.Test;

class MailTemplateEngineTest {

    private final MailTemplateEngine engine = new MailTemplateEngine();

    @Test
    void valuesAreEscapedInTheBodyButNotInTheSubject() {
        Rendered rendered = engine.render("Te invitaron a {{organization}}", "<p>{{organization}}</p>",
                Map.of("organization", "<b>Acme</b> & Co"));

        assertEquals("Te invitaron a <b>Acme</b> & Co", rendered.subject());
        assertEquals("<p>&lt;b&gt;Acme&lt;/b&gt; &amp; Co</p>", rendered.html());
        assertEquals("<b>Acme</b> & Co\n", rendered.text());
    }

    @Test
    void theSubjectIsOneLine() {
        Rendered rendered = engine.render("Hola\n  {{organization}}\r\n", "x", Map.of("organization", "Acme"));

        assertEquals("Hola Acme", rendered.subject());
    }

    @Test
    void blocksWorkAndUnknownValuesAreEmpty() {
        Rendered rendered = engine.render("s", "{{#if inviter}}by {{inviter}}{{/if}}[{{missing}}]",
                Map.of("inviter", "Ana"));

        assertEquals("by Ana[]", rendered.html());
    }

    @Test
    void templatesCannotCallMethodsOnValues() {
        Rendered rendered = engine.render("s", "[{{organization.bytes}}][{{organization.class}}]",
                Map.of("organization", "Acme"));

        assertEquals("[][]", rendered.html());
    }

    @Test
    void partialsAndFileHelpersAreRefused() {
        Map<String, String> values = Map.of();
        assertThrows(IllegalArgumentException.class, () -> engine.render("s", "{{> header}}", values));
        assertThrows(IllegalArgumentException.class, () -> engine.render("s", "{{embedded \"x\"}}", values));
        assertThrows(IllegalArgumentException.class, () -> engine.render("s", "{{precompile \"x\"}}", values));
    }

    @Test
    void valuesCannotBeWrittenUnescapedInTheBody() {
        Map<String, String> values = Map.of("organization", "<b>x</b>");
        assertThrows(IllegalArgumentException.class, () -> engine.render("s", "{{{organization}}}", values));
        assertThrows(IllegalArgumentException.class, () -> engine.render("s", "{{& organization}}", values));
        assertEquals("<b>x</b>", engine.render("{{{organization}}}", "x", values).subject());
    }

    @Test
    void inlinePartialsAreRefused() {
        Map<String, String> values = Map.of();
        assertThrows(IllegalArgumentException.class,
                () -> engine.render("s", "{{#*inline \"a\"}}x{{/inline}}{{> a}}", values));
    }

    @Test
    void theOutputIsCapped() {
        String big = "x".repeat(MailTemplateEngine.MAX_OUTPUT / 4);
        Map<String, String> values = Map.of("big", big);
        assertThrows(IllegalArgumentException.class,
                () -> engine.render("s", "{{big}}{{big}}{{big}}{{big}}{{big}}", values));
    }

    @Test
    void aTemplateThatDoesNotParseIsRefused() {
        Map<String, String> values = Map.of();
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> engine.render("s", "{{#if x}}open", values));

        assertTrue(e.getMessage().startsWith("The body template is not valid"), e.getMessage());
    }
}
