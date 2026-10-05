package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.api.dto.OrganizationRoleDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.auth.OrganizationMembership;
import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import jakarta.ws.rs.BadRequestException;
import jakarta.ws.rs.ForbiddenException;
import jakarta.ws.rs.NotFoundException;
import java.util.HashSet;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;

/**
 * Owns application roles and organization-owner authorization. Roles live in
 * {@code miot_core.organization_role_assignments}: {@value #OWNER_ROLE_CODE} plus the codes each
 * {@link OrganizationRoleCatalog} adds. With Alfresco membership, an organization with no owner
 * assigned yet takes its owners from the Alfresco managers; with native membership it has none until
 * a platform owner assigns them.
 */
@ApplicationScoped
public class OrganizationRoleService {

    public static final String OWNER_ROLE_CODE = "ORGANIZATION_OWNER";
    public static final String OWNER_ACCESS_ROLE = "OWNER";
    public static final String MEMBER_ACCESS_ROLE = "MEMBER";

    private static final Set<String> BOOTSTRAP_MANAGER_ROLES =
            Set.of("SITE_MANAGER", "GROUP_ADMIN");

    private final IAlfrescoMembershipClient membershipClient;
    private final OrganizationContext organizationContext;
    private final OrganizationMembership membership;
    private final Set<String> roleCodes;

    @Inject
    public OrganizationRoleService(
            IAlfrescoMembershipClient membershipClient,
            OrganizationContext organizationContext,
            OrganizationMembership membership,
            Instance<OrganizationRoleCatalog> catalogs) {
        this.membershipClient = membershipClient;
        this.organizationContext = organizationContext;
        this.membership = membership;
        Set<String> codes = new TreeSet<>();
        codes.add(OWNER_ROLE_CODE);
        if (catalogs != null) {
            catalogs.forEach(catalog -> codes.addAll(catalog.roleCodes()));
        }
        this.roleCodes = Set.copyOf(codes);
    }

    /** Whether membership comes from the modulith's own role assignments. */
    public boolean nativeMembership() {
        return membership != null && membership.isNative();
    }

    /** {@link #OWNER_ACCESS_ROLE} or {@link #MEMBER_ACCESS_ROLE}. */
    public Uni<String> resolveApplicationRole(Organization organization, String personId) {
        return roles(organization, personId)
                .map(roles -> roles.contains(OWNER_ROLE_CODE) ? OWNER_ACCESS_ROLE : MEMBER_ACCESS_ROLE);
    }

