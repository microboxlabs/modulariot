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
import java.util.Optional;

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
        return withCredential(tenantCode, connection, providerType.toString());
    }

    /**
     * Resolves one specific connection. The by-provider {@link #resolve(String, ProviderType)}
     * returns <i>the</i> active connection for a provider, which is right for a channel a
     * tenant has exactly one of (WhatsApp) but wrong once several endpoints share a provider
     * type — a tenant can have many {@code CUSTOM_HTTP} partners, and a caller that stored a
     * connection id means that one.
     *
     * <p>Unlike the by-provider lookup this does <b>not</b> require {@code ACTIVE}: the caller
     * decides whether a {@code DRAFT} connection may be exercised (a test probe may, a
     * production dispatch may not). Check {@link IntegrationConnection#status()} if it matters.
     *
     * @throws ConnectionResolutionException if the id is unknown to this tenant, or its
     *         credential is missing or cannot be decrypted
     */
    public ResolvedConnection resolve(String tenantCode, String connectionId) {
        IntegrationConnection connection = connectionRepository.findByTenantAndId(tenantCode, connectionId);
        if (connection == null) {
            throw new ConnectionResolutionException(
                    "Connection " + connectionId + " does not exist for this organization");
        }
        return withCredential(tenantCode, connection, "connection " + connectionId);
    }

    /**
     * Loads and decrypts the attached credential, if any, and describes how to authenticate
     * with it. A connection without a credential profile resolves with empty auth — legal for
     * an endpoint that needs none.
     *
     * @param label how to name the connection in an error the operator will read
     */
    private ResolvedConnection withCredential(
            String tenantCode, IntegrationConnection connection, String label) {
        if (connection.credentialProfileId() == null) {
            return new ResolvedConnection(
                    connection.id(), connection.baseUrl(), connection.metadata(), Map.of());
        }

        CredentialProfile credential =
                credentialProfileRepository.findByTenantAndId(tenantCode, connection.credentialProfileId());
        if (credential == null) {
            throw new ConnectionResolutionException(
                    "The credential profile linked to the " + label + " could not be found");
        }
        Map<String, Object> secret;
        try {
            secret = secretCipher.decrypt(credential.encryptedSecretJson());
        } catch (RuntimeException e) {
            throw new ConnectionResolutionException(
                    "Could not read the credential for the " + label, e);
        }
        return new ResolvedConnection(
                connection.id(),
                connection.baseUrl(),
                connection.metadata(),
                secret,
                credential.authType(),
                credential.credentialType(),
                credential.publicConfig());
    }

    /**
     * Reverse lookup for inbound Meta webhooks. A webhook event carries only the
     * {@code phone_number_id} (which of our numbers received it), so we map that to the org that
     * owns the active WHATSAPP connection advertising it. No credential is decrypted — inbound
     * persistence only needs the tenant to scope the conversation.
     *
     * @return the owning channel, or empty when no active WHATSAPP connection advertises that
     *         {@code phone_number_id}
     */
    public Optional<InboundChannelRef> resolveByWhatsAppPhoneNumberId(String phoneNumberId) {
        IntegrationConnection connection =
                connectionRepository.findActiveWhatsAppByPhoneNumberId(phoneNumberId);
        if (connection == null) {
            return Optional.empty();
        }
        return Optional.of(new InboundChannelRef(connection.tenantCode(), connection.id()));
    }
}
