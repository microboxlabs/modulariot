package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.Caller;
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
 * Lets a caller into an organization and fills the request's {@link TenantContext} and
 * {@link OrganizationContext}. Membership is decided by {@link AccessEvaluator}.
 *
 * <p>A parent organization reads its children's data too: its effective client ids are its own and its direct
 * children's. A child reads only its own.
 *
 * <p>{@link OrganizationRequestFilter} uses this for the org-scoped REST paths; the MCP tools use it for the
 * organization named in their arguments.
 */
@ApplicationScoped
public class OrganizationAccess {

    private static final Logger LOG = Logger.getLogger(OrganizationAccess.class);

    /** Why a caller was refused, and the HTTP status for it. */
    public record Refusal(Response.Status status, String message) {
    }

    private final TenantContext tenantContext;
    private final OrganizationContext organizationContext;
    private final AccessEvaluator evaluator;

    @Inject
    public OrganizationAccess(
            TenantContext tenantContext,
            OrganizationContext organizationContext,
            AccessEvaluator evaluator) {
        this.tenantContext = tenantContext;
        this.organizationContext = organizationContext;
        this.evaluator = evaluator;
    }

    /**
     * Null when the caller is let in, a refusal otherwise. Needs a Vert.x context: it reads the organization through
     * Hibernate Reactive.
     */
    public Uni<Refusal> enter(String slug, String email, String m2mClientId) {
        return enter(slug, email != null ? Caller.user(email) : Caller.client(m2mClientId));
    }

    /** {@link #enter(String, String, String)} for any kind of caller, service accounts included. */
    public Uni<Refusal> enter(String slug, Caller caller) {
        if (!caller.isUser() && !caller.isClient() && !caller.isServiceAccount()) {
            return refuse(Response.Status.UNAUTHORIZED, "Cannot resolve caller identity for organization request");
        }
        return Panache.withSession(() -> Organization.findBySlug(slug)
                .flatMap(org -> org == null
                        ? refuse(Response.Status.FORBIDDEN, "Access denied")
                        : evaluator.evaluate(slug, caller).flatMap(access -> admit(org, caller, access))));
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

    private Uni<Refusal> admit(Organization org, Caller caller, Access access) {
        if (!access.member()) {
            String message = caller.isUser()
                    ? "User is not a member of organization: " + org.slug
                    : "Caller is not authorized for organization: " + org.slug;
            return refuse(Response.Status.FORBIDDEN, message);
        }
        return effectiveClientIds(org)
                .invoke(ids -> apply(org, caller.email(), access.alfrescoRole(), ids))
                .replaceWith((Refusal) null);
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
}
