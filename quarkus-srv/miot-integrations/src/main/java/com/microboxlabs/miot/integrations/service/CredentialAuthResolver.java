package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.CredentialProfile;
import com.microboxlabs.miot.integrations.persistence.CredentialProfileRepository;
import com.microboxlabs.miot.integrations.secret.IntegrationSecretCipher;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;

/**
 * Turns a stored credential into the auth a caller should send, without
 * handing over the secret.
 *
 * <p>Blocking, like the rest of this module, so callers hand it a worker
 * thread.
 */
@ApplicationScoped
public class CredentialAuthResolver {

    private final CredentialProfileRepository credentialProfileRepository;
    private final IntegrationSecretCipher secretCipher;
    private final CredentialAuthRegistry authRegistry;

    @Inject
    public CredentialAuthResolver(
            CredentialProfileRepository credentialProfileRepository,
            IntegrationSecretCipher secretCipher,
            CredentialAuthRegistry authRegistry) {
        this.credentialProfileRepository = credentialProfileRepository;
        this.secretCipher = secretCipher;
        this.authRegistry = authRegistry;
    }

    /**
     * Runs the credential's grant and returns what to send with a request.
     *
     * @param credentialRef the credential's id; anything else reads as absent
     * @return null when the tenant has no such credential
     * @throws com.microboxlabs.miot.integrations.auth.AuthResolutionException
     *     when the credential cannot produce auth
     */
    public ResolvedAuth resolve(String tenantCode, String credentialRef) {
        CredentialProfile profile =
                credentialProfileRepository.findByTenantAndId(tenantCode, credentialRef);
        if (profile == null) {
            return null;
        }
        return authRegistry.resolve(new CredentialAuthContext(
                profile.authType(),
                profile.credentialType(),
                profile.publicConfig(),
                secretCipher.decrypt(profile.encryptedSecretJson())));
    }
}
