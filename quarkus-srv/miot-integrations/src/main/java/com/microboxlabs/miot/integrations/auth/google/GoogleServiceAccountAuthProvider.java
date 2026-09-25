package com.microboxlabs.miot.integrations.auth.google;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

/**
 * {@link AuthType#GOOGLE_SERVICE_ACCOUNT}: runs the grant and answers the bearer
 * header, so a caller such as the dashboard server never sees the private key.
 */
@ApplicationScoped
public class GoogleServiceAccountAuthProvider implements CredentialAuthProvider {

    private final GoogleServiceAccountStrategy strategy;

    @Inject
    public GoogleServiceAccountAuthProvider(GoogleServiceAccountStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.GOOGLE_SERVICE_ACCOUNT);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        GoogleServiceAccountConfig config;
        try {
            config = GoogleServiceAccountConfigs.toConfig(context.publicConfig(), context.secret());
        } catch (IllegalArgumentException e) {
            throw new AuthResolutionException(
                    "Google service account credential is incomplete: " + e.getMessage(), e);
        }
        return strategy.resolve(config);
    }
}
