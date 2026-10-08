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
        if (!validSender(from)) {
            return SendResult.failed(0, "The RESEND connection has no valid sender (metadata.from)");
        }
        if (!client.serves(connection.baseUrl())) {
            return SendResult.failed(0, "The RESEND connection must use " + client.baseUrl());
        }
        return client.send(apiKey, message.withFrom(from), idempotencyKey);
    }

    /** {@code address@domain.tld} or {@code Name <address@domain.tld>}. */
    public static boolean validSender(String value) {
        if (value == null) {
            return false;
        }
        String sender = value.trim();
        int open = sender.indexOf('<');
        if (open < 0 && sender.indexOf('>') < 0) {
            return validAddress(sender);
        }
        boolean named = open >= 0 && open == sender.lastIndexOf('<') && sender.endsWith(">")
                && sender.indexOf('>') == sender.length() - 1;
        return named && validAddress(sender.substring(open + 1, sender.length() - 1));
    }

    private static boolean validAddress(String address) {
        for (char c : address.toCharArray()) {
            if (Character.isWhitespace(c) || c == '<' || c == '>') {
                return false;
            }
        }
        int at = address.indexOf('@');
        int dot = address.lastIndexOf('.');
        return at > 0 && at == address.lastIndexOf('@') && dot > at + 1 && dot < address.length() - 1;
    }
}
