package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.core.auth.PlatformScope;
import java.time.Instant;
import java.util.List;

/**
 * A message a rule sends: a base text (what the inbox stores) and one variant per channel. Variables are
 * {@code {{name}}}. The platform owns the templates every organization's rules use.
 *
 * @param whatsapp the Meta template to send, with the variables that fill its NAMED parameters; null when the
 *                 template has no WhatsApp variant
 * @param email    subject and body; null when the template has no email variant
 * @param version  semantic version, raised on each save by {@link TemplateBump}
 */
public record ConvTemplate(String id, String tenantCode, String key, String name, String baseText,
        WhatsApp whatsapp, Email email, Instant createdAt, Instant updatedAt, String updatedBy, String version) {

    /** The reserved tenant that owns the message templates. */
    public static final String PLATFORM_TENANT = PlatformScope.TENANT;

    public record WhatsApp(String metaName, String language, List<String> params) {

        public WhatsApp {
            params = params == null ? List.of() : List.copyOf(params);
        }
    }

    /**
     * @param body plain text, for a template written before HTML; null when {@code html} is set
     * @param html the body in HTML, inside the ModularIoT layout when sent; its values are escaped
     */
    public record Email(String subject, String body, String html) {

        public Email(String subject, String body) {
            this(subject, body, null);
        }

        public boolean hasHtml() {
            return html != null && !html.isBlank();
        }
    }
}
