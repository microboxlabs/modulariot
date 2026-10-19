package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.alfresco.IAlfrescoMembershipClient;
import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.auth.OrganizationMembership;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamTeamMember;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.arc.Arc;
import io.quarkus.arc.InjectableContext;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;

/**
 * The only place that decides what a caller may do in an organization. The org filter, the permission checks on
 * endpoints, MCP tools and the role APIs all ask it. Within a request the decision is computed once.
 */
@ApplicationScoped
public class AccessEvaluator {

    static final Set<String> BOOTSTRAP_MANAGER_ROLES = Set.of("SITE_MANAGER", "GROUP_ADMIN");

    /** The base role an Alfresco member gets: Admin for site and group managers, else Member. */
    static BaseRole alfrescoBaseRole(String alfrescoRole) {
        return alfrescoRole != null && BOOTSTRAP_MANAGER_ROLES.contains(alfrescoRole) ? BaseRole.ADMIN : BaseRole.MEMBER;
    }

    private final AccessRegistry registry;
    private final IAlfrescoMembershipClient alfresco;
    private final OrganizationMembership deployment;
    private final PlatformAuthorizer platform;

    @Inject
    public AccessEvaluator(AccessRegistry registry, IAlfrescoMembershipClient alfresco,
            OrganizationMembership deployment, PlatformAuthorizer platform) {
        this.registry = registry;
        this.alfresco = alfresco;
        this.deployment = deployment;
        this.platform = platform;
    }

    public AccessRegistry registry() {
        return registry;
    }

    /** The caller's access to the organization with this slug; {@link Access#none} when there is no such org. */
    public Uni<Access> evaluate(String organizationSlug, Caller caller) {
        AccessContext context = requestContext();
        if (context != null) {
            Access cached = context.get(organizationSlug, caller);
            if (cached != null) {
                return Uni.createFrom().item(cached);
            }
        }
        return Panache.withSession(() -> Organization.findBySlug(organizationSlug)
                .flatMap(org -> org == null
                        ? Uni.createFrom().item(Access.none(null, organizationSlug))
                        : evaluate(org, caller)))
                .invoke(access -> {
                    if (context != null) {
                        context.put(organizationSlug, caller, access);
                    }
                });
    }

    /** Needs an open session: reads memberships and bindings through Hibernate Reactive. */
    public Uni<Access> evaluate(Organization org, Caller caller) {
        return root(org).flatMap(root -> {
            List<Long> scope = org.parent == null ? List.of(org.id) : List.of(org.id, root.id);
            if (caller.isClient()) {
                return clientAccess(org, root, scope, caller);
            }
            if (caller.isServiceAccount()) {
                return serviceAccountAccess(org, root, scope, caller);
            }
            if (!caller.isUser()) {
                return Uni.createFrom().item(Access.none(org.id, org.slug));
            }
            return userAccess(org, root, scope, caller);
        });
    }

    private Uni<Access> clientAccess(Organization org, Organization root, List<Long> scope, Caller caller) {
        boolean nativeMembership = isNative(root);
        return IamRoleBinding.findFor(scope, IamRoleBinding.CLIENT, List.of(caller.clientId()))
                .map(bindings -> AccessRules.resolve(org.id, org.slug, caller, new AccessRules.Facts(
                        nativeMembership, null, false, false, caller.clientId().equals(org.tenantClientId),
                        covered(bindings, org, root), null), registry));
    }

    private Uni<Access> serviceAccountAccess(Organization org, Organization root, List<Long> scope, Caller caller) {
        boolean own = scope.contains(caller.serviceAccountOrganizationId());
        return IamRoleBinding.findFor(scope, IamRoleBinding.SERVICE_ACCOUNT,
                        List.of(caller.serviceAccountId().toString()))
                .map(bindings -> AccessRules.resolve(org.id, org.slug, caller, new AccessRules.Facts(
                        true, own ? BaseRole.MEMBER : null, false, false, false,
                        covered(bindings, org, root), null), registry));
    }

    private Uni<Access> userAccess(Organization org, Organization root, List<Long> scope, Caller caller) {
        boolean nativeMembership = isNative(root);
        return IamUser.findByEmail(caller.email()).flatMap(user -> {
            if (user != null && !"ACTIVE".equals(user.status)) {
                return Uni.createFrom().item(Access.none(org.id, org.slug));
            }
            Uni<List<IamMembership>> memberships = user == null
                    ? Uni.createFrom().item(List.of())
                    : IamMembership.findFor(scope, user.id);
            return memberships.flatMap(rows -> bindingsOf(user, scope)
                    .flatMap(bindings -> directory(org, root, caller, nativeMembership)
                            .flatMap(dir -> platform.isPlatformOwner(caller.email())
                                    .map(owner -> AccessRules.resolve(org.id, org.slug, caller, new AccessRules.Facts(
                                            nativeMembership, highest(rows), dir.member(), dir.bootstrapOwner(),
                                            false, covered(bindings, org, root), dir.role(),
                                            Boolean.TRUE.equals(owner)), registry)))));
        });
    }

