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
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationOperationRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
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
 * connection, or reuses it if it is already there, since a list has to name a
 * connection that exists in that organization.
 *
 * <p>Off unless {@code miot.selectables.example-connection.enabled} is true:
 * opening the list makes our servers call a third party, which an organization
 * should not get without asking.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class ExampleConnectionSelectables implements SelectableDefaults {

    private static final Logger LOG = Logger.getLogger(ExampleConnectionSelectables.class);

    static final String CONNECTION_NAME = "Países (ejemplo)";
    static final String OPERATION_NAME = "Listar países";
    static final URI BASE_URL = URI.create("https://countriesnow.space");
    static final String PATH = "/api/v0.1/countries/iso";
    static final String KEY = "country";

    private final IntegrationConnectionService connections;
    private final boolean enabled;

    @Inject
    public ExampleConnectionSelectables(IntegrationConnectionService connections,
            @ConfigProperty(name = "miot.selectables.example-connection.enabled", defaultValue = "false")
            boolean enabled) {
        this.connections = connections;
        this.enabled = enabled;
    }

    @Override
    public List<Selectable> forTenant(String tenantCode) {
        if (!enabled) {
            return List.of();
        }
        try {
            IntegrationConnection connection = connection(tenantCode);
            IntegrationOperation operation = operation(tenantCode, connection);
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

    private IntegrationConnection connection(String tenantCode) {
        return connections.listConnections(tenantCode).stream()
                .filter(c -> CONNECTION_NAME.equals(c.name()))
                .findFirst()
                .orElseGet(() -> connections.createConnection(tenantCode, new CreateIntegrationConnectionRequest(
                        CONNECTION_NAME, ProviderType.CUSTOM_HTTP, BASE_URL, null, Map.of(), null)));
    }

    private IntegrationOperation operation(String tenantCode, IntegrationConnection connection) {
        return connections.listOperations(tenantCode, connection.id()).stream()
                .filter(o -> "GET".equalsIgnoreCase(o.method()) && PATH.equals(o.path()))
                .findFirst()
                .orElseGet(() -> connections.addOperation(tenantCode, connection.id(),
                        new CreateIntegrationOperationRequest(OPERATION_NAME, "GET", PATH, Map.of(), Map.of(),
                                true)));
    }

    /** The answer is {@code {"data": [{"name", "Iso2", "Iso3"}]}}: items and label take the defaults. */
    static Selectable list(String ref) {
        return new Selectable(null, KEY, Localized.of("País", "Country"),
                Localized.of("Países de una API pública, a través de la conexión de ejemplo.",
                        "Countries from a public API, through the example connection."),
                SelectionMode.SINGLE, SelectableSettings.DEFAULT, List.of(),
                new SelectableSource(SelectableSource.Kind.CONNECTION, ref, Map.of("value", "Iso2")),
                List.of(), "system:defaults", null);
    }
}
