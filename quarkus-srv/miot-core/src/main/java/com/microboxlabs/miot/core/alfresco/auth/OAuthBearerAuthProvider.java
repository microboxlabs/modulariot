package com.microboxlabs.miot.core.alfresco.auth;

import io.quarkus.arc.Unremovable;
import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Optional;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Forwards the caller's JWT as a Bearer token to Alfresco. Assumes
 * Alfresco is configured to accept and validate the same issuer that
 * minted the token (OIDC/SSO mode).
 *
 * <p>Active when {@code miot.alfresco.auth=oauth}.
 *
 * <p>Reads the raw token from {@link JsonWebToken#getRawToken()} via the
 * {@link SecurityIdentity} principal. A caller whose identity is not a JWT
 * (an API key) fails the outgoing call with a clear 401. Work with no caller
 * (scheduled jobs) uses the Basic credentials from
 * {@code miot.alfresco.basic.username} / {@code .password}, and fails when
 * they are not set.
 */
@ApplicationScoped
@Unremovable
@LookupIfProperty(name = "miot.alfresco.auth", stringValue = "oauth")
public class OAuthBearerAuthProvider implements AlfrescoAuthProvider {

    private final SecurityIdentity securityIdentity;
    private final BasicAuthProvider service;
    private final boolean serviceConfigured;

    @Inject
    public OAuthBearerAuthProvider(SecurityIdentity securityIdentity,
            @ConfigProperty(name = "miot.alfresco.basic.username") Optional<String> serviceUsername,
            @ConfigProperty(name = "miot.alfresco.basic.password") Optional<String> servicePassword) {
        this.securityIdentity = securityIdentity;
        this.service = new BasicAuthProvider(serviceUsername, servicePassword);
        this.serviceConfigured = serviceUsername.filter(s -> !s.isBlank()).isPresent()
                && servicePassword.filter(s -> !s.isBlank()).isPresent();
    }

    @Override
    public String resolveAuthHeader() {
        Caller caller = caller();
        if (caller == Caller.NONE) {
            if (serviceConfigured) {
                return service.resolveAuthHeader();
            }
            throw new IllegalStateException(
                    "Cannot call Alfresco without a caller: miot.alfresco.basic credentials are not set");
        }
        if (caller.token() == null) {
            throw new IllegalStateException("Cannot forward JWT to Alfresco: the caller has no JWT");
        }
        return "Bearer " + caller.token();
    }

    /** The caller's JWT; null token for a caller without one; {@link #NONE} when there is no caller. */
    private record Caller(String token) {
        static final Caller NONE = new Caller(null);
    }

    /**
     * Reads the caller in one guarded step. A background job has no caller: outside a request context, or on an
     * event loop where resolving the identity would block, the identity cannot be read at all.
     */
    private Caller caller() {
        try {
            if (securityIdentity == null || securityIdentity.isAnonymous()) {
                return Caller.NONE;
            }
            if (securityIdentity.getPrincipal() instanceof JsonWebToken jwt) {
                String raw = jwt.getRawToken();
                return new Caller(raw == null || raw.isBlank() ? null : raw);
            }
            return new Caller(null);
        } catch (RuntimeException noCaller) {
            return Caller.NONE;
        }
    }
}
