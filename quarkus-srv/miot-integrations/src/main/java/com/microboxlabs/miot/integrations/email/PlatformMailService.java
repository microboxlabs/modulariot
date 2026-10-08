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
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
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

    /**
     * Starts with "_", which organizations may not use as their tenant client id
     * ({@code PlatformOrganizationsResource}), so no organization can own it.
     */
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
    private final IntegrationConnectionRepository repository;
    private final CredentialProfileService credentials;
    private final ResendClient client;

    @Inject
    public PlatformMailService(IntegrationConnectionService connections, IntegrationConnectionRepository repository,
            CredentialProfileService credentials, ResendClient client) {
        this.connections = connections;
        this.repository = repository;
        this.credentials = credentials;
        this.client = client;
    }

    public PlatformMailView get() {
        IntegrationConnection connection = connection();
        return connection == null ? PlatformMailView.none() : view(connection);
    }

    /**
     * Saves the sender. A new key is tested with Resend right away, so the status always describes
     * the key in use.
     *
     * @throws IllegalArgumentException for an invalid sender, or a missing key on first save
     */
    public PlatformMailView put(SetPlatformMailRequest body, String actor) {
        String from = body == null || body.from() == null ? "" : body.from().trim();
        String apiKey = body == null || body.apiKey() == null ? "" : body.apiKey().trim();
        if (!ResendEmailSender.validSender(from)) {
            throw new IllegalArgumentException("from must be address@domain.tld or Name <address@domain.tld>");
        }
        IntegrationConnection existing = connection();
        String connectionId = existing == null ? create(from, apiKey, actor) : existing.id();
        if (existing != null) {
            connections.updateConnection(PLATFORM_TENANT, connectionId, new UpdateIntegrationConnectionRequest(
                    null, client.baseUrl(), Map.of(ResendEmailSender.FROM, from), null,
                    apiKey.isEmpty() ? null : apiKey));
        }
        if (!apiKey.isEmpty()) {
            connections.testConnection(PLATFORM_TENANT, connectionId, new ConnectionTestRequest(null, null));
        }
        return get();
    }

    private String create(String from, String apiKey, String actor) {
        if (apiKey.isEmpty()) {
            throw new IllegalArgumentException("apiKey is required");
        }
        // With no connection, any platform credential is left over from a failed save or removal.
        removeCredentials(actor);
        CredentialProfileResponse credential = credentials.create(PLATFORM_TENANT, actor,
                new CreateCredentialProfileRequest(NAME, null, AuthType.BEARER_TOKEN, null, Map.of(),
                        Map.of(ResendEmailSender.TOKEN, apiKey)));
        try {
            return connections.createConnection(PLATFORM_TENANT, new CreateIntegrationConnectionRequest(
                    NAME, ProviderType.RESEND, client.baseUrl(), credential.id(),
                    Map.of(ResendEmailSender.FROM, from), null)).id();
        } catch (RuntimeException e) {
            removeCredentials(actor);
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
        removeCredentials(actor);
        return true;
    }

    /** Checks the stored key with Resend; null when no sender is set. */
    public ConnectionTestResponse test() {
        IntegrationConnection existing = connection();
        return existing == null
                ? null
                : connections.testConnection(PLATFORM_TENANT, existing.id(), new ConnectionTestRequest(null, null));
    }

    /** The connection the mailer sends through. */
    private IntegrationConnection connection() {
        return repository.findActiveByProvider(PLATFORM_TENANT, ProviderType.RESEND);
    }

    private void removeCredentials(String actor) {
        for (CredentialProfileResponse credential : credentials.list(PLATFORM_TENANT)) {
            credentials.delete(PLATFORM_TENANT, actor, credential.id(), true);
        }
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
