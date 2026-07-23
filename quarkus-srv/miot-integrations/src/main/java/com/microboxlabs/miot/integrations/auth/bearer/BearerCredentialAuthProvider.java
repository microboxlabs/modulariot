package com.microboxlabs.miot.integrations.auth.bearer;

import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

/**
 * {@link AuthType#BEARER_TOKEN} — a static token sent as {@code Authorization: Bearer …}.
 *
 * <p>Credential shape: {@code secret.token}. That key matches what the WhatsApp
 * connection already stores ({@code secretString("token")}), so a bearer credential
 * reads the same whoever created it.
 */
@ApplicationScoped
public class BearerCredentialAuthProvider implements CredentialAuthProvider {

    /** The decrypted key holding the token. */
    public static final String SECRET_TOKEN = "token";

    private final BearerTokenStrategy strategy;

    @Inject
    public BearerCredentialAuthProvider(BearerTokenStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.BEARER_TOKEN);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        return strategy.resolve(new BearerTokenConfig(context.requireSecret(SECRET_TOKEN)));
    }
}
