package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.core.Response;
import java.util.ArrayList;
import java.util.List;
import org.eclipse.microprofile.jwt.JsonWebToken;
import org.jboss.logging.Logger;

/**
 * Lets a caller into an organization and fills the request's
 * {@link TenantContext} and {@link OrganizationContext}.
 *
 * <p>A web user (the token has an email) must be a member of the
 * organization's Alfresco group, and gets their role from there. An M2M client
 * (no email) must be the organization's own tenant client.
 *
 * <p>A parent organization reads its children's data too: its effective
 * client ids are its own and its direct children's. A child reads only its own.
 *
 * <p>{@link OrganizationRequestFilter} uses this for the org-scoped REST paths;
 * the MCP tools use it for the organization named in their arguments.
 */
@ApplicationScoped
public class OrganizationAccess {

    private static final Logger LOG = Logger.getLogger(OrganizationAccess.class);

    /** Why a caller was refused, and the HTTP status for it. */
    public record Refusal(Response.Status status, String message) {
    }

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final IAlfrescoMembershipClient alfrescoMembership;

    @Inject
    public OrganizationAccess(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            IAlfrescoMembershipClient alfrescoMembership) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.alfrescoMembership = alfrescoMembership;
    }

    /**
     * Null when the caller is let in, a refusal otherwise. Needs a Vert.x
     * context: it reads the organization through Hibernate Reactive.
     */
    public Uni<Refusal> enter(String slug, String email, String m2mClientId) {
        return Panache.withSession(() -> Organization.findBySlug(slug)
                .flatMap(org -> org == null
                        ? refuse(Response.Status.FORBIDDEN, "Access denied")
                        : validateAndApply(org, email, m2mClientId)));
    }

    /** The email claim of the caller's token, if it has one. */
    public static String email(SecurityIdentity identity) {
        if (identity != null && !identity.isAnonymous()
                && identity.getPrincipal() instanceof JsonWebToken jwt) {
            String email = jwt.getClaim("email");
            if (email != null && !email.isBlank()) {
                return email;
            }
        }
        return null;
    }

    /** The first of the given claims the caller's token has, as the client id. */
    public static String clientId(SecurityIdentity identity, List<String> claims) {
        if (identity != null && !identity.isAnonymous()
                && identity.getPrincipal() instanceof JsonWebToken jwt) {
            for (String claim : claims) {
                String value = claimValue(jwt.getClaim(claim.trim()));
                if (value != null) {
                    return value;
                }
            }
        }
        return null;
    }

    private Uni<Refusal> validateAndApply(Organization org, String email, String m2mClientId) {
        Uni<Membership> membership;
        if (email != null) {
            membership = validateWebUser(org, email);
        } else if (m2mClientId != null) {
            membership = validateM2mClient(org, m2mClientId);
        } else {
            return refuse(Response.Status.UNAUTHORIZED, "Cannot resolve caller identity for organization request");
        }

        return membership.flatMap(result -> {
            if (result.refusal() != null) {
                return Uni.createFrom().item(result.refusal());
            }
            return effectiveClientIds(org)
                    .invoke(ids -> apply(org, email, result.role(), ids))
                    .replaceWith((Refusal) null);
        });
    }

    private Uni<List<String>> effectiveClientIds(Organization org) {
        List<String> ids = new ArrayList<>();
        ids.add(org.tenantClientId);

        if (org.parent != null) {
            return Uni.createFrom().item(ids);
        }

        return Organization.findByParent(org.id)
                .map(children -> {
                    children.forEach(child -> ids.add(child.tenantClientId));
                    return ids;
                });
    }

    private Uni<Membership> validateWebUser(Organization org, String email) {
        if (org.alfrescoGroupId == null) {
            return Uni.createFrom().item(Membership.allow(null));
        }
        return alfrescoMembership.isMember(email, org.alfrescoGroupId)
                .flatMap(isMember -> {
                    if (!Boolean.TRUE.equals(isMember)) {
                        return Uni.createFrom().item(Membership.deny(new Refusal(
                                Response.Status.FORBIDDEN,
                                "User is not a member of organization: " + org.slug)));
                    }
                    return alfrescoMembership.getRole(email, org.alfrescoGroupId)
                            .map(Membership::allow);
                });
    }

    private static Uni<Membership> validateM2mClient(Organization org, String m2mClientId) {
        if (!m2mClientId.equals(org.tenantClientId)) {
            return Uni.createFrom().item(Membership.deny(new Refusal(
                    Response.Status.FORBIDDEN,
                    "M2M client is not authorized for organization: " + org.slug)));
        }
        return Uni.createFrom().item(Membership.allow(null));
    }

    private void apply(Organization org, String userEmail, String role, List<String> effectiveClientIds) {
        tenantContext.setClientId(org.tenantClientId);
        tenantContext.setTenantCode(org.tenantClientId);
        tenantContext.setEffectiveClientIds(effectiveClientIds);
        organizationContext.setOrganizationId(org.slug);
        organizationContext.setUserEmail(userEmail);
        organizationContext.setAlfrescoRole(role);
        organizationContext.setAlfrescoGroupId(org.alfrescoGroupId);
        LOG.debugf("Organization resolved: slug=%s tenant=%s effectiveIds=%s user=%s role=%s",
                org.slug, org.tenantClientId, effectiveClientIds, userEmail, role);
    }

    private static Uni<Refusal> refuse(Response.Status status, String message) {
        return Uni.createFrom().item(new Refusal(status, message));
    }

    private static String claimValue(Object val) {
        if (val instanceof List<?> list && !list.isEmpty()) {
            return list.get(0).toString();
        }
        return val != null ? val.toString() : null;
    }

    private record Membership(String role, Refusal refusal) {
        private static Membership allow(String role) {
            return new Membership(role, null);
        }

        private static Membership deny(Refusal refusal) {
            return new Membership(null, refusal);
        }
    }
}
