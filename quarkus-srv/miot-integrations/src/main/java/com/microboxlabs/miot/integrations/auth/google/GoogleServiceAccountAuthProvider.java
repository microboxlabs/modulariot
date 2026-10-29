package com.microboxlabs.miot.integrations.auth.google;

import com.microboxlabs.miot.integrations.auth.AuthResolutionException;
import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.orgaccount.GoogleCallException;
import com.microboxlabs.miot.integrations.orgaccount.ManagedGoogleIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.Set;

/**
 * {@link AuthType#GOOGLE_SERVICE_ACCOUNT}: runs the grant and answers the bearer
 * header, so a caller such as the dashboard server never sees the private key. A
 * managed credential has no key: the platform impersonates the organization's account.
 */
@ApplicationScoped
public class GoogleServiceAccountAuthProvider implements CredentialAuthProvider {

    private final GoogleServiceAccountStrategy strategy;
    private final ManagedGoogleIdentity managed;

    @Inject
    public GoogleServiceAccountAuthProvider(GoogleServiceAccountStrategy strategy, ManagedGoogleIdentity managed) {
        this.strategy = strategy;
        this.managed = managed;
    }

    public GoogleServiceAccountAuthProvider(GoogleServiceAccountStrategy strategy) {
        this(strategy, ManagedGoogleIdentity.NONE);
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.GOOGLE_SERVICE_ACCOUNT);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        if (ManagedGoogleIdentity.isManaged(context.publicConfig())) return resolveManaged(context);
        GoogleServiceAccountConfig config;
        try {
            config = GoogleServiceAccountConfigs.toConfig(context.publicConfig(), context.secret());
        } catch (IllegalArgumentException e) {
            throw new AuthResolutionException(
                    "Google service account credential is incomplete: " + e.getMessage(), e);
        }
        return strategy.resolve(config);
    }

    private ResolvedAuth resolveManaged(CredentialAuthContext context) {
        String email = context.publicValue(ManagedGoogleIdentity.CLIENT_EMAIL).orElseThrow(
                () -> new AuthResolutionException("The managed credential is not bound to an account"));
        String scope = context.publicValue("scope").orElse(GoogleServiceAccountConfigs.DEFAULT_SCOPE);
        try {
            ManagedGoogleIdentity.Token token = managed.accessToken(email, scope);
            return ResolvedAuth.headers(Map.of("Authorization", "Bearer " + token.value()), token.expiresAt());
        } catch (ManagedGoogleIdentity.UnavailableException | GoogleCallException e) {
            throw new AuthResolutionException("Could not act as the organization's service account: "
                    + e.getMessage());
        }
    }
}
