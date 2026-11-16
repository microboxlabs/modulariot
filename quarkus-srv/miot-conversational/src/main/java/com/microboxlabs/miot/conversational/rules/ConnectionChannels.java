package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.IntegrationTemplate;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationTemplateRequest;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import com.microboxlabs.miot.integrations.service.IntegrationOperationInvoker;
import com.microboxlabs.miot.integrations.service.IntegrationTemplateService;
import com.microboxlabs.miot.integrations.service.OperationInvocationException;
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.net.URI;
import java.net.URISyntaxException;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

/**
 * The {@link ConnectionChannel}s of each organization: their integration templates, created on first use, the
 * connections made from them, and the calls a step makes.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class ConnectionChannels {

    /**
     * A connection as the channel's page lists it, for every member. Only the URL's host: Slack and Teams URLs
     * carry their secret in the path and query; the full URL stays in the connections API.
     */
    public record Connection(String id, String name, String host, String status, OffsetDateTime lastTestedAt,
            Boolean lastTestResult, String destination) {

        public static Connection of(IntegrationConnection c) {
            return new Connection(c.id(), c.name(), c.baseUrl() == null ? null : c.baseUrl().getHost(),
                    c.status() == null ? null : c.status().name(), c.lastTestedAt(), c.lastTestResult(),
                    destinationOf(c));
        }
    }

    /** The connection's metadata key for where its messages land, such as a Teams team and channel. */
    public static final String DESTINATION = "destination";
    static final int DESTINATION_MAX = 200;

    public record View(String operation, Map<String, Object> requestSchema, List<Connection> connections) {
    }

    private final IntegrationTemplateService templates;
    private final IntegrationConnectionService connections;
    private final IntegrationOperationInvoker invoker;

    @Inject
    public ConnectionChannels(IntegrationTemplateService templates, IntegrationConnectionService connections,
            IntegrationOperationInvoker invoker) {
        this.templates = templates;
        this.connections = connections;
        this.invoker = invoker;
    }

    /** The organization's template for this channel, created on first use. */
    public synchronized IntegrationTemplate ensureTemplate(ConnectionChannel channel, String tenantCode) {
        return template(channel, tenantCode).orElseGet(() -> templates.createTemplate(tenantCode,
                new CreateIntegrationTemplateRequest(channel.templateName(), ProviderType.CUSTOM_HTTP,
                        ConnectionChannel.OPERATION, ConnectionChannel.METHOD, ConnectionChannel.PATH,
                        channel.requestSchema(), Map.of())));
    }

    public Optional<IntegrationTemplate> template(ConnectionChannel channel, String tenantCode) {
        return templates.listTemplates(tenantCode).stream()
                .filter(t -> channel.templateName().equals(t.name())
                        && ConnectionChannel.OPERATION.equalsIgnoreCase(t.operationName()))
                .findFirst();
    }

    /** The organization's connections made from the channel's template. */
    public List<IntegrationConnection> connections(ConnectionChannel channel, String tenantCode) {
        Optional<IntegrationTemplate> template = template(channel, tenantCode);
        if (template.isEmpty()) {
            return List.of();
        }
        String id = template.get().id();
        return connections.listConnections(tenantCode).stream().filter(c -> id.equals(c.templateId())).toList();
    }

    public View view(ConnectionChannel channel, String tenantCode) {
        return new View(ConnectionChannel.OPERATION, channel.requestSchema(),
                connections(channel, tenantCode).stream().map(Connection::of).toList());
    }

    /** Throws {@link IllegalArgumentException} without a name or an absolute HTTP(S) base URL. */
    public IntegrationConnection create(ConnectionChannel channel, String tenantCode, String name, String baseUrl,
            String credentialProfileId) {
        return create(channel, tenantCode, name, baseUrl, credentialProfileId, null);
    }

    /**
     * {@link #create(ConnectionChannel, String, String, String, String)} with where its messages land, shown
     * to whoever picks the connection. The URL does not say it: a Teams Workflow URL names no channel.
     */
    public IntegrationConnection create(ConnectionChannel channel, String tenantCode, String name, String baseUrl,
            String credentialProfileId, String destination) {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        URI url = baseUrl(baseUrl);
        IntegrationTemplate template = ensureTemplate(channel, tenantCode);
        String credential = credentialProfileId == null || credentialProfileId.isBlank() ? null : credentialProfileId;
        String where = cleanDestination(destination);
        Map<String, Object> metadata = where == null ? Map.of() : Map.of(DESTINATION, where);
        return connections.createConnection(tenantCode, new CreateIntegrationConnectionRequest(name.trim(),
                ProviderType.CUSTOM_HTTP, url, credential, metadata, template.id()));
    }

    /**
     * Sets or, with a blank value, clears where the connection's messages land; keeps the rest of its metadata.
     * Empty when the organization has no such connection on this channel.
     */
    public Optional<Connection> setDestination(ConnectionChannel channel, String tenantCode, String connectionId,
            String destination) {
        Optional<IntegrationConnection> found = connection(channel, tenantCode, connectionId);
        if (found.isEmpty()) {
            return Optional.empty();
        }
        Map<String, Object> metadata = new LinkedHashMap<>(
                found.get().metadata() == null ? Map.of() : found.get().metadata());
        String where = cleanDestination(destination);
        if (where == null) {
            metadata.remove(DESTINATION);
        } else {
            metadata.put(DESTINATION, where);
        }
        IntegrationConnection updated = connections.updateConnection(tenantCode, connectionId,
                new UpdateIntegrationConnectionRequest(null, null, metadata, null, null));
        return Optional.ofNullable(updated).map(Connection::of);
    }

    private static String destinationOf(IntegrationConnection c) {
        Object value = c.metadata() == null ? null : c.metadata().get(DESTINATION);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    /** Null when blank; throws {@link IllegalArgumentException} when longer than {@link #DESTINATION_MAX}. */
    private static String cleanDestination(String destination) {
        if (destination == null || destination.isBlank()) {
            return null;
        }
        String trimmed = destination.trim();
        if (trimmed.length() > DESTINATION_MAX) {
            throw new IllegalArgumentException("destination is longer than " + DESTINATION_MAX + " characters");
        }
        return trimmed;
    }

    /** The connection's name; empty when the organization has no such connection. */
    public Optional<String> name(String tenantCode, String connectionId) {
        IntegrationConnection c = connections.getConnection(tenantCode, connectionId);
        return Optional.ofNullable(c).map(IntegrationConnection::name);
    }

    /**
     * Calls the connection's {@link ConnectionChannel#OPERATION}; throws what the invoker throws. Refuses a
     * connection made from another channel's template, so a Teams card never reaches a Slack webhook.
     */
    public OperationInvocationResult deliver(ConnectionChannel channel, String tenantCode, String connectionId,
            Map<String, Object> body) {
        IntegrationConnection connection = connection(channel, tenantCode, connectionId).orElseThrow(
                () -> new OperationInvocationException(
                        "The connection is not one of the organization's " + channel.key() + " connections"));
        if (connection.status() != ConnectionStatus.ACTIVE) {
            throw new OperationInvocationException("The connection " + connection.name() + " is "
                    + connection.status() + "; test it so it becomes ACTIVE");
        }
        return invoker.invokeByName(tenantCode, connectionId, ConnectionChannel.OPERATION, body);
    }

    /** The organization's connection with this id, when it was made from the channel's template. */
    public Optional<IntegrationConnection> connection(ConnectionChannel channel, String tenantCode,
            String connectionId) {
        IntegrationConnection connection = connections.getConnection(tenantCode, connectionId);
        Optional<String> templateId = template(channel, tenantCode).map(IntegrationTemplate::id);
        return connection != null && templateId.isPresent() && templateId.get().equals(connection.templateId())
                ? Optional.of(connection) : Optional.empty();
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
}
