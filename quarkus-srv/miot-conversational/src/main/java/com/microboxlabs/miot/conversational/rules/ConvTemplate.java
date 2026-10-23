package com.microboxlabs.miot.conversational.rules;

import java.time.Instant;
import java.util.List;

/**
 * A message a rule sends: a base text (what the inbox stores) and one variant per channel. Variables are
 * {@code {{name}}}.
 *
 * @param whatsapp the Meta template to send, with the variables that fill its NAMED parameters; null when the
 *                 template has no WhatsApp variant
 * @param email    subject and body; null when the template has no email variant
 */
public record ConvTemplate(String id, String tenantCode, String key, String name, String baseText,
        WhatsApp whatsapp, Email email, Instant createdAt, Instant updatedAt, String updatedBy) {

    public record WhatsApp(String metaName, String language, List<String> params) {

        public WhatsApp {
            params = params == null ? List.of() : List.copyOf(params);
        }
    }

    public record Email(String subject, String body) {
    }
}
