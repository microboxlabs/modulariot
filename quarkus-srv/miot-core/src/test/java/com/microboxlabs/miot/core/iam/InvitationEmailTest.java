package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class InvitationEmailTest {

    @Test
    void theValuesATemplateCanUse() {
        Map<String, String> values = InvitationEmail.values("en", "ana@example.test", "Acme", "admin@example.test",
                "https://x.test/l", Instant.parse("2026-11-05T12:00:00Z"));

        assertEquals(Map.of("organization", "Acme", "inviter", "admin@example.test", "email", "ana@example.test",
                "link", "https://x.test/l", "expiresAt", "November 5, 2026"), values);
    }

    @Test
    void theLinkJoinsTheBaseLanguageAndToken() {
        assertEquals("https://x.test/app/en/invite/t1", InvitationMail.link("https://x.test/app/", "en", "t1"));
        assertEquals("https://x.test/app/es/invite/t1", InvitationMail.link("https://x.test/app", "es", "t1"));
    }
}
