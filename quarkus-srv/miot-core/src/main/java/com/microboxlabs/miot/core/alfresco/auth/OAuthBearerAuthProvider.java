package com.microboxlabs.miot.core.alfresco.auth;

import io.quarkus.arc.Arc;
import io.quarkus.arc.Unremovable;
import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.security.identity.SecurityIdentity;
import io.quarkus.vertx.http.runtime.CurrentVertxRequest;
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
 * {@link SecurityIdentity} principal. If the current request is anonymous
 * (no JWT), fails the outgoing call so the caller sees a clear 401 rather
 * than a silent success against Alfresco. Work that runs outside a request
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
        if (!inHttpRequest() && callerToken() == null) {
            if (serviceConfigured) {
                return service.resolveAuthHeader();
            }
            throw new IllegalStateException(
                    "Cannot call Alfresco outside a request: miot.alfresco.basic credentials are not set");
        }
        if (securityIdentity == null || securityIdentity.isAnonymous()) {
            throw new IllegalStateException(
                    "Cannot forward JWT to Alfresco: request is anonymous");
        }
        var principal = securityIdentity.getPrincipal();
        if (!(principal instanceof JsonWebToken jwt)) {
            throw new IllegalStateException(
                    "Cannot forward JWT to Alfresco: principal is not a JsonWebToken");
        }

        String raw = jwt.getRawToken();
        if (raw == null || raw.isBlank()) {
            throw new IllegalStateException(
                    "Cannot forward JWT to Alfresco: JWT raw token is missing or blank");
        }

        return "Bearer " + raw;
    }

    /** The caller's raw JWT, or null when there is none or no request context is active. */
    private String callerToken() {
        try {
            if (securityIdentity == null || securityIdentity.isAnonymous()
                    || !(securityIdentity.getPrincipal() instanceof JsonWebToken jwt)) {
                return null;
            }
            String raw = jwt.getRawToken();
            return raw == null || raw.isBlank() ? null : raw;
        } catch (RuntimeException noRequestContext) {
            return null;
        }
    }

    /** Scheduled jobs run with a request context but without an HTTP request, and so without a caller JWT. */
    private static boolean inHttpRequest() {
        if (!Arc.container().requestContext().isActive()) {
            return false;
        }
        var current = Arc.container().instance(CurrentVertxRequest.class);
        return current.isAvailable() && current.get().getCurrent() != null;
    }
}
