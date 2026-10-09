package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.mail.MailTemplates;
import java.time.Instant;
import java.util.Map;

/** The values an invitation template can use. See {@link MailTemplates#INVITATION_VARIABLES}. */
final class InvitationEmail {

    private InvitationEmail() {
    }

    static Map<String, String> values(String lang, String to, String organization, String inviter, String link,
            Instant expiresAt) {
        return Map.of(
                "organization", organization,
                "inviter", inviter,
                "email", to,
                "link", link,
                "expiresAt", MailTemplates.date(lang, expiresAt));
    }
}
