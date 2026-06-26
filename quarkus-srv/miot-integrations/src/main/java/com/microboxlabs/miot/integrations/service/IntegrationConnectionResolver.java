package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * Resolves an org's active connection for a given provider into a ready-to-use
 * {@link ResolvedConnection} (base URL + metadata + decrypted secret). This is the seam
 * other modules consume to call an external provider without depending on the persistence
 * or cipher internals of miot-integrations.
 */
@ApplicationScoped
public class IntegrationConnectionResolver {

    private final IntegrationConnectionRepository connectionRepository;
    private final CredentialProfileRepository credentialProfileRepository;
    private final IntegrationSecretCipher secretCipher;

    @Inject
    public IntegrationConnectionResolver(
            IntegrationConnectionRepository connectionRepository,
            CredentialProfileRepository credentialProfileRepository,
            IntegrationSecretCipher secretCipher) {
        this.connectionRepository = connectionRepository;
        this.credentialProfileRepository = credentialProfileRepository;
        this.secretCipher = secretCipher;
    }

    /**
     * @throws ConnectionResolutionException if no usable connection of {@code providerType}
     *         is configured for {@code tenantCode}, or its credential cannot be read.
     */
    public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
        IntegrationConnection connection = connectionRepository.findActiveByProvider(tenantCode, providerType);
        if (connection == null) {
            throw new ConnectionResolutionException(
                    "No usable " + providerType + " connection is configured for this organization");
        }

        Map<String, Object> secret = Map.of();
        if (connection.credentialProfileId() != null) {
            CredentialProfile credential =
                    credentialProfileRepository.findByTenantAndId(tenantCode, connection.credentialProfileId());
            if (credential != null) {
                try {
                    secret = secretCipher.decrypt(credential.encryptedSecretJson());
                } catch (RuntimeException e) {
                    throw new ConnectionResolutionException(
                            "Could not read the credential for the " + providerType + " connection", e);
                }
            }
        }
        return new ResolvedConnection(connection.id(), connection.baseUrl(), connection.metadata(), secret);
    }
}
