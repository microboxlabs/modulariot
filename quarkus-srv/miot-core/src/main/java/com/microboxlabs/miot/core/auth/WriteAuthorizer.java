package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;
import java.util.Set;

/**
 * Enforces the "parent SITE_MANAGER" authorization rule for all
 * admin write operations on the settings module.
 *
 * <p>Read operations are already gated by
 * {@link OrganizationRequestFilter}: the caller must be a member of
 * the target org. For writes we require a strictly stronger role —
 * {@code SITE_MANAGER} (or {@code GROUP_ADMIN}) — <em>on the parent</em>
 * of the target org, so that TRAZA admins cannot mutate GAMA while
 * GAMA admins can still mutate TRAZA. For writes on a parent-level
 * org itself (e.g. creating a child), the parent IS the target.
 *
 * <p>Resolution order for the caller's email:
 * <ol>
 *   <li>{@link OrganizationContext#getUserEmail()} — populated by
 *       {@code OrganizationRequestFilter} for org-scoped requests.</li>
 * </ol>
 * If the email is missing, the request is rejected with 403 — the
 * filter should already have failed earlier, so reaching this helper
 * without an email means something is misconfigured.
 */
@ApplicationScoped
public class WriteAuthorizer {

    private static final Set<String> ADMIN_ROLES = Set.of("SITE_MANAGER", "GROUP_ADMIN");

    private final IAlfrescoMembershipClient membershipClient;
    private final OrganizationContext organizationContext;

    @Inject
    public WriteAuthorizer(IAlfrescoMembershipClient membershipClient,
                           OrganizationContext organizationContext) {
        this.membershipClient = membershipClient;
        this.organizationContext = organizationContext;
    }

    /**
     * Require that the caller has a manager-level role on the parent
     * of {@code target}. For a parent-level target the role is checked
     * against the target itself.
     *
     * @return a {@link Uni} that completes with {@code null} on success
     *         and fails with {@link ForbiddenException} otherwise
     */
    public Uni<Void> requireParentSiteManager(Organization target) {
        if (target == null) {
            return Uni.createFrom().failure(new ForbiddenException("Organization not found"));
        }
        Organization authTarget = target.parent != null ? target.parent : target;
        if (authTarget.alfrescoGroupId == null) {
            return Uni.createFrom().failure(new ForbiddenException(
                    "Parent organization has no Alfresco group; cannot authorize write"));
        }
        String email = organizationContext.getUserEmail();
        if (email == null) {
            return Uni.createFrom().failure(new ForbiddenException(
                    "Cannot resolve caller identity for write authorization"));
        }
        return membershipClient.getRole(email, authTarget.alfrescoGroupId)
                .flatMap(role -> {
                    if (role != null && ADMIN_ROLES.contains(role)) {
                        return Uni.createFrom().voidItem();
                    }
                    return Uni.createFrom().failure(new ForbiddenException(
                            "SITE_MANAGER role required on parent organization"));
                });
    }
}
