package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.api.dto.OrganizationRoleDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

/** Owns application roles and organization-owner authorization. */
@ApplicationScoped
public class OrganizationRoleService {

    public static final String OWNER_ROLE_CODE = "ORGANIZATION_OWNER";
    public static final String OWNER_ACCESS_ROLE = "OWNER";
    public static final String MEMBER_ACCESS_ROLE = "MEMBER";

    private static final Set<String> BOOTSTRAP_MANAGER_ROLES =
            Set.of("SITE_MANAGER", "GROUP_ADMIN");

    private final IAlfrescoMembershipClient membershipClient;
    private final OrganizationContext organizationContext;

    @Inject
    public OrganizationRoleService(
            IAlfrescoMembershipClient membershipClient,
            OrganizationContext organizationContext) {
        this.membershipClient = membershipClient;
        this.organizationContext = organizationContext;
    }

    public Uni<String> resolveApplicationRole(Organization organization, String personId) {
        Organization ownerOrganization = ownerOrganization(organization);
        return OrganizationRoleAssignment.findAssignments(
                        ownerOrganization.id, OWNER_ROLE_CODE)
                .flatMap(assignments -> resolveApplicationRole(
                        ownerOrganization, personId, assignments));
    }

    public Uni<Void> requireOwner(String organizationSlug) {
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(this::requireOwner));
    }

    public Uni<Void> requireOwner(Organization organization) {
        String personId = organizationContext.getUserEmail();
        if (personId == null || personId.isBlank()) {
            return forbidden();
        }
        return resolveApplicationRole(organization, personId)
                .flatMap(role -> OWNER_ACCESS_ROLE.equals(role)
                        ? Uni.createFrom().voidItem()
                        : forbidden());
    }

    public Uni<OrganizationRoleDto> get(String organizationSlug, String roleCode) {
        OrganizationRoleDefinition role = OrganizationRoleDefinition.fromCode(roleCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(organization -> requireOwner(organization)
                        .flatMap(ignored -> loadDto(
                                ownerOrganization(organization).id, role))));
    }

    public Uni<OrganizationRoleDto> replace(
            String organizationSlug,
            String roleCode,
            SetOrganizationRoleRequest request) {
        OrganizationRoleDefinition role = OrganizationRoleDefinition.fromCode(roleCode);
        Set<String> assigneeIds = normalizeAssignees(request);

        return authorizeAndValidate(organizationSlug, assigneeIds)
                .flatMap(organizationId -> Panache.withTransaction(() ->
                        replaceAssignments(organizationId, role.roleCode(), assigneeIds)
                                .flatMap(ignored -> loadDto(organizationId, role))));
    }

    private Uni<String> resolveApplicationRole(
            Organization ownerOrganization,
            String personId,
            List<OrganizationRoleAssignment> assignments) {
        String assignedRole = resolveAssignedRole(assignments, personId);
        if (assignedRole != null) {
            return Uni.createFrom().item(assignedRole);
        }
        return resolveBootstrapRole(ownerOrganization, personId);
    }

    private Uni<String> resolveBootstrapRole(
            Organization ownerOrganization, String personId) {
        if (ownerOrganization.alfrescoGroupId == null) {
            return Uni.createFrom().item(MEMBER_ACCESS_ROLE);
        }
        return membershipClient.getRole(personId, ownerOrganization.alfrescoGroupId)
                .map(OrganizationRoleService::resolveBootstrapAccessRole);
    }

    private Uni<Long> authorizeAndValidate(
            String organizationSlug, Set<String> assigneeIds) {
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(organization -> requireOwner(organization)
                        .flatMap(ignored -> {
                            Organization ownerOrganization = ownerOrganization(organization);
                            return validateMembers(ownerOrganization, assigneeIds)
                                    .replaceWith(ownerOrganization.id);
                        })));
    }

    private Uni<Void> validateMembers(
            Organization ownerOrganization, Set<String> assigneeIds) {
        if (ownerOrganization.alfrescoGroupId == null) {
            return Uni.createFrom().failure(new BadRequestException(
                    "Organization has no Alfresco membership binding"));
        }
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (String personId : assigneeIds) {
            chain = chain.flatMap(ignored -> membershipClient
                    .isMember(personId, ownerOrganization.alfrescoGroupId)
                    .flatMap(isMember -> Boolean.TRUE.equals(isMember)
                            ? Uni.createFrom().voidItem()
                            : Uni.createFrom().failure(new BadRequestException(
                                    "Owner must be an organization member: " + personId))));
        }
        return chain;
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
        for (String personId : assigneeIds) {
            chain = chain.flatMap(ignored -> new OrganizationRoleAssignment(
                    organizationId, roleCode, personId).persist().replaceWithVoid());
        }
        return chain;
    }

    private Uni<OrganizationRoleDto> loadDto(
            Long organizationId, OrganizationRoleDefinition role) {
        return OrganizationRoleAssignment.findAssignments(organizationId, role.roleCode())
                .map(assignments -> {
                    List<String> persistedIds = assignments.stream()
                            .map(assignment -> assignment.id.personId)
                            .sorted()
                            .toList();
                    if (!persistedIds.isEmpty()) {
                        return new OrganizationRoleDto(role.roleCode(), persistedIds);
                    }
                    String bootstrapOwner = organizationContext.getUserEmail();
                    return new OrganizationRoleDto(
                            role.roleCode(),
                            bootstrapOwner == null ? List.of() : List.of(bootstrapOwner));
                });
    }

    private Uni<Organization> findOrganization(String organizationSlug) {
        return Organization.findBySlug(organizationSlug)
                .flatMap(organization -> organization == null
                        ? Uni.createFrom().failure(new NotFoundException(
                                "Organization not found: " + organizationSlug))
                        : Uni.createFrom().item(organization));
    }

    private static Organization ownerOrganization(Organization organization) {
        return organization.parent != null ? organization.parent : organization;
    }

    private static Set<String> normalizeAssignees(SetOrganizationRoleRequest request) {
        if (request == null || request.assigneeIds() == null) {
            throw new BadRequestException("assigneeIds list is required");
        }
        Set<String> normalized = new HashSet<>();
        for (String personId : request.assigneeIds()) {
            if (personId != null && !personId.isBlank()) {
                normalized.add(personId.trim());
            }
        }
        if (normalized.isEmpty()) {
            throw new BadRequestException("An organization must have at least one owner");
        }
        return normalized;
    }

    static String resolveAssignedRole(
            List<OrganizationRoleAssignment> assignments, String personId) {
        boolean isOwner = assignments.stream()
                .anyMatch(assignment -> personId.equals(assignment.id.personId));
        if (isOwner) {
            return OWNER_ACCESS_ROLE;
        }
        return assignments.isEmpty() ? null : MEMBER_ACCESS_ROLE;
    }

    static String resolveBootstrapAccessRole(String alfrescoRole) {
        return BOOTSTRAP_MANAGER_ROLES.contains(alfrescoRole)
                ? OWNER_ACCESS_ROLE
                : MEMBER_ACCESS_ROLE;
    }

    private static <T> Uni<T> forbidden() {
        return Uni.createFrom().failure(new ForbiddenException(
                "Organization owner access required"));
    }
}
