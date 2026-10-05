package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.api.dto.AuthorizationCheckRequest;
import com.microboxlabs.miot.core.api.dto.AuthorizationDecisionDto;
import com.microboxlabs.miot.core.api.dto.OrganizationPermissionDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationPermissionRequest;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.iam.IamDirectory;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationPermissionSetting;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Per-organization switches for the permissions in {@link OrganizationPermissionDefinition}, and who holds each one.
 * A subject holds a permission when the organization has it switched on and the subject holds its role (an IAM role
 * binding), or, for permissions granted to owners, when the subject is an Owner or Admin.
 */
@ApplicationScoped
public class OrganizationPermissionService {

    private final OrganizationRoleService roleService;
    private final OrganizationContext organizationContext;
    private final IamDirectory directory;

    @Inject
    public OrganizationPermissionService(
            OrganizationRoleService roleService,
            OrganizationContext organizationContext,
            IamDirectory directory) {
        this.roleService = roleService;
        this.organizationContext = organizationContext;
        this.directory = directory;
    }

    public Uni<OrganizationPermissionDto> get(
            String organizationSlug, String permissionCode) {
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode(permissionCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> roleService.requireOwner(org)
                        .flatMap(ignored -> loadDto(org.id, permission))));
    }

    public Uni<OrganizationPermissionDto> replace(
            String organizationSlug,
            String permissionCode,
            SetOrganizationPermissionRequest request) {
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode(permissionCode);
        Set<String> assigneeIds = normalizeAssignees(request);

        return authorizeAndResolve(organizationSlug)
                .flatMap(organizationId -> Panache.withTransaction(() ->
                        persistSetting(organizationId, permission, request.enabled())
                                .flatMap(ignored -> directory.setHolders(organizationId, permission.roleCode(),
                                        assigneeIds, organizationContext.getUserEmail()))
                                .flatMap(ignored -> loadDto(organizationId, permission))));
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
                .flatMap(org -> isAllowed(org.id, permission, subjectId))
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
            return isAllowed(organization.id, permission, personId);
        }
        return roleService.resolveApplicationRole(organization, personId)
                .flatMap(role -> OrganizationRoleService.OWNER_ACCESS_ROLE.equals(role)
                        ? Uni.createFrom().item(true)
                        : isAllowed(organization.id, permission, personId));
    }

    private static Uni<Void> forbidden(OrganizationPermissionDefinition permission) {
        return Uni.createFrom().failure(new ForbiddenException(
                "Organization permission required: " + permission.permissionCode()));
    }

    private Uni<Long> authorizeAndResolve(String organizationSlug) {
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> roleService.requireOwner(org)
                        .replaceWith(org.id)));
    }

    private Uni<Organization> findOrganization(String organizationSlug) {
        return Organization.findBySlug(organizationSlug)
                .flatMap(org -> org == null
                        ? Uni.createFrom().failure(new NotFoundException(
                                "Organization not found: " + organizationSlug))
                        : Uni.createFrom().item(org));
    }

    private Uni<OrganizationPermissionSetting> persistSetting(
            Long organizationId,
            OrganizationPermissionDefinition permission,
            boolean enabled) {
        return OrganizationPermissionSetting
                .findSetting(organizationId, permission.permissionCode())
                .flatMap(setting -> {
                    OrganizationPermissionSetting row = setting != null
                            ? setting
                            : new OrganizationPermissionSetting(
                                    organizationId, permission.permissionCode());
                    row.enabled = enabled;
                    // Compatibility with the deployed V0.1.4 schema. There is no
                    // longer an external projection to wait for or retry.
                    row.projectionStatus = "SYNCED";
                    row.projectionError = null;
                    row.projectedAt = null;
                    row.updatedAt = Instant.now();
                    return row.<OrganizationPermissionSetting>persist();
                });
    }

    private Uni<OrganizationPermissionDto> loadDto(
            Long organizationId, OrganizationPermissionDefinition permission) {
        return OrganizationPermissionSetting
                .findSetting(organizationId, permission.permissionCode())
                .flatMap(setting -> directory.holders(organizationId, permission.roleCode())
                        .map(holders -> new OrganizationPermissionDto(
                                setting != null && setting.enabled,
                                permission.permissionCode(),
                                permission.roleCode(),
                                holders)));
    }

    Uni<Boolean> isAllowed(
            Long organizationId,
            OrganizationPermissionDefinition permission,
            String subjectId) {
        return OrganizationPermissionSetting
                .findSetting(organizationId, permission.permissionCode())
                .flatMap(setting -> {
                    if (setting == null || !setting.enabled) {
                        return Uni.createFrom().item(false);
                    }
                    return holdsRole(organizationId, permission.roleCode(), subjectId);
                });
    }

    /** Whether the user with this email, or the client with this id, holds the role on the organization. */
    private static Uni<Boolean> holdsRole(Long organizationId, String roleCode, String subjectId) {
        if (!IamDirectory.isEmail(subjectId)) {
            return IamRoleBinding.findFor(List.of(organizationId), IamRoleBinding.CLIENT, List.of(subjectId))
                    .map(bindings -> bindings.stream().anyMatch(b -> roleCode.equals(b.roleKey)));
        }
        return IamUser.findByEmail(subjectId).flatMap(user -> user == null
                ? Uni.createFrom().item(false)
                : IamRoleBinding.findFor(List.of(organizationId), IamRoleBinding.USER, List.of(user.id.toString()))
                        .map(bindings -> bindings.stream().anyMatch(b -> roleCode.equals(b.roleKey))));
    }

    private static Set<String> normalizeAssignees(SetOrganizationPermissionRequest request) {
        if (request == null || request.assigneeIds() == null) {
            throw new BadRequestException("assigneeIds list is required (can be empty)");
        }
        Set<String> normalized = new HashSet<>();
        for (String subjectId : request.assigneeIds()) {
            if (subjectId != null && !subjectId.isBlank()) {
                normalized.add(subjectId.trim());
            }
        }
        return normalized;
    }
}
