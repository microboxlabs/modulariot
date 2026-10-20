package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.api.dto.AuthorizationCheckRequest;
import com.microboxlabs.miot.core.api.dto.AuthorizationDecisionDto;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.IamDirectory;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;

/**
 * Who holds each permission in {@link OrganizationPermissionDefinition}: a subject holds it when they hold its role
 * (an IAM role binding, assigned on the Team page), or, for permissions granted to owners, when they are an Owner or
 * Admin.
 */
@ApplicationScoped
public class OrganizationPermissionService {

    private final OrganizationRoleService roleService;
    private final OrganizationContext organizationContext;

    @Inject
    public OrganizationPermissionService(
            OrganizationRoleService roleService,
            OrganizationContext organizationContext) {
        this.roleService = roleService;
        this.organizationContext = organizationContext;
    }

    public Uni<AuthorizationDecisionDto> check(
            String organizationSlug, AuthorizationCheckRequest request) {
        if (request == null || request.subjectId() == null || request.subjectId().isBlank()) {
            throw new BadRequestException("subjectId is required");
        }
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode(request.permissionCode());
        String subjectId = request.subjectId().trim();

        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> isAllowed(org, permission, subjectId))
                .map(allowed -> new AuthorizationDecisionDto(
                        permission.permissionCode(), subjectId, allowed)));
    }

    /** The caller's own decision for a permission, e.g. to show or hide actions. */
    public Uni<AuthorizationDecisionDto> checkCurrentUser(
            String organizationSlug, String permissionCode) {
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode(permissionCode);
        String personId = organizationContext.getUserEmail();
        if (personId == null || personId.isBlank()) {
            return Uni.createFrom().item(new AuthorizationDecisionDto(
                    permission.permissionCode(), null, false));
        }
        return Panache.withSession(() -> findOrganization(organizationSlug)
                        .flatMap(org -> hasPermission(org, permission, personId)))
                .map(allowed -> new AuthorizationDecisionDto(
                        permission.permissionCode(), personId, allowed));
    }

    /** Fails with 403 unless the caller holds the permission in the organization. */
    public Uni<Void> requirePermission(
            String organizationSlug, OrganizationPermissionDefinition permission) {
        String personId = organizationContext.getUserEmail();
        if (personId == null || personId.isBlank()) {
            return forbidden(permission);
        }
        return Panache.withSession(() -> findOrganization(organizationSlug)
                        .flatMap(org -> hasPermission(org, permission, personId)))
                .flatMap(allowed -> Boolean.TRUE.equals(allowed)
                        ? Uni.createFrom().voidItem()
                        : forbidden(permission));
    }

    Uni<Boolean> hasPermission(
            Organization organization,
            OrganizationPermissionDefinition permission,
            String personId) {
        if (!permission.grantedToOwners()) {
            return isAllowed(organization, permission, personId);
        }
        return roleService.resolveApplicationRole(organization, personId)
                .flatMap(role -> OrganizationRoleService.OWNER_ACCESS_ROLE.equals(role)
                        ? Uni.createFrom().item(true)
                        : isAllowed(organization, permission, personId));
    }

    private static Uni<Void> forbidden(OrganizationPermissionDefinition permission) {
        return Uni.createFrom().failure(new ForbiddenException(
                "Organization permission required: " + permission.permissionCode()));
    }

    private Uni<Organization> findOrganization(String organizationSlug) {
        return Organization.findBySlug(organizationSlug)
                .flatMap(org -> org == null
                        ? Uni.createFrom().failure(new NotFoundException(
                                "Organization not found: " + organizationSlug))
                        : Uni.createFrom().item(org));
    }

    /**
     * Whether the subject holds the permission's role. A user's roles come from the evaluator (membership, scope,
     * expiry, parent organization); an M2M client's from its bindings that apply.
     */
    Uni<Boolean> isAllowed(
            Organization organization,
            OrganizationPermissionDefinition permission,
            String subjectId) {
        if (!IamDirectory.isEmail(subjectId)) {
            return roleService.clientRoles(organization, subjectId)
                    .map(roles -> roles.contains(permission.roleCode()));
        }
        return roleService.access(organization, Caller.user(subjectId))
                .map(access -> access.roles().contains(permission.roleCode()));
    }
}
