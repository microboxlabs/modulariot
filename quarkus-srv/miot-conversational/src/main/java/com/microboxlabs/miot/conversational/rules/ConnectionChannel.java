package com.microboxlabs.miot.conversational.rules;

import java.util.ArrayList;
import java.util.Arrays;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;

/**
 * A channel a step sends through an integration connection. Each kind has its own integration template per
 * organization (CUSTOM_HTTP, operation {@link #OPERATION}, POST on the connection's base URL), so a connection
 * made for one kind is never listed under another, and its own request body.
 *
 * <ul>
 *   <li>{@code webhook}: the event, the rule, the run, the template's title and text, and the data.</li>
 *   <li>{@code slack}: an incoming-webhook message, {@code {"text": "*title*\ntext"}}.</li>
 *   <li>{@code teams}: a Workflows incoming-webhook message with one Adaptive Card.</li>
 * </ul>
 */
public enum ConnectionChannel {

    WEBHOOK("webhook", "Webhook de comunicaciones") {
        @Override
        public Map<String, Object> body(Delivery d) {
            Map<String, Object> ruleRef = new LinkedHashMap<>();
            ruleRef.put("id", d.run().ruleId());
            ruleRef.put("key", d.rule() == null ? null : d.rule().key());
            ruleRef.put("name", d.rule() == null ? null : d.rule().name());
            ruleRef.put(VERSION, d.run().ruleVersion());
            Map<String, Object> runRef = new LinkedHashMap<>();
            runRef.put("id", d.run().id());
            runRef.put("step", d.run().step());
            runRef.put("test", d.run().test());
            Map<String, Object> context = new LinkedHashMap<>();
            context.put("kind", d.event().contextKind());
            context.put("key", d.event().contextKey());
            Map<String, Object> out = new LinkedHashMap<>();
            out.put(EVENT, d.event().type());
            out.put("at", d.event().at() == null ? null : d.event().at().toString());
            out.put("context", context);
            out.put("rule", ruleRef);
            out.put("run", runRef);
            out.put(TITLE, d.title());
            out.put("text", d.text());
            out.put("data", d.event().data());
            return out;
        }
    },

    SLACK("slack", "Slack de comunicaciones") {
        @Override
        public Map<String, Object> body(Delivery d) {
            String text = d.textOrSummary();
            Map<String, Object> out = new LinkedHashMap<>();
            out.put("text", d.title() == null ? text : "*" + d.title() + "*\n" + text);
            return out;
        }
    },

    TEAMS("teams", "Teams de comunicaciones") {
        @Override
        public Map<String, Object> body(Delivery d) {
            List<Map<String, Object>> blocks = new ArrayList<>();
            if (d.title() != null) {
                Map<String, Object> title = new LinkedHashMap<>();
                title.put(TYPE, TEXT_BLOCK);
                title.put("weight", "Bolder");
                title.put("text", d.title());
                title.put(WRAP, true);
                blocks.add(title);
            }
            Map<String, Object> text = new LinkedHashMap<>();
            text.put(TYPE, TEXT_BLOCK);
            text.put("text", d.textOrSummary());
            text.put(WRAP, true);
            blocks.add(text);
            Map<String, Object> card = new LinkedHashMap<>();
            card.put("$schema", CARD_SCHEMA);
            card.put(TYPE, "AdaptiveCard");
            card.put(VERSION, CARD_VERSION);
            card.put("body", blocks);
            Map<String, Object> attachment = new LinkedHashMap<>();
            attachment.put(CONTENT_TYPE, CARD_CONTENT_TYPE);
            attachment.put(CONTENT, card);
            Map<String, Object> out = new LinkedHashMap<>();
            out.put(TYPE, "message");
            out.put(ATTACHMENTS, List.of(attachment));
            return out;
        }
    };

    public static final String OPERATION = "deliver";
    public static final String METHOD = "POST";
    /** The connection's base URL is the whole address. */
    public static final String PATH = "";
    static final String CARD_SCHEMA = "http://adaptivecards.io/schemas/adaptive-card.json";
    static final String CARD_CONTENT_TYPE = "application/vnd.microsoft.card.adaptive";
    static final String CARD_VERSION = "1.4";
    private static final String TYPE = "type";
    private static final String TEXT_BLOCK = "TextBlock";
    private static final String WRAP = "wrap";
    private static final String VERSION = "version";
    private static final String EVENT = "event";
    private static final String TITLE = "title";
    private static final String CONTENT_TYPE = "contentType";
    private static final String CONTENT = "content";
    private static final String ATTACHMENTS = "attachments";

    /**
     * What one step sends to one connection.
     *
     * @param title the template's email subject, else its name; null without a template
     * @param text  the template's email body, else its base text, rendered; null without a template
     */
    public record Delivery(StoredEvent event, Run run, Rule rule, String title, String text) {

        /** The text, or without a template a line about the event: {@code symptom.case.opened · symptom_case -7}. */
        public String textOrSummary() {
            return text != null ? text : summary(event);
        }
    }

    private final String key;
    private final String templateName;
    private final Map<String, Object> requestSchema;

    ConnectionChannel(String key, String templateName) {
        this.key = key;
        this.templateName = templateName;
        this.requestSchema = Schemas.of(key);
    }

    /** The channel's name in a rule step and in the API path. */
    public String key() {
        return key;
    }

    /** The name of the organization's integration template for this channel. */
    public String templateName() {
        return templateName;
    }

    /** The JSON schema of {@link #body}, kept on the template. */
    public Map<String, Object> requestSchema() {
        return requestSchema;
    }

