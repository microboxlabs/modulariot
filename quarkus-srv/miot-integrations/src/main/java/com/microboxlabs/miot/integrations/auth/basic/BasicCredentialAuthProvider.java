package com.microboxlabs.miot.integrations.auth.basic;

import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

/**
 * {@link AuthType#BASIC} — RFC 7617 username/password.
 *
 * <p>Credential shape: {@code publicConfig.username} + {@code secret.password}. The
 * username is non-secret on purpose: it identifies the credential in a list without
 * decrypting anything, the same way {@code clientId} does for OAuth2.
 */
@ApplicationScoped
public class BasicCredentialAuthProvider implements CredentialAuthProvider {

    /** The non-secret key holding the username. */
    public static final String PUBLIC_USERNAME = "username";
    /** The decrypted key holding the password. */
    public static final String SECRET_PASSWORD = "password";

    private final BasicAuthStrategy strategy;

    @Inject
    public BasicCredentialAuthProvider(BasicAuthStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.BASIC);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        return strategy.resolve(new BasicAuthConfig(
                context.requirePublic(PUBLIC_USERNAME),
                context.requireSecret(SECRET_PASSWORD)));
    }
}