    /** Whether membership of this organization comes from the modulith. Needs an open session. */
    public Uni<Boolean> membershipNative(Organization org) {
        return root(org).map(this::isNative);
    }

    /** Whether membership of this top-level organization, and its sub-accounts, comes from the modulith. */
    public boolean isNative(Organization root) {
        return deployment.isNative() || "NATIVE".equals(root.membershipSource);
    }

    private record Directory(boolean member, boolean bootstrapOwner, String role) {
    }

    /** The Alfresco side, only asked when membership comes from Alfresco. */
    private Uni<Directory> directory(Organization org, Organization root, Caller caller, boolean nativeMembership) {
        if (nativeMembership) {
            return Uni.createFrom().item(new Directory(false, false, null));
        }
        if (org.alfrescoGroupId == null) {
            return Uni.createFrom().item(new Directory(true, false, null));
        }
        return alfresco.isMember(caller.email(), org.alfrescoGroupId).flatMap(member -> {
            if (!Boolean.TRUE.equals(member)) {
                return Uni.createFrom().item(new Directory(false, false, null));
            }
            return alfresco.getRole(caller.email(), org.alfrescoGroupId)
                    .flatMap(role -> bootstrap(org, root, caller, role)
                            .map(owner -> new Directory(true, owner, role)));
        });
    }

    /** An Alfresco manager of the root organization is Owner while it has no assigned owner. */
    private Uni<Boolean> bootstrap(Organization org, Organization root, Caller caller, String orgRole) {
        if (root.alfrescoGroupId == null) {
            return Uni.createFrom().item(false);
        }
        return IamMembership.findByRole(root.id, BaseRole.OWNER.name()).flatMap(owners -> {
            if (!owners.isEmpty()) {
                return Uni.createFrom().item(false);
            }
            if (root.id.equals(org.id)) {
                return Uni.createFrom().item(BOOTSTRAP_MANAGER_ROLES.contains(orgRole));
            }
            return alfresco.getRole(caller.email(), root.alfrescoGroupId).map(BOOTSTRAP_MANAGER_ROLES::contains);
        });
    }

    /** The top-level organization of {@code org}: itself, or its parent. Needs an open session. */
    @SuppressWarnings("java:S3252") // Reactive Panache generates findById per entity.
    public Uni<Organization> root(Organization org) {
        if (org.parent == null) {
            return Uni.createFrom().item(org);
        }
        return Organization.<Organization>findById(org.parent.id);
    }

    /** The user's own bindings plus those of the teams they belong to in these organizations. */
    private static Uni<List<IamRoleBinding>> bindingsOf(IamUser user, List<Long> scope) {
        if (user == null) {
            return Uni.createFrom().item(List.of());
        }
        return IamRoleBinding.findFor(scope, IamRoleBinding.USER, List.of(user.id.toString()))
                .flatMap(own -> IamTeamMember.findByUser(user.id).flatMap(memberships -> {
                    List<String> teamIds = memberships.stream().map(m -> m.id.teamId.toString()).toList();
                    return IamRoleBinding.findFor(scope, IamRoleBinding.TEAM, teamIds).map(teams -> {
                        List<IamRoleBinding> all = new ArrayList<>(own);
                        all.addAll(teams);
                        return all;
                    });
                }));
    }

    /** The role keys of the bindings that apply to {@code org}: in scope and not expired. */
    public static Set<String> covered(List<IamRoleBinding> bindings, Organization org, Organization root) {
        Instant now = Instant.now();
        Long parentId = org.parent == null ? null : root.id;
        return bindings.stream()
                .filter(b -> b.covers(org.id, parentId, now))
                .map(b -> b.roleKey)
                .collect(Collectors.toCollection(TreeSet::new));
    }

    static BaseRole highest(List<IamMembership> memberships) {
        BaseRole best = null;
        for (IamMembership m : memberships) {
            best = BaseRole.max(best, BaseRole.valueOf(m.baseRole));
        }
        return best;
    }

    private static AccessContext requestContext() {
        InjectableContext request = Arc.container() == null ? null : Arc.container().requestContext();
        if (request == null || !request.isActive()) {
            return null;
        }
        return Arc.container().instance(AccessContext.class).get();
    }
}
