package com.microboxlabs.miot.core.auth;

import io.quarkus.security.identity.SecurityIdentity;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.container.ContainerRequestFilter;
import jakarta.ws.rs.core.Response;
import jakarta.ws.rs.ext.Provider;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * Extracts tenant client_id from JWT claims and populates TenantContext.
 *
 * The claim names to check are configurable via miot.auth.client-id-claims
 * (comma-separated, checked in order). This supports different Auth0 token types:
 *   - OIDC web app: client_id is typically in "aud"
 *   - M2M (Client Credentials): client_id is typically in "azp"
 *
 * Falls back to X-Client-Id header when no JWT is present (dev mode).
 */
@Provider
public class TenantRequestFilter implements ContainerRequestFilter {

    private static final Logger LOG = Logger.getLogger(TenantRequestFilter.class);
    private static final String CLIENT_ID_HEADER = "X-Client-Id";

    @Inject
    TenantContext tenantContext;

    @Inject
    SecurityIdentity securityIdentity;

    @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
    List<String> clientIdClaims;

    @Override
    public void filter(ContainerRequestContext requestContext) {
        String path = requestContext.getUriInfo().getPath();
        if (!path.startsWith("/api/")) {
            return;
        }

        String clientId = null;

        if (securityIdentity != null && !securityIdentity.isAnonymous()) {
            // Extract claims from the JWT principal
            var principal = securityIdentity.getPrincipal();
            if (principal instanceof JsonWebToken jwt) {
                for (String claim : clientIdClaims) {
                    String trimmed = claim.trim();
                    Object val = jwt.getClaim(trimmed);
                    if (val != null) {
                        // aud can be a list — take the first element
                        if (val instanceof List<?> list && !list.isEmpty()) {
                            clientId = list.get(0).toString();
                        } else {
                            clientId = val.toString();
                        }
                        LOG.debugf("Resolved client_id from claim '%s': %s", trimmed, clientId);
                        break;
                    }
                }
            }
        }

        // Dev fallback: X-Client-Id header
        if (clientId == null) {
            clientId = requestContext.getHeaderString(CLIENT_ID_HEADER);
        }

        if (clientId == null || clientId.isBlank()) {
            requestContext.abortWith(
                    Response.status(Response.Status.UNAUTHORIZED)
                            .entity("{\"error\":\"Missing client_id. JWT must contain one of: " +
                                    String.join(", ", clientIdClaims) + ". Or use X-Client-Id header in dev mode.\"}")
                            .type("application/json")
                            .build());
            return;
        }

        tenantContext.setClientId(clientId);
        tenantContext.setTenantCode(clientId);
    }
}
