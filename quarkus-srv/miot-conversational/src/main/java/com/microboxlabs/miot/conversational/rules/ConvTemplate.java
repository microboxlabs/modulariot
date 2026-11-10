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
 * @param teams    the Adaptive Card a Teams step sends; null sends the plain card of title and text
 * @param version  semantic version, raised on each save by {@link TemplateBump}
 */
public record ConvTemplate(String id, String tenantCode, String key, String name, String baseText,
        WhatsApp whatsapp, Email email, Teams teams, Instant createdAt, Instant updatedAt, String updatedBy,
        String version) {

    /** The reserved tenant that owns the message templates. */
    public static final String PLATFORM_TENANT = PlatformScope.TENANT;

    /** A template without a Teams card. */
    public ConvTemplate(String id, String tenantCode, String key, String name, String baseText, WhatsApp whatsapp,
            Email email, Instant createdAt, Instant updatedAt, String updatedBy, String version) {
        this(id, tenantCode, key, name, baseText, whatsapp, email, null, createdAt, updatedAt, updatedBy, version);
    }

    /**
     * @param callPermission the Meta template carries a call permission request: sending it counts against
     *                       Meta's request limits and needs WhatsApp calling enabled
     */
    public record WhatsApp(String metaName, String language, List<String> params, boolean callPermission) {

        public WhatsApp {
            params = params == null ? List.of() : List.copyOf(params);
        }

        public WhatsApp(String metaName, String language, List<String> params) {
            this(metaName, language, params, false);
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

    /**
     * An Adaptive Card for Teams, top to bottom: the title, a subtitle and its caption, the text, the images, the
     * facts, the notes, and the buttons. Every text takes {@code {{variables}}}; a part left out is not drawn.
     * {@link TeamsCard} draws it.
     *
     * @param images the images listed in a field of the event's data; null draws none
     * @param notes  small grey lines under the facts
     */
    public record Teams(String title, String subtitle, String caption, String text, Images images,
            List<Fact> facts, List<String> notes, List<Action> actions) {

        public Teams {
            facts = facts == null ? List.of() : List.copyOf(facts);
            notes = notes == null ? List.of() : List.copyOf(notes);
            actions = actions == null ? List.of() : List.copyOf(actions);
        }

        /**
         * @param field the field of the event's data holding a list of {@code {name, url}}
         * @param label the line above each image; {@code {{n}}} is its number from 1, {@code {{name}}} its name
         */
        public record Images(String field, String label) {
        }

        /** @param optional the fact is left out when its value is empty or {@code -} */
        public record Fact(String title, String value, boolean optional) {

            public Fact(String title, String value) {
                this(title, value, false);
            }
        }

        /** A button that opens a URL; left out when the URL is empty. */
        public record Action(String title, String url) {
        }
    }
}
