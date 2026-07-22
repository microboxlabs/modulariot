package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.api.dto.AuthorizationCheckRequest;
import com.microboxlabs.miot.core.api.dto.AuthorizationDecisionDto;
import com.microboxlabs.miot.core.api.dto.OrganizationPermissionDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationPermissionRequest;
import com.microboxlabs.miot.core.auth.WriteAuthorizer;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationPermissionSetting;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.NotFoundException;
import java.time.Instant;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/**
 * Owns application permissions and role assignments inside the modulith.
 * Alfresco remains an organization directory, but it is not a permission
 * projection target and is never called from this service.
 */
@ApplicationScoped
public class OrganizationPermissionService {

    private final WriteAuthorizer writeAuthorizer;

    @Inject
    public OrganizationPermissionService(WriteAuthorizer writeAuthorizer) {
        this.writeAuthorizer = writeAuthorizer;
    }

    public Uni<OrganizationPermissionDto> get(
            String organizationSlug, String permissionCode) {
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode(permissionCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> loadDto(org.id, permission)));
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
                                .flatMap(ignored -> replaceAssignments(
                                        organizationId, permission.roleCode(), assigneeIds))
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

    private Uni<Long> authorizeAndResolve(String organizationSlug) {
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> writeAuthorizer.requireParentSiteManager(org)
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

    @SuppressWarnings("java:S3252")
    private Uni<Void> replaceAssignments(
            Long organizationId, String roleCode, Set<String> assigneeIds) {
        return OrganizationRoleAssignment
                .delete("id.organizationId = ?1 and id.roleCode = ?2", organizationId, roleCode)
                .flatMap(ignored -> persistAssignments(organizationId, roleCode, assigneeIds));
    }

    private Uni<Void> persistAssignments(
            Long organizationId, String roleCode, Set<String> assigneeIds) {
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String subjectId : assigneeIds) {
            chain = chain.flatMap(ignored -> new OrganizationRoleAssignment(
                    organizationId, roleCode, subjectId).persist().replaceWithVoid());
        }
        return chain;
    }

    private Uni<OrganizationPermissionDto> loadDto(
            Long organizationId, OrganizationPermissionDefinition permission) {
        return OrganizationPermissionSetting
                .findSetting(organizationId, permission.permissionCode())
                .flatMap(setting -> OrganizationRoleAssignment
                        .findAssignments(organizationId, permission.roleCode())
                        .map(assignments -> new OrganizationPermissionDto(
                                setting != null && setting.enabled,
                                permission.permissionCode(),
                                permission.roleCode(),
                                assignments.stream()
                                        .map(assignment -> assignment.id.personId)
                                        .sorted()
                                        .toList())));
    }

    private Uni<Boolean> isAllowed(
            Long organizationId,
            OrganizationPermissionDefinition permission,
            String subjectId) {
        return OrganizationPermissionSetting
                .findSetting(organizationId, permission.permissionCode())
                .flatMap(setting -> {
                    if (setting == null || !setting.enabled) {
                        return Uni.createFrom().item(false);
                    }
                    return OrganizationRoleAssignment.hasAssignment(
                            organizationId, permission.roleCode(), subjectId);
                });
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
