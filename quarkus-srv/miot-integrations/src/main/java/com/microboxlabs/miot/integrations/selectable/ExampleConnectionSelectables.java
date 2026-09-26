package com.microboxlabs.miot.integrations.selectable;

import com.microboxlabs.miot.core.selectable.Localized;
import com.microboxlabs.miot.core.selectable.Selectable;
import com.microboxlabs.miot.core.selectable.SelectableDefaults;
import com.microboxlabs.miot.core.selectable.SelectableSettings;
import com.microboxlabs.miot.core.selectable.SelectableSource;
import com.microboxlabs.miot.core.selectable.SelectionMode;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.util.List;
import java.util.Map;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * An example of a list fed from a connection: the countries of a free public
 * API, which needs no key. Seeding it creates the organization's example
 * template and a connection made from it, or reuses them, since a list has to
 * name a connection that exists in that organization. The template's response
 * schema is what the list editor suggests fields from.
 *
 * <p>Off unless {@code miot.selectables.example-connection.enabled} is true:
 * opening the list makes our servers call a third party, which an organization
 * should not get without asking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class ExampleConnectionSelectables implements SelectableDefaults {

    private static final Logger LOG = Logger.getLogger(ExampleConnectionSelectables.class);

    static final String TEMPLATE_NAME = "Países (ejemplo)";
    static final String CONNECTION_NAME = "Países (ejemplo)";
    static final String OPERATION_NAME = "Listar países";
    static final String PATH = "/api/v0.1/countries/iso";
    static final String KEY = "country";

    private static final Map<String, Object> TEXT = Map.of("type", "string");

    /** The answer: {@code {"error", "msg", "data": [{"name", "Iso2", "Iso3"}]}}. */
    static final Map<String, Object> RESPONSE_SCHEMA = Map.of(
            "type", "object",
            "properties", Map.of(
                    "error", Map.of("type", "boolean"),
                    "msg", TEXT,
                    "data", Map.of("type", "array", "items", Map.of(
                            "type", "object",
                            "properties", Map.of("name", TEXT, "Iso2", TEXT, "Iso3", TEXT)))));

    private final IntegrationTemplateService templates;
    private final IntegrationConnectionService connections;
    private final boolean enabled;
    private final URI baseUrl;

    @Inject
    public ExampleConnectionSelectables(IntegrationTemplateService templates,
            IntegrationConnectionService connections,
            @ConfigProperty(name = "miot.selectables.example-connection.enabled", defaultValue = "false")
            boolean enabled,
            @ConfigProperty(name = "miot.selectables.example-connection.base-url",
                    defaultValue = "https://countriesnow.space")
            URI baseUrl) {
        this.templates = templates;
        this.connections = connections;
        this.enabled = enabled;
        this.baseUrl = baseUrl;
    }

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        if (!enabled) {
            return List.of();
        }
        try {
            IntegrationTemplate template = template(tenantCode);
            IntegrationConnection connection = connection(tenantCode, template);
            IntegrationOperation operation = connections.listOperations(tenantCode, connection.id()).stream()
                    .findFirst()
                    .orElseThrow(() -> new IllegalStateException("the example connection has no operation"));
            if (connection.status() != ConnectionStatus.ACTIVE) {
                connections.testConnection(tenantCode, connection.id(), new ConnectionTestRequest("GET", PATH));
            }
            return List.of(list(connection.id() + ":" + operation.id()));
        } catch (RuntimeException e) {
            // The organization's other default lists must still be seeded.
            LOG.warnf(e, "Could not set up the example connection list for tenant %s", tenantCode);
            return List.of();
        }
    }

    private IntegrationTemplate template(String tenantCode) {
        return templates.listTemplates(tenantCode).stream()
                .filter(t -> TEMPLATE_NAME.equalsIgnoreCase(t.name()))
                .findFirst()
                .orElseGet(() -> templates.createTemplate(tenantCode, new CreateIntegrationTemplateRequest(
                        TEMPLATE_NAME, ProviderType.CUSTOM_HTTP, OPERATION_NAME, "GET", PATH, Map.of(),
                        RESPONSE_SCHEMA)));
    }

    /** The template's first connection; creating one copies the template's operation onto it. */
    private IntegrationConnection connection(String tenantCode, IntegrationTemplate template) {
        return connections.listConnections(tenantCode).stream()
                .filter(c -> template.id().equals(c.templateId()))
                .findFirst()
                .orElseGet(() -> connections.createConnection(tenantCode, new CreateIntegrationConnectionRequest(
                        CONNECTION_NAME, ProviderType.CUSTOM_HTTP, baseUrl, null, Map.of(), template.id())));
    }

    static Selectable list(String ref) {
        return new Selectable(null, KEY, Localized.of("País", "Country"),
                Localized.of("Países de una API pública, a través de la conexión de ejemplo.",
                        "Countries from a public API, through the example connection."),
                SelectionMode.SINGLE, SelectableSettings.DEFAULT, List.of(),
                new SelectableSource(SelectableSource.Kind.CONNECTION, ref, Map.of(
                        "items", "{{response.data}}",
                        "value", "{{item.Iso2}}",
                        "label", "{{item.name}}")),
                List.of(), "system:defaults", null);
    }
}
