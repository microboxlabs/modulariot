package com.microboxlabs.miot.core.mail;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.mail.MailTemplateEngine.Rendered;
import com.microboxlabs.miot.core.mail.MailTemplates.SaveTemplateRequest;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

class MailTemplatesTest {

    private static final String LINK = "https://app.example.test/app/es/invite/abc";

    private final MailTemplates templates = new MailTemplates(Optional.of("https://app.example.test/app/"));

    @Test
    void theBuiltInTemplateShowsTheLogoTheNamesAndTheLink() {
        Rendered rendered = templates.builtIn("es", Map.of("organization", "<b>Acme</b> & Co",
                "inviter", "admin@example.test", "email", "ana@example.test", "link", LINK,
                "expiresAt", "5 de noviembre de 2026"));

        assertEquals("Te invitaron a <b>Acme</b> & Co", rendered.subject());
        assertTrue(rendered.html().contains(
                "src=\"https://app.example.test/app/email/modulariot-logo.png\""), rendered.html());
        assertTrue(rendered.html().contains("&lt;b&gt;Acme&lt;/b&gt; &amp; Co"));
        assertTrue(rendered.html().contains("href=\"" + LINK + "\""));
        assertTrue(rendered.text().contains("admin@example.test te invitó a unirte a <b>Acme</b> & Co."),
                rendered.text());
        assertTrue(rendered.text().contains("Aceptar la invitación (" + LINK + ")"), rendered.text());
        assertTrue(rendered.text().contains("La invitación vence el 5 de noviembre de 2026."));
    }

    @Test
    void theEnglishTemplate() {
        Rendered rendered = templates.builtIn("en", Map.of("organization", "Acme", "inviter", "admin@example.test",
                "email", "ana@example.test", "link", LINK, "expiresAt", "November 5, 2026"));

        assertEquals("You're invited to Acme", rendered.subject());
        assertTrue(rendered.text().contains("admin@example.test invited you to join Acme."), rendered.text());
    }

    @Test
    void thePreviewNeedsTheLink() {
        SaveTemplateRequest withoutLink = new SaveTemplateRequest("Hola", "<p>{{organization}}</p>");
        IllegalArgumentException e = assertThrows(IllegalArgumentException.class,
                () -> templates.preview(MailTemplates.INVITATION, "es", withoutLink, "Acme"));
        assertTrue(e.getMessage().contains("{{link}}"));

        var preview = templates.preview(MailTemplates.INVITATION, "es",
                new SaveTemplateRequest("Hola {{organization}}", "{{link}}"), "Acme");
        assertEquals("Hola Acme", preview.subject());
    }

    @Test
    void theLinkHasToComeFromTheTemplateAndBeVisible() {
        SaveTemplateRequest pasted = new SaveTemplateRequest("s", "https://example.com/es/invite/sample-token");
        SaveTemplateRequest hidden = new SaveTemplateRequest("s", "<!-- {{link}} -->");
        assertThrows(IllegalArgumentException.class,
                () -> templates.preview(MailTemplates.INVITATION, "es", pasted, null));
        assertThrows(IllegalArgumentException.class,
                () -> templates.preview(MailTemplates.INVITATION, "es", hidden, null));
    }

    @Test
    void unknownKindsAndLanguagesAreRefused() {
        SaveTemplateRequest request = new SaveTemplateRequest("s", "{{link}}");
        assertThrows(IllegalArgumentException.class, () -> templates.preview("welcome", "es", request, null));
        assertThrows(IllegalArgumentException.class,
                () -> templates.preview(MailTemplates.INVITATION, "fr", request, null));
    }

    @Test
    void withoutAPublicUrlThereIsNoLogo() {
        assertEquals("", new MailTemplates(Optional.empty()).logoUrl());
        assertEquals("https://x.test/app/email/modulariot-logo.png",
                new MailTemplates(Optional.of("https://x.test/app")).logoUrl());
    }

    @Test
    void datesAreWrittenInTheLanguage() {
        Instant date = Instant.parse("2026-11-05T12:00:00Z");
        assertEquals("5 de noviembre de 2026", MailTemplates.date("es", date));
        assertEquals("November 5, 2026", MailTemplates.date("en", date));
    }
}