    /** The request body the connection's {@link #OPERATION} receives. */
    public abstract Map<String, Object> body(Delivery delivery);

    /** The channel with this key, any case. */
    public static Optional<ConnectionChannel> of(String key) {
        if (key == null) {
            return Optional.empty();
        }
        String k = key.trim().toLowerCase(Locale.ROOT);
        return Arrays.stream(values()).filter(c -> c.key.equals(k)).findFirst();
    }

    /** The event type, then its context when it has one. */
    static String summary(StoredEvent event) {
        StringBuilder s = new StringBuilder(event.type());
        if (event.contextKind() != null || event.contextKey() != null) {
            s.append(" ·");
            if (event.contextKind() != null) {
                s.append(' ').append(event.contextKind());
            }
            if (event.contextKey() != null) {
                s.append(' ').append(event.contextKey());
            }
        }
        return s.toString();
    }

    /** The request schemas, built once per kind. */
    private static final class Schemas {

        private static final String STRING = "string";
        private static final String OBJECT = "object";
        private static final String ARRAY = "array";
        private static final String BOOLEAN = "boolean";
        private static final String PROPERTIES = "properties";
        private static final String REQUIRED = "required";
        private static final String DESCRIPTION = "description";
        private static final String CONST = "const";

        private Schemas() {
        }

        static Map<String, Object> of(String key) {
            return Collections.unmodifiableMap(switch (key) {
                case "slack" -> slack();
                case "teams" -> teams();
                default -> webhook();
            });
        }

        private static Map<String, Object> webhook() {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put(EVENT, field(STRING, "Tipo del evento que inició la regla"));
            Map<String, Object> at = field(STRING, "Cuándo ocurrió el evento, ISO-8601");
            at.put("format", "date-time");
            props.put("at", at);
            props.put("context", object("Sobre qué es el evento", List.of(),
                    "kind", field(List.of(STRING, "null"), "Tipo del contexto, como symptom_case"),
                    "key", field(List.of(STRING, "null"), "Clave del contexto")));
            props.put("rule", object("La regla", List.of("id", "key", "name", VERSION),
                    "id", field(STRING, null), "key", field(STRING, null), "name", field(STRING, null),
                    VERSION, field(STRING, "Versión publicada en vigor")));
            props.put("run", object("La ejecución de la regla", List.of("id", "step", "test"),
                    "id", field(STRING, null), "step", field("integer", "Índice del paso, desde 0"),
                    "test", field(BOOLEAN, "Ejecución de prueba")));
            props.put(TITLE, field(List.of(STRING, "null"),
                    "Asunto del correo de la plantilla, si no su nombre; null sin plantilla"));
            props.put("text", field(List.of(STRING, "null"),
                    "Cuerpo del correo de la plantilla, si no su texto base; null sin plantilla"));
            props.put("data", field(OBJECT, "Los datos del evento"));
            return schema(List.of(EVENT, "at", "rule", "run", TITLE, "text", "data"), props);
        }

        private static Map<String, Object> slack() {
            Map<String, Object> props = new LinkedHashMap<>();
            props.put("text", field(STRING, "El título en negrita y el texto de la plantilla; sin plantilla, "
                    + "el tipo del evento y su contexto"));
            return schema(List.of("text"), props);
        }

        private static Map<String, Object> teams() {
            Map<String, Object> block = object("Un bloque de texto: el título en negrita, si hay, y el texto",
                    List.of(TYPE, "text"), TYPE, constant(TEXT_BLOCK), "weight", field(STRING, "Bolder en el título"),
                    "text", field(STRING, null), WRAP, field(BOOLEAN, null));
            Map<String, Object> blocks = field(ARRAY, null);
            blocks.put("items", block);
            Map<String, Object> card = object("La tarjeta adaptable", List.of(TYPE, VERSION, "body"),
                    "$schema", constant(CARD_SCHEMA), TYPE, constant("AdaptiveCard"), VERSION,
                    constant(CARD_VERSION), "body", blocks);
            Map<String, Object> attachment = object(null, List.of(CONTENT_TYPE, CONTENT),
                    CONTENT_TYPE, constant(CARD_CONTENT_TYPE), CONTENT, card);
            Map<String, Object> attachments = field(ARRAY, "Una tarjeta");
            attachments.put("items", attachment);
            Map<String, Object> props = new LinkedHashMap<>();
            props.put(TYPE, constant("message"));
            props.put(ATTACHMENTS, attachments);
            return schema(List.of(TYPE, ATTACHMENTS), props);
        }

        private static Map<String, Object> schema(List<String> required, Map<String, Object> props) {
            Map<String, Object> schema = new LinkedHashMap<>();
            schema.put(TYPE, OBJECT);
            schema.put(REQUIRED, required);
            schema.put(PROPERTIES, props);
            return schema;
        }

        private static Map<String, Object> constant(String value) {
            Map<String, Object> f = field(STRING, null);
            f.put(CONST, value);
            return f;
        }

        private static Map<String, Object> field(Object type, String description) {
            Map<String, Object> f = new LinkedHashMap<>();
            f.put(TYPE, type);
            if (description != null) {
                f.put(DESCRIPTION, description);
            }
            return f;
        }

        private static Map<String, Object> object(String description, List<String> required, Object... properties) {
            Map<String, Object> props = new LinkedHashMap<>();
            for (int i = 0; i < properties.length; i += 2) {
                props.put((String) properties[i], properties[i + 1]);
            }
            Map<String, Object> o = field(OBJECT, description);
            if (!required.isEmpty()) {
                o.put(REQUIRED, required);
            }
            o.put(PROPERTIES, props);
            return o;
        }
    }
}
