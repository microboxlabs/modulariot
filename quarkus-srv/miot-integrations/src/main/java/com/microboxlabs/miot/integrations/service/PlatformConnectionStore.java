package com.microboxlabs.miot.integrations.service;

import static com.microboxlabs.miot.integrations.email.PlatformMailService.PLATFORM_TENANT;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.dto.ConnectionTestRequest;
import com.microboxlabs.miot.integrations.dto.ConnectionTestResponse;
import com.microboxlabs.miot.integrations.dto.CreateCredentialProfileRequest;
import com.microboxlabs.miot.integrations.dto.CreateIntegrationConnectionRequest;
import com.microboxlabs.miot.integrations.dto.CredentialProfileResponse;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import java.net.URI;
import java.util.Map;

/**
 * One platform-wide connection of a provider, kept under the platform tenant with a credential named after it.
 * Other platform features keep their own credentials under the same tenant, so only those with this name are
 * touched. Blocking.
 */
public final class PlatformConnectionStore {

    private final IntegrationConnectionService connections;
    private final IntegrationConnectionRepository repository;
    private final CredentialProfileService credentials;
    private final ProviderType provider;
    private final String name;

    public PlatformConnectionStore(IntegrationConnectionService connections,
            IntegrationConnectionRepository repository, CredentialProfileService credentials, ProviderType provider,
            String name) {
        this.connections = connections;
        this.repository = repository;
        this.credentials = credentials;
        this.provider = provider;
        this.name = name;
    }

    /** The connection in use, or null. */
    public IntegrationConnection find() {
        return repository.findActiveByProvider(PLATFORM_TENANT, provider);
    }

    /** Creates the credential and the connection; on failure neither is left behind. */
    public String create(AuthType authType, Map<String, Object> publicConfig, Map<String, Object> secret,
            URI baseUrl, Map<String, Object> metadata, String actor) {
        // With no connection, any credential of this name is left over from a failed save or removal.
        removeCredentials(actor);
        CredentialProfileResponse credential = credentials.create(PLATFORM_TENANT, actor,
                new CreateCredentialProfileRequest(name, null, authType, null, publicConfig, secret));
        try {
            return connections.createConnection(PLATFORM_TENANT, new CreateIntegrationConnectionRequest(
                    name, provider, baseUrl, credential.id(), metadata, null)).id();
        } catch (RuntimeException e) {
            removeCredentials(actor);
            throw e;
        }
    }

    /** @throws IllegalStateException when the connection's credential is gone */
    public void rotateSecret(IntegrationConnection connection, Map<String, Object> secret) {
        if (connection.credentialProfileId() == null
                || credentials.rotateSecret(PLATFORM_TENANT, connection.credentialProfileId(), secret) == null) {
            throw new IllegalStateException("Cannot replace the secret: the connection has no credential");
        }
    }

    /** @return false when there was no connection */
    public boolean delete(String actor) {
        IntegrationConnection existing = find();
        if (existing == null) {
            return false;
        }
        connections.deleteConnection(PLATFORM_TENANT, existing.id());
        removeCredentials(actor);
        return true;
    }

    public ConnectionTestResponse test(String connectionId) {
        return connections.testConnection(PLATFORM_TENANT, connectionId, new ConnectionTestRequest(null, null));
    }

    /** Null when there is no connection. */
    public ConnectionTestResponse test() {
        IntegrationConnection existing = find();
        return existing == null ? null : test(existing.id());
    }

    public String secretPreview(IntegrationConnection connection) {
        CredentialProfileResponse credential = connection.credentialProfileId() == null
                ? null
                : credentials.get(PLATFORM_TENANT, connection.credentialProfileId());
        return credential == null ? null : credential.secretPreview();
    }

    private void removeCredentials(String actor) {
        for (CredentialProfileResponse credential : credentials.list(PLATFORM_TENANT)) {
            if (name.equals(credential.displayName())) {
                credentials.delete(PLATFORM_TENANT, actor, credential.id(), true);
            }
        }
    }
}
