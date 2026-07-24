package com.microboxlabs.miot.integrations.auth.apikey;

import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.auth.CredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.domain.ApiKeyPlacement;
import com.microboxlabs.miot.integrations.domain.AuthType;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Set;

/**
 * {@link AuthType#API_KEY_HEADER} and {@link AuthType#API_KEY_QUERY} — a key sent under
 * a provider-chosen name, either as a header or a query parameter.
 *
 * <p>Credential shape: {@code publicConfig.name} (the header/param name, e.g.
 * {@code X-Api-Key}) + {@code secret.value}. The placement comes from the auth type
 * rather than from config, so the two can't contradict each other.
 */
@ApplicationScoped
public class ApiKeyCredentialAuthProvider implements CredentialAuthProvider {

    /** The non-secret key holding the header or query-parameter name. */
    public static final String PUBLIC_NAME = "name";
    /** The decrypted key holding the api key itself. */
    public static final String SECRET_VALUE = "value";

    private final ApiKeyStrategy strategy;

    @Inject
    public ApiKeyCredentialAuthProvider(ApiKeyStrategy strategy) {
        this.strategy = strategy;
    }

    @Override
    public Set<AuthType> supportedTypes() {
        return Set.of(AuthType.API_KEY_HEADER, AuthType.API_KEY_QUERY);
    }

    @Override
    public ResolvedAuth resolve(CredentialAuthContext context) {
        ApiKeyPlacement placement = context.authType() == AuthType.API_KEY_QUERY
                ? ApiKeyPlacement.QUERY
                : ApiKeyPlacement.HEADER;
        return strategy.resolve(new ApiKeyConfig(
                context.requirePublic(PUBLIC_NAME),
                context.requireSecret(SECRET_VALUE),
                placement));
    }
}
