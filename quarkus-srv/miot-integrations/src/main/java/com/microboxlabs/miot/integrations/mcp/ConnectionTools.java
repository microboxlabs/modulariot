package com.microboxlabs.miot.integrations.mcp;

import com.microboxlabs.miot.core.mcp.McpCaller;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationOperation;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import io.quarkiverse.mcp.server.Tool;
import io.quarkiverse.mcp.server.ToolArg;
import io.quarkiverse.mcp.server.ToolCallException;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.function.Supplier;
import java.util.regex.Pattern;

/**
 * Integration connections as MCP tools: the operations of
 * {@code /api/v1/orgs/{org}/integrations} an agent needs to inspect and set up
 * connections, under the same rule (organization owners only). Secrets never
 * pass through here: a connection points at a credential by id, and metadata
 * keys that look like secrets are masked on the way out and refused on the way in.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.integrations.enabled", stringValue = "true")
public class ConnectionTools {

    static final String ORGANIZATION = "The organization's slug, as in /api/v1/orgs/{slug}.";
    static final String CONNECTION_ID = "The connection's id.";
    static final String MASK = "***";

    private static final Pattern SECRET_KEY =
            Pattern.compile("(?i)(secret|passw|api[_-]?key|authorization|private[_-]?key|cookie|token$)");

    public record ConnectionView(String id, String name, ProviderType providerType, URI baseUrl,
            String credentialProfileId, ConnectionStatus status, OffsetDateTime lastTestedAt,
            Boolean lastTestResult, String templateId, Map<String, Object> metadata) {
    }

    public record OperationView(String name, String method, String path, boolean testOperation) {
    }

    public record Connections(List<ConnectionView> connections) {
    }

    public record ConnectionDetail(ConnectionView connection, List<OperationView> operations) {
    }

    public record CredentialRef(String id, String displayName, CredentialType credentialType,
            String environment) {
    }

    public record Templates(List<IntegrationTemplate> templates, List<CredentialRef> credentials) {
    }

    private final McpCaller caller;
    private final IntegrationConnectionService connections;
    private final IntegrationTemplateService templates;
    private final CredentialProfileService credentials;

    @Inject
    public ConnectionTools(McpCaller caller, IntegrationConnectionService connections,
            IntegrationTemplateService templates, CredentialProfileService credentials) {
        this.caller = caller;
        this.connections = connections;
        this.templates = templates;
        this.credentials = credentials;
    }

    @Tool(name = "connections_list", structuredContent = true,
            description = "The organization's integration connections (external APIs and databases) with"
                    + " their status and last test result. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "List connections", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Connections> list(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.owner(organization).flatMap(in -> work(() -> new Connections(
                connections.listConnections(in.tenantCode()).stream().map(ConnectionTools::view).toList())));
    }

    @Tool(name = "connections_get", structuredContent = true,
            description = "One connection and the operations it can call. The credential appears as its id"
                    + " only. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Get a connection", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<ConnectionDetail> get(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = CONNECTION_ID) String connectionId) {
        return caller.owner(organization).flatMap(in -> work(() -> {
            IntegrationConnection connection = existing(in.tenantCode(), connectionId);
            List<OperationView> operations = connections.listOperations(in.tenantCode(), connectionId).stream()
                    .map(ConnectionTools::view).toList();
            return new ConnectionDetail(view(connection), operations);
        }));
    }

    @Tool(name = "connections_templates", structuredContent = true,
            description = "What a connection can be created from: the integration templates (each one fixes"
                    + " the provider and the operation to call) and the credentials a connection can use,"
                    + " by id, without their secrets. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "List connection templates", readOnlyHint = true,
                    destructiveHint = false, openWorldHint = false))
    public Uni<Templates> templates(@ToolArg(description = ORGANIZATION) String organization) {
        return caller.owner(organization).flatMap(in -> work(() -> new Templates(
                templates.listTemplates(in.tenantCode()),
                credentials.list(in.tenantCode()).stream().map(ConnectionTools::ref).toList())));
    }

    @Tool(name = "connections_create", structuredContent = true,
            description = "Creates a connection from an integration template. The connection starts as a"
                    + " draft; run connections_test next. A credential is given by id only: create or"
                    + " rotate secrets in the Integrations screen, never here. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Create a connection", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = false, openWorldHint = false))
    public Uni<ConnectionView> create(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = "A short name for the connection.") String name,
            @ToolArg(description = "The template's id, from connections_templates.") String templateId,
            @ToolArg(description = "The base URL of the external system, absolute http(s).") String baseUrl,
            @ToolArg(description = "The credential's id, from connections_templates. Leave it out when the"
                    + " system needs no authentication.", required = false) String credentialProfileId,
            @ToolArg(description = "Non-secret settings the template needs, as a JSON object. Keys that"
                    + " look like secrets (token, password, apiKey...) are refused.", required = false)
            Map<String, Object> metadata) {
        return caller.owner(organization).flatMap(in -> work(() -> {
            String tenant = in.tenantCode();
            if (blank(name)) {
                throw new IllegalArgumentException("name is required");
            }
            if (blank(templateId)) {
                throw new IllegalArgumentException("templateId is required");
            }
            if (templates.getTemplate(tenant, templateId) == null) {
                throw new NoSuchElementException("template not found: " + templateId);
            }
            String credential = blank(credentialProfileId) ? null : credentialProfileId;
            if (credential != null && credentials.get(tenant, credential) == null) {
                throw new NoSuchElementException("credential not found: " + credential);
            }
            refuseSecrets(metadata, "metadata");
            IntegrationConnection created = connections.createConnection(tenant, new CreateIntegrationConnectionRequest(
                    name.trim(), null, httpUrl(baseUrl), credential, metadata, templateId));
            return view(created);
        }));
    }

    @Tool(name = "connections_test", structuredContent = true,
            description = "Checks a connection and records the result as its status. Providers with a live"
                    + " probe call the system with the connection's credential; the others only check the"
                    + " connection's settings, without calling it. The base URL must resolve to a public"
                    + " address. Needs an organization owner.",
            annotations = @Tool.Annotations(title = "Test a connection", readOnlyHint = false,
                    destructiveHint = false, idempotentHint = true, openWorldHint = true))
    public Uni<ConnectionTestResponse> test(
            @ToolArg(description = ORGANIZATION) String organization,
            @ToolArg(description = CONNECTION_ID) String connectionId,
            @ToolArg(description = "HTTP method of the probe; the provider's default when not given.",
                    required = false) String method,
            @ToolArg(description = "Path of the probe, relative to the base URL; the provider's default when"
                    + " not given.", required = false) String path) {
        return caller.owner(organization).flatMap(in -> work(() -> {
            OutboundUrlGuard.requirePublicHttpUrl(existing(in.tenantCode(), connectionId).baseUrl(), "baseUrl");
            return connections.testConnection(in.tenantCode(), connectionId,
                    new ConnectionTestRequest(method, path));
        }));
    }

    private IntegrationConnection existing(String tenant, String connectionId) {
        if (blank(connectionId)) {
            throw new IllegalArgumentException("connectionId is required");
        }
        IntegrationConnection connection = connections.getConnection(tenant, connectionId);
        if (connection == null) {
            throw new NoSuchElementException("connection not found: " + connectionId);
        }
        return connection;
    }

    static ConnectionView view(IntegrationConnection c) {
        return new ConnectionView(c.id(), c.name(), c.providerType(), c.baseUrl(), c.credentialProfileId(),
                c.status(), c.lastTestedAt(), c.lastTestResult(), c.templateId(), masked(c.metadata()));
    }

    private static OperationView view(IntegrationOperation o) {
        return new OperationView(o.name(), o.method(), o.path(), o.testOperation());
    }

    private static CredentialRef ref(CredentialProfileResponse c) {
        return new CredentialRef(c.id(), c.displayName(), c.credentialType(), c.environment());
    }

    /** A copy with the values of secret-looking keys replaced, at any depth. */
    static Map<String, Object> masked(Map<String, Object> map) {
        if (map == null) {
            return Map.of();
        }
        Map<String, Object> out = new LinkedHashMap<>();
        map.forEach((key, value) -> out.put(key, isSecret(key) ? MASK : maskedValue(value)));
        return out;
    }

    @SuppressWarnings("unchecked")
    private static Object maskedValue(Object value) {
        if (value instanceof Map<?, ?> nested) {
            return masked((Map<String, Object>) nested);
        }
        if (value instanceof List<?> items) {
            return items.stream().map(ConnectionTools::maskedValue).toList();
        }
        return value;
    }

    private static void refuseSecrets(Object value, String at) {
        if (value instanceof Map<?, ?> map) {
            map.forEach((key, nested) -> {
                String path = at + "." + key;
                if (isSecret(String.valueOf(key))) {
                    throw new IllegalArgumentException(path + " looks like a secret; store it in a credential"
                            + " and pass credentialProfileId instead");
                }
                refuseSecrets(nested, path);
            });
        } else if (value instanceof List<?> items) {
            items.forEach(item -> refuseSecrets(item, at));
        }
    }

    private static boolean isSecret(String key) {
        return key != null && SECRET_KEY.matcher(key).find();
    }

    private static URI httpUrl(String value) {
        if (blank(value)) {
            throw new IllegalArgumentException("baseUrl is required");
        }
        try {
            URI uri = new URI(value.trim());
            if (uri.getHost() == null || !("http".equals(uri.getScheme()) || "https".equals(uri.getScheme()))) {
                throw new IllegalArgumentException("baseUrl must be an absolute http(s) URL");
            }
            if (uri.getUserInfo() != null) {
                throw new IllegalArgumentException("baseUrl must not carry a user or password; use a credential");
            }
            return uri;
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException("baseUrl must be an absolute http(s) URL", e);
        }
    }

    private static boolean blank(String value) {
        return value == null || value.isBlank();
    }

    private static <T> Uni<T> work(Supplier<T> call) {
        return Uni.createFrom().item(() -> guarded(call))
                .runSubscriptionOn(Infrastructure.getDefaultWorkerPool());
    }

    private static <T> T guarded(Supplier<T> call) {
        try {
            return call.get();
        } catch (IllegalArgumentException | NoSuchElementException e) {
            throw new ToolCallException(e.getMessage(), e);
        }
    }
}
