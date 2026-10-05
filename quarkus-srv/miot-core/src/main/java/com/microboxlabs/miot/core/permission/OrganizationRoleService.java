package com.microboxlabs.miot.core.permission;

import com.microboxlabs.miot.core.api.dto.OrganizationRoleDto;
import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.auth.OrganizationContext;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.AccessEvaluator;
import com.microboxlabs.miot.core.iam.BaseRole;
import com.microboxlabs.miot.core.iam.Caller;
import com.microboxlabs.miot.core.iam.IamDirectory;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.model.Organization;
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

/**
 * The organization role API over IAM: {@value #OWNER_ROLE_CODE} is the Owner base role, every other code is a
 * module role from the {@link com.microboxlabs.miot.core.iam.AccessRegistry}. "Owner access" means the Owner or
 * Admin base role; replacing the owners needs Owner.
 */
@ApplicationScoped
public class OrganizationRoleService {

    public static final String OWNER_ROLE_CODE = "ORGANIZATION_OWNER";
    public static final String OWNER_ACCESS_ROLE = "OWNER";
    public static final String MEMBER_ACCESS_ROLE = "MEMBER";

    private final OrganizationContext organizationContext;
    private final AccessEvaluator evaluator;
    private final IamDirectory directory;

    @Inject
    public OrganizationRoleService(OrganizationContext organizationContext, AccessEvaluator evaluator,
            IamDirectory directory) {
        this.organizationContext = organizationContext;
        this.evaluator = evaluator;
        this.directory = directory;
    }

    /** {@link #OWNER_ACCESS_ROLE} for an Owner or Admin, else {@link #MEMBER_ACCESS_ROLE}. Needs an open session. */
    public Uni<String> resolveApplicationRole(Organization organization, String personId) {
        return evaluator.evaluate(organization, Caller.user(personId)).map(OrganizationRoleService::accessRole);
    }

    /** The caller's access to an organization already loaded. Needs an open session. */
    public Uni<Access> access(Organization organization, Caller caller) {
        return evaluator.evaluate(organization, caller);
    }

    /** The bindings of these organizations that apply to {@code organization}, as role keys. */
    public Uni<Set<String>> clientRoles(Organization organization, String clientId) {
        return evaluator.root(organization).flatMap(root -> IamRoleBinding.findFor(
                        organization.parent == null ? List.of(organization.id) : List.of(organization.id, root.id),
                        IamRoleBinding.CLIENT, List.of(clientId))
                .map(bindings -> AccessEvaluator.covered(bindings, organization, root)));
    }

    /** The caller's access to the organization, for checks outside REST such as MCP tools. */
    public Uni<Access> access(String organizationSlug, Caller caller) {
        return evaluator.evaluate(organizationSlug, caller);
    }

    public Uni<Void> requireOwner(String organizationSlug) {
        return Panache.withSession(() -> findOrganization(organizationSlug).flatMap(this::requireOwner));
    }

    /** Fails with 403 unless the caller is an Owner or Admin of the organization. */
    public Uni<Void> requireOwner(Organization organization) {
        return requireBase(organization, BaseRole.ADMIN);
    }

    public Uni<OrganizationRoleDto> get(String organizationSlug, String roleCode) {
        String role = knownRole(roleCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> requireOwner(org).flatMap(ignored -> load(root(org), role, true))));
    }

    public Uni<OrganizationRoleDto> replace(String organizationSlug, String roleCode,
            SetOrganizationRoleRequest request) {
        String role = knownRole(roleCode);
        Set<String> assignees = normalizeAssignees(request, role);
        BaseRole needed = OWNER_ROLE_CODE.equals(role) ? BaseRole.OWNER : BaseRole.ADMIN;
        String actor = organizationContext.getUserEmail();
        return Panache.withTransaction(() -> findOrganization(organizationSlug)
                .flatMap(org -> requireBase(org, needed)
                        .flatMap(ignored -> write(root(org), role, assignees, actor))
                        .flatMap(ignored -> load(root(org), role, false))));
    }

    /** {@link #get} for a platform owner, who need not belong to the organization. */
    public Uni<OrganizationRoleDto> getAsPlatform(String organizationSlug, String roleCode) {
        String role = knownRole(roleCode);
        return Panache.withSession(() -> findOrganization(organizationSlug)
                .flatMap(org -> load(root(org), role, false)));
    }

    /** {@link #replace} for a platform owner: how a new organization gets its first owner. */
    public Uni<OrganizationRoleDto> replaceAsPlatform(String organizationSlug, String roleCode,
            SetOrganizationRoleRequest request, String actor) {
        String role = knownRole(roleCode);
        Set<String> assignees = normalizeAssignees(request, role);
        return Panache.withTransaction(() -> findOrganization(organizationSlug)
                .flatMap(org -> write(root(org), role, assignees, actor)
                        .flatMap(ignored -> load(root(org), role, false))));
    }

    private Uni<Void> requireBase(Organization organization, BaseRole needed) {
        String personId = organizationContext.getUserEmail();
        if (personId == null || personId.isBlank()) {
            return forbidden();
        }
        return evaluator.evaluate(organization, Caller.user(personId))
                .flatMap(access -> access.member() && access.baseRole().atLeast(needed)
                        ? Uni.createFrom().voidItem()
                        : forbidden());
    }

    private Uni<Void> write(Long organizationId, String role, Set<String> assignees, String actor) {
        return OWNER_ROLE_CODE.equals(role)
                ? directory.setOwners(organizationId, assignees, actor)
                : directory.setHolders(organizationId, role, assignees, actor);
    }

    /**
     * The role's holders. With Alfresco membership and no owner assigned yet, {@code withBootstrapOwner} shows the
     * caller, who got this far as an Alfresco manager.
     */
    private Uni<OrganizationRoleDto> load(Long organizationId, String role, boolean withBootstrapOwner) {
        if (!OWNER_ROLE_CODE.equals(role)) {
            return directory.holders(organizationId, role).map(ids -> new OrganizationRoleDto(role, ids));
        }
        String caller = organizationContext.getUserEmail();
        return directory.owners(organizationId).map(owners -> owners.isEmpty() && withBootstrapOwner && caller != null
                ? new OrganizationRoleDto(role, List.of(caller))
                : new OrganizationRoleDto(role, owners));
    }

    private String knownRole(String roleCode) {
        if (roleCode == null || (!OWNER_ROLE_CODE.equals(roleCode)
                && evaluator.registry().role(roleCode).isEmpty())) {
            throw new BadRequestException("Unknown organization role: " + roleCode);
        }
        return roleCode;
    }

    private static Uni<Organization> findOrganization(String organizationSlug) {
        return Organization.findBySlug(organizationSlug)
                .flatMap(organization -> organization == null
                        ? Uni.createFrom().failure(new NotFoundException(
                                "Organization not found: " + organizationSlug))
                        : Uni.createFrom().item(organization));
    }

    /** Roles live on the top-level organization; a sub-account inherits them. */
    private static Long root(Organization organization) {
        return organization.parent != null ? organization.parent.id : organization.id;
    }

    public static String accessRole(Access access) {
        return access.member() && access.baseRole().atLeast(BaseRole.ADMIN) ? OWNER_ACCESS_ROLE : MEMBER_ACCESS_ROLE;
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

    private static <T> Uni<T> forbidden() {
        return Uni.createFrom().failure(new ForbiddenException("Organization owner access required"));
    }
}
