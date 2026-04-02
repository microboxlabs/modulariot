package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.inject.Inject;
import jakarta.ws.rs.container.ContainerRequestContext;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;
import org.jboss.resteasy.reactive.server.ServerRequestFilter;

/**
 * Validates organization membership for all org-scoped endpoints.
 * Intercepts requests to /api/v1/orgs/{organizationId}/... and:
 *
 *   Web users (JWT has email claim):
 *     - Validates Alfresco group membership
 *     - Role is read from Alfresco
 *
 *   M2M services (no email claim):
 *     - Validates that JWT aud/azp matches org.tenantClientId
 *     - No Alfresco check — the M2M token itself is proof of authorization
 *
 * Hierarchy:
 *   - Parent orgs (parent == null): effectiveClientIds = [own] + [all direct children]
 *   - Child orgs (parent != null): effectiveClientIds = [own]
 *
 * In both cases TenantContext.clientId is set to org.tenantClientId (used for writes)
 * and TenantContext.effectiveClientIds is set for read-scoped queries.
 *
 * Dev fallback: X-Organization-Id header + X-Client-Id header bypass JWT checks.
 */
public class OrganizationRequestFilter {

    private static final Logger LOG = Logger.getLogger(OrganizationRequestFilter.class);
    private static final String ORG_PATH_PREFIX = "/api/v1/orgs/";
    private static final String ORG_HEADER = "X-Organization-Id";

    @Inject TenantContext tenantContext;
    @Inject OrganizationContext organizationContext;
    @Inject SecurityIdentity securityIdentity;
    @Inject IAlfrescoMembershipClient alfrescoMembership;

    @ConfigProperty(name = "miot.auth.client-id-claims", defaultValue = "aud,azp")
    List<String> clientIdClaims;

    @ServerRequestFilter
    public Uni<Void> filter(ContainerRequestContext requestContext) {
        String path = requestContext.getUriInfo().getPath();
        String orgSlug = extractOrgSlug(path);

        if (orgSlug == null) {
            return Uni.createFrom().voidItem();
        }

        return Panache.withSession(() ->
            Organization.<Organization>find("slug = ?1 and active = true", orgSlug).firstResult()
                .flatMap(org -> {
                    if (org == null) {
                        requestContext.abortWith(Response.status(Response.Status.NOT_FOUND)
                                .entity("{\"error\":\"Organization not found: " + orgSlug + "\"}")
                                .type("application/json")
                                .build());
                        return Uni.createFrom().voidItem();
                    }

                    String email = resolveEmail(requestContext);
                    String m2mClientId = resolveM2mClientId(requestContext);

                    Uni<String> accessValidation;
                    if (email != null) {
                        accessValidation = validateWebUser(requestContext, org, email);
                    } else if (m2mClientId != null) {
                        accessValidation = validateM2mClient(requestContext, org, m2mClientId);
                    } else {
                        requestContext.abortWith(Response.status(Response.Status.UNAUTHORIZED)
                                .entity("{\"error\":\"Cannot resolve caller identity for organization request\"}")
                                .type("application/json")
                                .build());
                        return Uni.createFrom().voidItem();
                    }

                    return accessValidation.flatMap(role ->
                        resolveEffectiveClientIds(org).invoke(ids -> applyContext(org, email, role, ids))
                    ).replaceWithVoid();
                })
        );
    }

    /**
     * For parent orgs: collects tenantClientId from all direct children.
     * For child orgs: returns a single-element list.
     */
    private Uni<List<String>> resolveEffectiveClientIds(Organization org) {
        List<String> ids = new ArrayList<>();
        ids.add(org.tenantClientId);

        if (org.parent != null) {
            // This is a child org — no children of its own
            return Uni.createFrom().item(ids);
        }

        // This is a parent org — load direct children
        return Organization.<Organization>find("parent.id = ?1 and active = true", org.id).list()
                .map(children -> {
                    children.forEach(child -> ids.add(child.tenantClientId));
                    return ids;
                });
    }

    private Uni<String> validateWebUser(ContainerRequestContext requestContext, Organization org, String email) {
        if (org.alfrescoGroupId == null) {
            return Uni.createFrom().nullItem();
        }
        return alfrescoMembership.isMember(email, org.alfrescoGroupId)
                .flatMap(isMember -> {
                    if (!isMember) {
                        requestContext.abortWith(Response.status(Response.Status.FORBIDDEN)
                                .entity("{\"error\":\"User is not a member of organization: " + org.slug + "\"}")
                                .type("application/json")
                                .build());
                        return Uni.createFrom().nullItem();
                    }
                    return alfrescoMembership.getRole(email, org.alfrescoGroupId);
                });
    }

    private Uni<String> validateM2mClient(ContainerRequestContext requestContext, Organization org, String m2mClientId) {
        if (!m2mClientId.equals(org.tenantClientId)) {
            requestContext.abortWith(Response.status(Response.Status.FORBIDDEN)
                    .entity("{\"error\":\"M2M client is not authorized for organization: " + org.slug + "\"}")
                    .type("application/json")
                    .build());
            return Uni.createFrom().nullItem();
        }
        return Uni.createFrom().nullItem();
    }

    private void applyContext(Organization org, String userEmail, String role, List<String> effectiveClientIds) {
        tenantContext.setClientId(org.tenantClientId);
        tenantContext.setTenantCode(org.tenantClientId);
        tenantContext.setEffectiveClientIds(effectiveClientIds);
        organizationContext.setOrganizationId(org.slug);
        organizationContext.setUserEmail(userEmail);
        organizationContext.setAlfrescoRole(role);
        LOG.debugf("Organization resolved: slug=%s tenant=%s effectiveIds=%s user=%s role=%s",
                org.slug, org.tenantClientId, effectiveClientIds, userEmail, role);
    }

    private String extractOrgSlug(String path) {
        if (!path.startsWith(ORG_PATH_PREFIX)) return null;
        String rest = path.substring(ORG_PATH_PREFIX.length());
        int slash = rest.indexOf('/');
        String slug = slash == -1 ? rest : rest.substring(0, slash);
        return slug.isBlank() ? null : slug;
    }

    private String resolveEmail(ContainerRequestContext requestContext) {
        if (securityIdentity != null && !securityIdentity.isAnonymous()) {
            var principal = securityIdentity.getPrincipal();
            if (principal instanceof JsonWebToken jwt) {
                String email = jwt.getClaim("email");
                if (email != null && !email.isBlank()) return email;
            }
        }
        return requestContext.getHeaderString(ORG_HEADER);
    }

    private String resolveM2mClientId(ContainerRequestContext requestContext) {
        if (securityIdentity != null && !securityIdentity.isAnonymous()) {
            var principal = securityIdentity.getPrincipal();
            if (principal instanceof JsonWebToken jwt) {
                for (String claim : clientIdClaims) {
                    Object val = jwt.getClaim(claim.trim());
                    if (val instanceof List<?> list && !list.isEmpty()) return list.get(0).toString();
                    if (val != null) return val.toString();
                }
            }
        }
        return tenantContext.getClientId();
    }
}
