package com.microboxlabs.miot.integrations.email;

import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * Sends email through a tenant's active RESEND connection. The connection's credential holds
 * the API key as {@code token}; its metadata holds the sender as {@code from}. Blocking.
 */
@ApplicationScoped
public class ResendEmailSender {

    public static final String FROM = "from";
    public static final String TOKEN = "token";

    private final IntegrationConnectionRepository connections;
    private final IntegrationConnectionResolver resolver;
    private final ResendClient client;

    @Inject
    public ResendEmailSender(IntegrationConnectionRepository connections, IntegrationConnectionResolver resolver,
            ResendClient client) {
        this.connections = connections;
        this.resolver = resolver;
        this.client = client;
    }

    /** Whether the tenant has an active RESEND connection. */
    public boolean configured(String tenantCode) {
        return tenantCode != null && connections.findActiveByProvider(tenantCode, ProviderType.RESEND) != null;
    }

    /** Sends through the tenant's connection; a connection that cannot be used is a failed result. */
    public SendResult send(String tenantCode, EmailMessage message, String idempotencyKey) {
        ResolvedConnection connection;
        try {
            connection = resolver.resolve(tenantCode, ProviderType.RESEND);
        } catch (ConnectionResolutionException e) {
            return SendResult.failed(0, e.getMessage());
        }
        String apiKey = connection.secretString(TOKEN);
        if (apiKey == null || apiKey.isBlank()) {
            return SendResult.failed(0, "The RESEND connection's credential has no API key");
        }
        String from = message.from() != null ? message.from() : connection.metadataString(FROM);
        if (from == null || from.isBlank()) {
            return SendResult.failed(0, "The RESEND connection has no sender (metadata.from)");
        }
        return client.send(connection.baseUrl(), apiKey, message.withFrom(from), idempotencyKey);
    }
}
