package com.microboxlabs.miot.core.alfresco.auth;

import io.quarkus.arc.lookup.LookupIfProperty;
import io.quarkus.security.identity.SecurityIdentity;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
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
 * than a silent success against Alfresco.
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.alfresco.auth", stringValue = "oauth")
public class OAuthBearerAuthProvider implements AlfrescoAuthProvider {

    private final SecurityIdentity securityIdentity;

    @Inject
    public OAuthBearerAuthProvider(SecurityIdentity securityIdentity) {
        this.securityIdentity = securityIdentity;
    }

    @Override
    public String resolveAuthHeader() {
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
}