    /** The role codes the caller holds in the organization the request entered; none for an M2M caller. */
    public Uni<Set<String>> callerRoles(String organizationSlug) {
        String personId = organizationContext.getUserEmail();
        if (personId == null || personId.isBlank()) {
            return Uni.createFrom().item(Set.of());
        }
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(organization -> roles(organization, personId)));
    }

    /**
     * The role codes {@code personId} holds in {@code organization} or, for a sub-account, its parent. With
     * Alfresco membership and no owner assigned, an Alfresco manager also holds {@value #OWNER_ROLE_CODE}.
     */
    public Uni<Set<String>> roles(Organization organization, String personId) {
        Organization ownerOrganization = ownerOrganization(organization);
        return OrganizationRoleAssignment.findForOrganizations(OrganizationMembership.roleScope(organization))
                .flatMap(assignments -> {
                    Set<String> held = OrganizationMembership.heldRoles(assignments, personId);
                    if (nativeMembership() || held.contains(OWNER_ROLE_CODE)) {
                        return Uni.createFrom().item(held);
                    }
                    List<OrganizationRoleAssignment> owners = assignments.stream()
                            .filter(a -> OWNER_ROLE_CODE.equals(a.id.roleCode)
                                    && ownerOrganization.id.equals(a.id.organizationId))
                            .toList();
                    if (!owners.isEmpty()) {
                        return Uni.createFrom().item(held);
                    }
                    return resolveBootstrapRole(ownerOrganization, personId)
                            .map(role -> OWNER_ACCESS_ROLE.equals(role) ? withOwner(held) : held);
                });
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
        String role = knownRole(roleCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(organization -> requireOwner(organization)
                        .flatMap(ignored -> loadDto(ownerOrganization(organization).id, role, true))));
    }

    public Uni<OrganizationRoleDto> replace(
            String organizationSlug,
            String roleCode,
            SetOrganizationRoleRequest request) {
        String role = knownRole(roleCode);
        Set<String> assigneeIds = normalizeAssignees(request, role);

        return authorizeAndValidate(organizationSlug, assigneeIds)
                .flatMap(organizationId -> Panache.withTransaction(() ->
                        replaceAssignments(organizationId, role, assigneeIds)
                                .flatMap(ignored -> loadDto(organizationId, role, true))));
    }

    /** {@link #get} for a platform owner, who need not belong to the organization. */
    public Uni<OrganizationRoleDto> getAsPlatform(String organizationSlug, String roleCode) {
        String role = knownRole(roleCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(organization -> loadDto(ownerOrganization(organization).id, role, false)));
    }

    /**
     * {@link #replace} for a platform owner: how a new organization gets its first owner. Assignees are not
     * checked against Alfresco.
     */
    public Uni<OrganizationRoleDto> replaceAsPlatform(
            String organizationSlug,
            String roleCode,
            SetOrganizationRoleRequest request) {
        String role = knownRole(roleCode);
        Set<String> assigneeIds = normalizeAssignees(request, role);
        return Panache.withTransaction(() -> findOrganization(organizationSlug)
                .flatMap(organization -> {
                    Long organizationId = ownerOrganization(organization).id;
                    return replaceAssignments(organizationId, role, assigneeIds)
                            .flatMap(ignored -> loadDto(organizationId, role, false));
                }));
    }

    private String knownRole(String roleCode) {
        if (roleCode == null || !roleCodes.contains(roleCode)) {
            throw new BadRequestException("Unknown organization role: " + roleCode);
        }
        return roleCode;
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

    /** With native membership a role is what makes someone a member, so there is nothing to check. */
    private Uni<Void> validateMembers(
            Organization ownerOrganization, Set<String> assigneeIds) {
        if (nativeMembership()) {
            return Uni.createFrom().voidItem();
        }
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
                                    "Assignee must be an organization member: " + personId))));
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

    /**
     * The role's assignees. With Alfresco membership and no owner assigned yet, {@code withBootstrapOwner}
     * shows the caller, who got this far as an Alfresco manager.
     */
    private Uni<OrganizationRoleDto> loadDto(Long organizationId, String roleCode, boolean withBootstrapOwner) {
        return OrganizationRoleAssignment.findAssignments(organizationId, roleCode)
                .map(assignments -> {
                    List<String> persistedIds = assignments.stream()
                            .map(assignment -> assignment.id.personId)
                            .sorted()
                            .toList();
                    String caller = organizationContext.getUserEmail();
                    if (persistedIds.isEmpty() && withBootstrapOwner && caller != null
                            && OWNER_ROLE_CODE.equals(roleCode) && !nativeMembership()) {
                        return new OrganizationRoleDto(roleCode, List.of(caller));
                    }
                    return new OrganizationRoleDto(roleCode, persistedIds);
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
        return OrganizationMembership.roleOwner(organization);
    }

    private static Set<String> withOwner(Set<String> held) {
        Set<String> roles = new TreeSet<>(held);
        roles.add(OWNER_ROLE_CODE);
        return roles;
    }

    /** Trimmed, blank ids dropped. Only {@value #OWNER_ROLE_CODE} must keep at least one assignee. */
    static Set<String> normalizeAssignees(SetOrganizationRoleRequest request, String roleCode) {
        if (request == null || request.assigneeIds() == null) {
            throw new BadRequestException("assigneeIds list is required");
        }
        Set<String> normalized = new HashSet<>();
        for (String personId : request.assigneeIds()) {
            if (personId != null && !personId.isBlank()) {
                normalized.add(personId.trim());
            }
        }
        if (normalized.isEmpty() && OWNER_ROLE_CODE.equals(roleCode)) {
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
