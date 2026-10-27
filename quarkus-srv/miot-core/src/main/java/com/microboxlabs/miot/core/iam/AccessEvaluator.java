package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.auth.PlatformAuthorizer;
import com.microboxlabs.miot.core.auth.OrganizationAccess;
import com.microboxlabs.miot.core.auth.PlatformScope;
import io.quarkus.security.identity.SecurityIdentity;
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
import jakarta.json.JsonValue;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;
import java.util.TreeSet;
import java.util.stream.Collectors;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * The only place that decides what a caller may do in an organization. The org filter, the permission checks on
 * endpoints, MCP tools and the role APIs all ask it. Within a request the decision is computed once.
 */
@ApplicationScoped
public class AccessEvaluator {

    private final AccessRegistry registry;
    private final PlatformAuthorizer platform;
    private final TokenRoles tokenRoles;
    private final DomainMembership domains;

    @Inject
    public AccessEvaluator(AccessRegistry registry, PlatformAuthorizer platform, TokenRoles tokenRoles,
            DomainMembership domains) {
        this.registry = registry;
        this.platform = platform;
        this.tokenRoles = tokenRoles;
        this.domains = domains;
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
        Uni<Access> decided = PlatformScope.reserved(organizationSlug)
                ? platformAccess(organizationSlug, caller)
                : organizationAccess(organizationSlug, caller);
        return decided
                .invoke(access -> {
                    if (context != null) {
                        context.put(organizationSlug, caller, access);
                    }
                });
    }

    private Uni<Access> organizationAccess(String organizationSlug, Caller caller) {
        return Panache.withSession(() -> Organization.findBySlug(organizationSlug)
                .flatMap(org -> org == null
                        ? Uni.createFrom().item(Access.none(null, organizationSlug))
                        : evaluate(org, caller)));
    }

    /**
     * The platform scope: a platform owner, signed in as a user, is its Owner. Nobody is a member of any other
     * reserved slug.
     */
    private Uni<Access> platformAccess(String slug, Caller caller) {
        if (!PlatformScope.isPlatform(slug) || !caller.isUser()) {
            return Uni.createFrom().item(Access.none(PlatformScope.ORGANIZATION_ID, slug));
        }
        return platform.isPlatformOwner(caller.email()).map(owner -> Boolean.TRUE.equals(owner)
                ? AccessRules.resolve(PlatformScope.ORGANIZATION_ID, slug, caller,
                        new AccessRules.Facts(null, false, Set.of(), true), registry)
                : Access.none(PlatformScope.ORGANIZATION_ID, slug));
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
        return IamRoleBinding.findFor(scope, IamRoleBinding.CLIENT, List.of(caller.clientId()))
                .map(bindings -> AccessRules.resolve(org.id, org.slug, caller, new AccessRules.Facts(
                        null, caller.clientId().equals(org.tenantClientId), covered(bindings, org, root)), registry));
    }

    private Uni<Access> serviceAccountAccess(Organization org, Organization root, List<Long> scope, Caller caller) {
        boolean own = scope.contains(caller.serviceAccountOrganizationId());
        return IamRoleBinding.findFor(scope, IamRoleBinding.SERVICE_ACCOUNT,
                        List.of(caller.serviceAccountId().toString()))
                .map(bindings -> AccessRules.resolve(org.id, org.slug, caller, new AccessRules.Facts(
                        own ? BaseRole.MEMBER : null, false, covered(bindings, org, root)), registry));
    }

    private Uni<Access> userAccess(Organization org, Organization root, List<Long> scope, Caller caller) {
        SecurityIdentity signer = requestSigner(caller.email());
        Set<String> ids = signer == null ? null : TokenRoles.fromIdentity(signer);
        Uni<String> synced = ids == null
                ? Uni.createFrom().nullItem()
                : Panache.withTransaction(() -> tokenRoles.sync(root, caller.email(), ids));
        return synced.flatMap(tokenBase -> IamUser.findByEmail(caller.email()).flatMap(user -> {
            if (user != null && !"ACTIVE".equals(user.status)) {
                return Uni.createFrom().item(Access.none(org.id, org.slug));
            }
            return memberships(root, scope, user, caller.email(), signer)
                    .flatMap(rows -> decide(org, root, scope, caller, user, withToken(highest(rows), tokenBase)));
        }));
    }

    /** The user's active memberships; a signed-in person with none may join by domain. */
    private Uni<List<IamMembership>> memberships(Organization root, List<Long> scope, IamUser user, String email,
            SecurityIdentity signer) {
        Uni<List<IamMembership>> found = user == null
                ? Uni.createFrom().item(List.of())
                : IamMembership.findFor(scope, user.id);
        if (signer == null) {
            return found;
        }
        return found.flatMap(rows -> rows.isEmpty()
                ? joinByDomain(root, scope, email, signer)
                : Uni.createFrom().item(rows));
    }

    /** The access of a user whose base role in the organization is known. */
    private Uni<Access> decide(Organization org, Organization root, List<Long> scope, Caller caller, IamUser user,
            BaseRole base) {
        return bindingsOf(user, scope)
                .flatMap(bindings -> platform.isPlatformOwner(caller.email())
                        .map(owner -> AccessRules.resolve(org.id, org.slug, caller, new AccessRules.Facts(
                                base, false, covered(bindings, org, root), Boolean.TRUE.equals(owner)), registry)));
    }

    /** The memberships after a join through the caller's email domain; empty when the domain gives none. */
    private Uni<List<IamMembership>> joinByDomain(Organization root, List<Long> scope, String email,
            SecurityIdentity signer) {
        return Panache.withTransaction(() -> domains.join(root, email, emailVerified(signer))).flatMap(joined -> {
            if (!Boolean.TRUE.equals(joined)) {
                return Uni.createFrom().item(List.<IamMembership>of());
            }
            return IamUser.findByEmail(email).flatMap(created -> IamMembership.findFor(scope, created.id));
        });
    }

    /** A member's base role raised to the one their token gives, for this request only. */
    static BaseRole withToken(BaseRole membership, String tokenBase) {
        return membership == null || tokenBase == null ? membership : BaseRole.max(membership, BaseRole.valueOf(tokenBase));
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

    /** This request's identity when {@code email} is the person who signed in; null otherwise, and outside a request. */
    private static SecurityIdentity requestSigner(String email) {
        InjectableContext request = Arc.container() == null ? null : Arc.container().requestContext();
        if (request == null || !request.isActive()) {
            return null;
        }
        SecurityIdentity identity = Arc.container().instance(SecurityIdentity.class).get();
        if (identity == null || identity.isAnonymous()) {
            return null;
        }
        String signed = OrganizationAccess.email(identity);
        return signed != null && IamUser.normalize(signed).equals(email) ? identity : null;
    }

    /** Whether the sign-in token says the email is verified ({@code email_verified}). */
    static boolean emailVerified(SecurityIdentity identity) {
        if (!(identity.getPrincipal() instanceof JsonWebToken jwt)) {
            return false;
        }
        Object claim = jwt.getClaim("email_verified");
        if (claim instanceof Boolean b) {
            return b;
        }
        if (claim instanceof JsonValue v) {
            return v.getValueType() == JsonValue.ValueType.TRUE;
        }
        return claim != null && "true".equalsIgnoreCase(claim.toString());
    }

    private static AccessContext requestContext() {
        InjectableContext request = Arc.container() == null ? null : Arc.container().requestContext();
        if (request == null || !request.isActive()) {
            return null;
        }
        return Arc.container().instance(AccessContext.class).get();
    }
}
