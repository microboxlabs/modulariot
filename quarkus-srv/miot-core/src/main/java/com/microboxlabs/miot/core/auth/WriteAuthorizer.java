package com.microboxlabs.miot.core.auth;

import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.model.Organization;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.ForbiddenException;

/**
 * Authorizes settings writes on an organization. The permission is checked on the top-level organization, so an
 * Admin of the account can change its sub-accounts and a member of one sub-account cannot change another.
 */
@ApplicationScoped
public class WriteAuthorizer {

    private final OrganizationContext organizationContext;
    private final AccessEvaluator evaluator;

    @Inject
    public WriteAuthorizer(OrganizationContext organizationContext, AccessEvaluator evaluator) {
        this.organizationContext = organizationContext;
        this.evaluator = evaluator;
    }

    /**
     * Fails with {@link ForbiddenException} unless the caller holds {@code permission} on the top-level
     * organization of {@code target}. Needs an open session.
     */
    public Uni<Void> require(Organization target, String permission) {
        if (target == null) {
            return Uni.createFrom().failure(new ForbiddenException("Organization not found"));
        }
        String email = organizationContext.getUserEmail();
        if (email == null) {
            return Uni.createFrom().failure(new ForbiddenException(
                    "Cannot resolve caller identity for write authorization"));
        }
        return evaluator.root(target).flatMap(root -> evaluator.evaluate(root, Caller.user(email)))
                .flatMap(access -> access.can(permission)
                        ? Uni.createFrom().voidItem()
                        : Uni.createFrom().failure(new ForbiddenException("Permission required: " + permission)));
    }
}
