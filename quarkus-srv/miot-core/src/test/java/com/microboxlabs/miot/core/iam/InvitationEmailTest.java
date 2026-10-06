package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.mail.Mail;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class InvitationEmailTest {

    private static final Instant EXPIRES = Instant.parse("2026-11-05T12:00:00Z");

    @Test
    void namesAreEscapedInTheHtmlButNotInTheText() {
        Mail mail = InvitationEmail.of("es", "ana@example.test", "<b>Acme</b> & Co", "admin@example.test",
                "https://app.example.test/app/es/invite/abc", EXPIRES);

        assertEquals("Te invitaron a <b>Acme</b> & Co", mail.subject());
        assertTrue(mail.text().contains("admin@example.test te invitó a unirte a <b>Acme</b> & Co."));
        assertTrue(mail.html().contains("&lt;b&gt;Acme&lt;/b&gt; &amp; Co"));
        assertFalse(mail.html().contains("<b>Acme</b>"));
        assertTrue(mail.html().contains("href=\"https://app.example.test/app/es/invite/abc\""));
    }

    @Test
    void englishAndTheExpiryDate() {
        Mail mail = InvitationEmail.of("en", "ana@example.test", "Acme", "admin@example.test", "https://x.test/l",
                EXPIRES);

        assertEquals("You're invited to Acme", mail.subject());
        assertTrue(mail.text().contains("November 5, 2026"), mail.text());
    }

    @Test
    void theLinkJoinsTheBaseLanguageAndToken() {
        assertEquals("https://x.test/app/en/invite/t1", InvitationMail.link("https://x.test/app/", "en", "t1"));
        assertEquals("https://x.test/app/es/invite/t1", InvitationMail.link("https://x.test/app", "es", "t1"));
    }
}
