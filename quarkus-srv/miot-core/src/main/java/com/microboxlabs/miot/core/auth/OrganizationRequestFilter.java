package com.microboxlabs.miot.core.auth;

import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.MediaType;
import jakarta.ws.rs.core.Response;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.resteasy.reactive.server.ServerRequestFilter;

/**
 * Validates organization membership for all org-scoped endpoints.
 * Intercepts requests to {orgPathPrefix}{organizationId}/... and lets the
 * caller in through {@link OrganizationAccess}, which checks membership and
 * fills TenantContext and OrganizationContext.
 *
 * Dev fallback: the X-Dev-User-Email header stands in for the token's email,
 * and the X-Client-Id header (read by TenantRequestFilter) for its client id.
 */
public class OrganizationRequestFilter {

    private final TenantContext tenantContext;
    private final SecurityIdentity securityIdentity;
    private final OrganizationAccess organizationAccess;
    private final List<String> clientIdClaims;
    private final String orgPathPrefix;

    @Inject
    public OrganizationRequestFilter(
            TenantContext tenantContext,
            SecurityIdentity securityIdentity,
            OrganizationAccess organizationAccess,
            @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp") List<String> clientIdClaims,
            @ConfigProperty(name = "miot.auth.org-path-prefix", defaultValue = "/api/v1/orgs/") String orgPathPrefix) {
        this.tenantContext = tenantContext;
        this.securityIdentity = securityIdentity;
        this.organizationAccess = organizationAccess;
        this.clientIdClaims = clientIdClaims;
        this.orgPathPrefix = orgPathPrefix;
    }

    @ServerRequestFilter
    public Uni<Response> filter(ContainerRequestContext requestContext) {
        String path = requestContext.getUriInfo().getPath();
        String orgSlug = extractOrgSlug(path);

        if (orgSlug == null) {
            return Uni.createFrom().nullItem();
        }

        return organizationAccess.enter(orgSlug, resolveEmail(requestContext), resolveM2mClientId())
                .map(refusal -> refusal == null ? null : jsonResponse(refusal.status(), refusal.message()));
    }

    private Response jsonResponse(Response.Status status, String error) {
        return Response.status(status)
                .entity("{\"error\":\"" + error + "\"}")
                .type(MediaType.APPLICATION_JSON)
                .build();
    }

    private String extractOrgSlug(String path) {
        if (!path.startsWith(orgPathPrefix)) return null;
        String rest = path.substring(orgPathPrefix.length());
        int slash = rest.indexOf('/');
        String slug = slash == -1 ? rest : rest.substring(0, slash);
        return slug.isBlank() ? null : slug;
    }

    private String resolveEmail(ContainerRequestContext requestContext) {
        String email = OrganizationAccess.email(securityIdentity);
        if (email != null) return email;
        // Dev-only impersonation header — distinct from the org-slug header
        return requestContext.getHeaderString("X-Dev-User-Email");
    }

    private String resolveM2mClientId() {
        String clientId = OrganizationAccess.clientId(securityIdentity, clientIdClaims);
        return clientId != null ? clientId : tenantContext.getClientId();
    }
}
