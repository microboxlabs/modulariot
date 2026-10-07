package com.microboxlabs.miot.integrations.email;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.dto.UpdateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.service.CredentialProfileService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.Map;

/**
 * The platform's email sender: one RESEND connection, kept under a reserved tenant code, used for
 * every organization that has no sender of its own. Blocking.
 */
@ApplicationScoped
public class PlatformMailService {

    /** Not a valid Auth0 client id, so no organization can own it. */
    public static final String PLATFORM_TENANT = "_platform";
    static final String NAME = "Platform email";

    /** {@code configured} is false and the rest null when no sender is set. */
    public record PlatformMailView(boolean configured, String connectionId, String from, String keyPreview,
            String status, OffsetDateTime lastTestedAt, Boolean lastTestResult) {

        static PlatformMailView none() {
            return new PlatformMailView(false, null, null, null, null, null, null);
        }
    }

    /** {@code apiKey}: required the first time; blank keeps the stored key. */
    public record SetPlatformMailRequest(String from, String apiKey) {
    }

    private final IntegrationConnectionService connections;
    private final CredentialProfileService credentials;
    private final ResendClient client;

    @Inject
    public PlatformMailService(IntegrationConnectionService connections, CredentialProfileService credentials,
            ResendClient client) {
        this.connections = connections;
        this.credentials = credentials;
        this.client = client;
    }

    public PlatformMailView get() {
        IntegrationConnection connection = connection();
        return connection == null ? PlatformMailView.none() : view(connection);
    }

    /** @throws IllegalArgumentException for an invalid sender, or a missing key on first save */
    public PlatformMailView put(SetPlatformMailRequest body, String actor) {
        String from = body == null || body.from() == null ? "" : body.from().trim();
        String apiKey = body == null || body.apiKey() == null ? "" : body.apiKey().trim();
        if (!ResendEmailSender.validSender(from)) {
            throw new IllegalArgumentException("from must be address@domain.tld or Name <address@domain.tld>");
        }
        IntegrationConnection existing = connection();
        if (existing != null) {
            connections.updateConnection(PLATFORM_TENANT, existing.id(), new UpdateIntegrationConnectionRequest(
                    null, client.baseUrl(), Map.of(ResendEmailSender.FROM, from), null,
                    apiKey.isEmpty() ? null : apiKey));
            return get();
        }
        if (apiKey.isEmpty()) {
            throw new IllegalArgumentException("apiKey is required");
        }
        CredentialProfileResponse credential = credentials.create(PLATFORM_TENANT, actor,
                new CreateCredentialProfileRequest(NAME, null, AuthType.BEARER_TOKEN, null, Map.of(),
                        Map.of(ResendEmailSender.TOKEN, apiKey)));
        try {
            return view(connections.createConnection(PLATFORM_TENANT, new CreateIntegrationConnectionRequest(
                    NAME, ProviderType.RESEND, client.baseUrl(), credential.id(),
                    Map.of(ResendEmailSender.FROM, from), null)));
        } catch (RuntimeException e) {
            credentials.delete(PLATFORM_TENANT, actor, credential.id(), true);
            throw e;
        }
    }

    /** @return false when no sender was set */
    public boolean delete(String actor) {
        IntegrationConnection existing = connection();
        if (existing == null) {
            return false;
        }
        connections.deleteConnection(PLATFORM_TENANT, existing.id());
        if (existing.credentialProfileId() != null) {
            credentials.delete(PLATFORM_TENANT, actor, existing.credentialProfileId(), true);
        }
        return true;
    }

    /** Checks the key with Resend; null when no sender is set. */
    public ConnectionTestResponse test() {
        IntegrationConnection existing = connection();
        return existing == null
                ? null
                : connections.testConnection(PLATFORM_TENANT, existing.id(), new ConnectionTestRequest(null, null));
    }

    private IntegrationConnection connection() {
        return connections.listConnections(PLATFORM_TENANT).stream()
                .filter(c -> c.providerType() == ProviderType.RESEND)
                .findFirst()
                .orElse(null);
    }

    private PlatformMailView view(IntegrationConnection connection) {
        Object from = connection.metadata() == null ? null : connection.metadata().get(ResendEmailSender.FROM);
        CredentialProfileResponse credential = connection.credentialProfileId() == null
                ? null
                : credentials.get(PLATFORM_TENANT, connection.credentialProfileId());
        return new PlatformMailView(true, connection.id(), from instanceof String s ? s : null,
                credential == null ? null : credential.secretPreview(),
                connection.status() == null ? null : connection.status().name(),
                connection.lastTestedAt(), connection.lastTestResult());
    }
}
