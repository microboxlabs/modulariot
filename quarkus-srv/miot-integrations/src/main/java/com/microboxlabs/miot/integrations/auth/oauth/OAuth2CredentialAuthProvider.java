package com.microboxlabs.miot.integrations.auth.oauth;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

/**
 * {@link AuthType#OAUTH2_CLIENT_CREDENTIALS} — exchanges the stored client credentials
 * for a token, then sends it as a bearer header.
 *
 * <p>Config construction is delegated to {@link OAuth2CredentialConfigs#toConfig}, the
 * same mapper the credential tester uses, so what the Test button verifies and what a
 * live call actually sends can never disagree about where the token comes from.
 *
 * <p>Note this performs a token request per invocation — there is no token cache yet.
 * {@link ResolvedAuth#expiresAt()} is populated, which is what a cache would key on.
 */
@ApplicationScoped
public class OAuth2CredentialAuthProvider implements CredentialAuthProvider {

    private final OAuth2ClientCredentialsStrategy strategy;

    @Inject
    public OAuth2CredentialAuthProvider(OAuth2ClientCredentialsStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.OAUTH2_CLIENT_CREDENTIALS);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        OAuth2ClientCredentialsConfig config;
        try {
            config = OAuth2CredentialConfigs.toConfig(
                    context.credentialType(), context.publicConfig(), context.secret());
        } catch (IllegalArgumentException e) {
            // The mapper names the offending field; re-thrown as an auth failure so the
            // caller sees one exception type for "this credential can't be used".
            throw new AuthResolutionException(
                    "OAuth2 credential is incomplete: " + e.getMessage(), e);
        }
        return strategy.resolve(config);
    }
}
