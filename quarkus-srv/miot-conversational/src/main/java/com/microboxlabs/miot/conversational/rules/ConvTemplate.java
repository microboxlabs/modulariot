package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.core.auth.PlatformScope;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.UnaryOperator;
import java.util.regex.Matcher;
import java.util.regex.Pattern;

/**
 * A message a rule sends: a base text (what the inbox stores) and one variant per channel. Variables are
 * {@code {{name}}}. A template belongs to the platform, and every organization's rules use it, or to one
 * organization, and only its rules use it.
 *
 * @param whatsapp the Meta template to send, with the variables that fill its NAMED parameters; null when the
 *                 template has no WhatsApp variant
 * @param email    subject and body; null when the template has no email variant
 * @param teams    the Adaptive Card a Teams step sends; null sends the plain card of title and text
 * @param version  semantic version, raised on each save by {@link TemplateBump}
 * @param params   the values each rule step that uses the template writes, {@code {{name}}} in its texts
 */
public record ConvTemplate(String id, String tenantCode, String key, String name, String baseText,
        WhatsApp whatsapp, Email email, Teams teams, Instant createdAt, Instant updatedAt, String updatedBy,
        String version, List<Param> params) {

    /** The reserved tenant that owns the platform's message templates. */
    public static final String PLATFORM_TENANT = PlatformScope.TENANT;
    public static final String OWNER_PLATFORM = "platform";
    public static final String OWNER_ORGANIZATION = "organization";
    private static final Pattern VARIABLE = Pattern.compile("\\{\\{\\s*([A-Za-z0-9_.]+)\\s*}}");

    public ConvTemplate {
        params = params == null ? List.of() : params.stream().filter(Objects::nonNull).toList();
    }

    /** A template without parameters. */
    public ConvTemplate(String id, String tenantCode, String key, String name, String baseText, WhatsApp whatsapp,
            Email email, Teams teams, Instant createdAt, Instant updatedAt, String updatedBy, String version) {
        this(id, tenantCode, key, name, baseText, whatsapp, email, teams, createdAt, updatedAt, updatedBy, version,
                List.of());
    }

    /** A template without a Teams card. */
    public ConvTemplate(String id, String tenantCode, String key, String name, String baseText, WhatsApp whatsapp,
            Email email, Instant createdAt, Instant updatedAt, String updatedBy, String version) {
        this(id, tenantCode, key, name, baseText, whatsapp, email, null, createdAt, updatedAt, updatedBy, version);
    }

    /**
     * A value a rule step writes for the template.
     *
     * @param name      the variable, {@code {{name}}}
     * @param label     what the step's editor shows
     * @param multiline the value is a text of several lines
     */
    public record Param(String name, String label, boolean multiline) {
    }

    /** {@value #OWNER_PLATFORM} or {@value #OWNER_ORGANIZATION}. */
    public String owner() {
        return PLATFORM_TENANT.equals(tenantCode) ? OWNER_PLATFORM : OWNER_ORGANIZATION;
    }

    /**
     * The template with each parameter replaced by the step's value, in every text. A value may use the event's
     * variables, which are rendered afterwards like the rest of the template. A parameter without a value is left
     * empty. The HTML email gets the value escaped.
     */
    public ConvTemplate bind(Map<String, String> values) {
        if (params.isEmpty()) {
            return this;
        }
        Map<String, String> v = values == null ? Map.of() : values;
        UnaryOperator<String> text = s -> replace(s, v, false);
        UnaryOperator<String> html = s -> replace(s, v, true);
        Email e = email == null ? null
                : new Email(text.apply(email.subject()), text.apply(email.body()), html.apply(email.html()));
        Teams t = teams == null ? null : teams.map(text);
        return new ConvTemplate(id, tenantCode, key, name, text.apply(baseText), whatsapp, e, t, createdAt,
                updatedAt, updatedBy, version, params);
    }

    private String replace(String s, Map<String, String> values, boolean escape) {
        if (s == null || s.indexOf('{') < 0) {
            return s;
        }
        Matcher m = VARIABLE.matcher(s);
        StringBuilder out = new StringBuilder();
        while (m.find()) {
            String name = m.group(1);
            boolean isParam = params.stream().anyMatch(p -> name.equals(p.name()));
            String value = isParam ? Objects.requireNonNullElse(values.get(name), "") : m.group();
            m.appendReplacement(out, Matcher.quoteReplacement(isParam && escape ? escapeHtml(value) : value));
        }
        m.appendTail(out);
        return out.toString();
    }

    private static String escapeHtml(String s) {
        return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;").replace("\"", "&quot;");
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
            facts = present(facts);
            notes = present(notes);
            actions = present(actions);
        }

        /** The card with {@code f} applied to every text. */
        Teams map(UnaryOperator<String> f) {
            return new Teams(f.apply(title), f.apply(subtitle), f.apply(caption), f.apply(text),
                    images == null ? null : new Images(images.field(), f.apply(images.label())),
                    facts.stream().map(x -> new Fact(f.apply(x.title()), f.apply(x.value()), x.optional())).toList(),
                    notes.stream().map(f).toList(),
                    actions.stream().map(a -> new Action(f.apply(a.title()), f.apply(a.url()))).toList());
        }

        /** The list without its null entries. */
        private static <T> List<T> present(List<T> list) {
            return list == null ? List.of() : list.stream().filter(Objects::nonNull).toList();
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

        /** A button that opens a URL; left out when the URL is not http or https. */
        public record Action(String title, String url) {
        }
    }
}
