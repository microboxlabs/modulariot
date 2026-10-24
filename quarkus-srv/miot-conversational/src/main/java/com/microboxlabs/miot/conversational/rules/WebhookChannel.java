package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.OffsetDateTime;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The webhook channel: an integration template each organization gets on first use, whose connections a webhook
 * step calls with {@link #OPERATION}. Every connection receives the same payload, {@link #REQUEST_SCHEMA}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WebhookChannel {

    public static final String TEMPLATE_NAME = "Webhook de comunicaciones";
    public static final String OPERATION = "deliver";
    public static final String METHOD = "POST";
    /** The connection's base URL is the whole address. */
    public static final String PATH = "";
    private static final String TYPE = "type";
    private static final String STRING = "string";
    private static final String OBJECT = "object";
    private static final String PROPERTIES = "properties";
    private static final String REQUIRED = "required";
    private static final String DESCRIPTION = "description";

    public static final Map<String, Object> REQUEST_SCHEMA = requestSchema();

    /** A connection as the channel's page lists it. */
    public record Connection(String id, String name, String baseUrl, String status, OffsetDateTime lastTestedAt,
            Boolean lastTestResult) {

        public static Connection of(IntegrationConnection c) {
            return new Connection(c.id(), c.name(), c.baseUrl() == null ? null : c.baseUrl().toString(),
                    c.status() == null ? null : c.status().name(), c.lastTestedAt(), c.lastTestResult());
        }
    }

    public record View(String operation, Map<String, Object> requestSchema, List<Connection> connections) {
    }

    private final IntegrationTemplateService templates;
    private final IntegrationConnectionService connections;
    private final IntegrationOperationInvoker invoker;

    @Inject
    public WebhookChannel(IntegrationTemplateService templates, IntegrationConnectionService connections,
            IntegrationOperationInvoker invoker) {
        this.templates = templates;
        this.connections = connections;
        this.invoker = invoker;
    }

    /** The organization's webhook template, created on first use. */
    public synchronized IntegrationTemplate ensureTemplate(String tenantCode) {
        return template(tenantCode).orElseGet(() -> templates.createTemplate(tenantCode,
                new CreateIntegrationTemplateRequest(TEMPLATE_NAME, ProviderType.CUSTOM_HTTP, OPERATION, METHOD, PATH,
                        REQUEST_SCHEMA, Map.of())));
    }

    public Optional<IntegrationTemplate> template(String tenantCode) {
        return templates.listTemplates(tenantCode).stream()
                .filter(t -> TEMPLATE_NAME.equals(t.name()) && OPERATION.equalsIgnoreCase(t.operationName()))
                .findFirst();
    }

    /** The organization's connections made from the webhook template. */
    public List<IntegrationConnection> connections(String tenantCode) {
        Optional<IntegrationTemplate> template = template(tenantCode);
        if (template.isEmpty()) {
            return List.of();
        }
        String id = template.get().id();
        return connections.listConnections(tenantCode).stream().filter(c -> id.equals(c.templateId())).toList();
    }

    public View view(String tenantCode) {
        return new View(OPERATION, REQUEST_SCHEMA, connections(tenantCode).stream().map(Connection::of).toList());
    }

    /** Throws {@link IllegalArgumentException} without a name or an absolute HTTP(S) base URL. */
    public IntegrationConnection create(String tenantCode, String name, String baseUrl, String credentialProfileId) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        URI url = baseUrl(baseUrl);
        IntegrationTemplate template = ensureTemplate(tenantCode);
        String credential = credentialProfileId == null || credentialProfileId.isBlank() ? null : credentialProfileId;
        return connections.createConnection(tenantCode, new CreateIntegrationConnectionRequest(name.trim(),
                ProviderType.CUSTOM_HTTP, url, credential, Map.of(), template.id()));
    }

    /** Calls the connection's {@link #OPERATION}; throws what the invoker throws when the call is not made. */
    public OperationInvocationResult deliver(String tenantCode, String connectionId, Map<String, Object> payload) {
        return invoker.invokeByName(tenantCode, connectionId, OPERATION, payload);
    }

    /** What a webhook step sends: the event, the rule and run, the template's title and text, and the data. */
    public static Map<String, Object> payload(StoredEvent event, Run run, Rule rule, String title, String text) {
        Map<String, Object> ruleRef = new LinkedHashMap<>();
        ruleRef.put("id", run.ruleId());
        ruleRef.put("key", rule == null ? null : rule.key());
        ruleRef.put("name", rule == null ? null : rule.name());
        ruleRef.put("version", run.ruleVersion());
        Map<String, Object> runRef = new LinkedHashMap<>();
        runRef.put("id", run.id());
        runRef.put("step", run.step());
        runRef.put("test", run.test());
        Map<String, Object> context = new LinkedHashMap<>();
        context.put("kind", event.contextKind());
        context.put("key", event.contextKey());
        Map<String, Object> out = new LinkedHashMap<>();
        out.put("event", event.type());
        out.put("at", event.at() == null ? null : event.at().toString());
        out.put("context", context);
        out.put("rule", ruleRef);
        out.put("run", runRef);
        out.put("title", title);
        out.put("text", text);
        out.put("data", event.data());
        return out;
    }

    private static URI baseUrl(String baseUrl) {
        if (baseUrl == null || baseUrl.isBlank()) {
            throw new IllegalArgumentException("baseUrl is required");
        }
        try {
            URI url = new URI(baseUrl.trim());
            String scheme = url.getScheme() == null ? "" : url.getScheme().toLowerCase(Locale.ROOT);
            if (!Set.of("http", "https").contains(scheme) || url.getHost() == null) {
                throw new IllegalArgumentException("baseUrl must be an absolute http(s) URL");
            }
            return url;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("baseUrl is not a valid URL");
        }
    }

    private static Map<String, Object> requestSchema() {
        Map<String, Object> props = new LinkedHashMap<>();
        props.put("event", field(STRING, "Tipo del evento que inició la regla"));
        Map<String, Object> at = field(STRING, "Cuándo ocurrió el evento, ISO-8601");
        at.put("format", "date-time");
        props.put("at", at);
        props.put("context", object("Sobre qué es el evento", List.of(),
                "kind", field(List.of(STRING, "null"), "Tipo del contexto, como symptom_case"),
                "key", field(List.of(STRING, "null"), "Clave del contexto")));
        props.put("rule", object("La regla", List.of("id", "key", "name", "version"),
                "id", field(STRING, null), "key", field(STRING, null), "name", field(STRING, null),
                "version", field(STRING, "Versión publicada en vigor")));
        props.put("run", object("La ejecución de la regla", List.of("id", "step", "test"),
                "id", field(STRING, null), "step", field("integer", "Índice del paso, desde 0"),
                "test", field("boolean", "Ejecución de prueba")));
        props.put("title", field(List.of(STRING, "null"),
                "Asunto del correo de la plantilla, si no su texto; null sin plantilla"));
        props.put("text", field(List.of(STRING, "null"),
                "Cuerpo del correo de la plantilla, si no su texto de WhatsApp; null sin plantilla"));
        props.put("data", field(OBJECT, "Los datos del evento"));
        Map<String, Object> schema = new LinkedHashMap<>();
        schema.put(TYPE, OBJECT);
        schema.put(REQUIRED, List.of("event", "at", "rule", "run", "title", "text", "data"));
        schema.put(PROPERTIES, props);
        return Collections.unmodifiableMap(schema);
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
