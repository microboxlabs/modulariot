package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamAuditEvent;
import com.microboxlabs.miot.core.iam.model.IamMembership;
import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import com.microboxlabs.miot.core.iam.model.IamTokenRole;
import com.microboxlabs.miot.core.iam.model.IamUser;
import com.microboxlabs.miot.core.model.Organization;
import io.quarkus.hibernate.reactive.panache.Panache;
import io.quarkus.security.identity.SecurityIdentity;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import jakarta.json.JsonArray;
import jakarta.json.JsonNumber;
import jakarta.json.JsonString;
import jakarta.json.JsonValue;
import java.time.Duration;
import java.time.Instant;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.NoSuchElementException;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;
import org.eclipse.microprofile.config.ConfigProvider;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.jwt.JsonWebToken;

/**
 * Roles that come from the caller's sign-in token. The claim named by {@value #CLAIM_PROPERTY} carries role ids (for
 * example Entra ID app roles); each top-level organization maps those ids to module roles and to a base role.
 *
 * <p>When a person's token carries the claim, {@link #sync} makes their stored roles match it before access is
 * decided: bindings of every role the organization's map covers are rewritten from the token (source TOKEN), and a
 * membership is created for them. Bindings of roles the map does not cover are left alone. Stored bindings let work
 * that runs without a token, such as the Alfresco projection, see the same roles. A TOKEN binding expires
 * {@value #TTL_PROPERTY} after the last sign-in that carried it.
 */
@ApplicationScoped
public class TokenRoles {

    public static final String CLAIM_PROPERTY = "miot.iam.token-roles.claim";
    public static final String TTL_PROPERTY = "miot.iam.token-roles.ttl";
    static final String MEMBER = "MEMBER";

    public record Mapping(String externalId, String roleKey) {
    }

    /** What a sync changes for one person in one organization. */
    record Plan(String baseRole, Set<String> add, Set<String> remove) {

        boolean member() {
            return baseRole != null;
        }
    }

    private final AccessRegistry registry;
    private final Duration ttl;
    private final ProjectionQueue projection;

    @Inject
    public TokenRoles(AccessRegistry registry,
            @ConfigProperty(name = TTL_PROPERTY, defaultValue = "P30D") Duration ttl, ProjectionQueue projection) {
        this.registry = registry;
        this.ttl = ttl;
        this.projection = projection;
    }

    /** The role ids in the caller's token, or null when the claim is not configured or not in the token. */
    public static Set<String> fromIdentity(SecurityIdentity identity) {
        Optional<String> claim = ConfigProvider.getConfig().getOptionalValue(CLAIM_PROPERTY, String.class)
                .filter(c -> !c.isBlank());
        if (claim.isEmpty() || identity == null || identity.isAnonymous()
                || !(identity.getPrincipal() instanceof JsonWebToken jwt) || !jwt.containsClaim(claim.get())) {
            return null;
        }
        return ids(jwt.getClaim(claim.get()));
    }

    /** Role ids from a claim value: a list of strings or numbers, or one of them. */
    static Set<String> ids(Object value) {
        Set<String> out = new TreeSet<>();
        if (value instanceof JsonArray array) {
            array.forEach(v -> add(out, v));
        } else if (value instanceof Collection<?> list) {
            list.forEach(v -> add(out, v));
        } else if (value != null) {
            add(out, value);
        }
        return out;
    }

    private static void add(Set<String> out, Object value) {
        String id;
        if (value instanceof JsonString s) {
            id = s.getString();
        } else if (value instanceof JsonNumber n) {
            id = n.toString();
        } else if (value instanceof JsonValue v) {
            id = v.toString();
        } else {
            id = String.valueOf(value);
        }
        id = id.trim();
        if (!id.isEmpty()) {
            out.add(id);
        }
    }

    /**
     * What the token means for one person, given the organization's map and the role keys they hold now. The base
     * role is the highest of the mapped OWNER, ADMIN and MEMBER ids; any mapped module role also makes them a Member.
     * Null when no id in the token is mapped.
     */
    static Plan plan(Set<String> tokenIds, Map<String, String> map, Set<String> held) {
        Set<String> covered = new TreeSet<>(map.values());
        Set<String> wanted = new TreeSet<>();
        BaseRole base = null;
        for (String id : tokenIds) {
            String key = map.get(id);
            if (key == null) {
                continue;
            }
            if (isBaseRole(key)) {
                base = BaseRole.max(base, BaseRole.valueOf(key));
            } else {
                wanted.add(key);
                base = BaseRole.max(base, BaseRole.MEMBER);
            }
        }
        Set<String> add = new TreeSet<>(wanted);
        add.removeAll(held);
        Set<String> remove = new TreeSet<>(held);
        remove.retainAll(covered);
        remove.removeAll(wanted);
        return new Plan(base == null ? null : base.name(), add, remove);
    }

    static boolean isBaseRole(String key) {
        return "OWNER".equals(key) || "ADMIN".equals(key) || MEMBER.equals(key);
    }

    /**
     * Makes the person's stored roles in {@code root} match their token. Needs an open session; writes only what
     * changed.
     */
    @SuppressWarnings("java:S1612") // Reactive Panache: persist overloads.
    public Uni<Void> sync(Organization root, String email, Set<String> tokenIds) {
        return IamTokenRole.findByOrganization(root.id).flatMap(rows -> {
            if (rows.isEmpty()) {
                return Uni.createFrom().voidItem();
            }
            Map<String, String> map = new LinkedHashMap<>();
            rows.forEach(r -> map.put(r.externalId, r.roleKey));
            return IamUser.findOrCreate(email).flatMap(user -> IamRoleBinding
                    .findFor(List.of(root.id), IamRoleBinding.USER, List.of(user.id.toString()))
                    .flatMap(bindings -> {
                        List<IamRoleBinding> orgWide = bindings.stream()
                                .filter(b -> IamRoleBinding.ORGANIZATION.equals(b.scopeKind)).toList();
                        Set<String> held = new TreeSet<>();
                        orgWide.forEach(b -> held.add(b.roleKey));
                        Plan plan = plan(tokenIds, map, held);
                        return apply(root, user, orgWide, plan);
                    }));
        });
    }

    @SuppressWarnings("java:S1612") // Reactive Panache: persist overloads.
    private Uni<Void> apply(Organization root, IamUser user, List<IamRoleBinding> orgWide, Plan plan) {
        Instant now = Instant.now();
        Instant expires = now.plus(ttl);
        List<Uni<?>> writes = new ArrayList<>();
        for (IamRoleBinding b : orgWide) {
            if (plan.remove().contains(b.roleKey)) {
                writes.add(b.delete());
            } else if (IamRoleBinding.TOKEN.equals(b.source) && b.expiresAt != null
                    && b.expiresAt.isBefore(now.plus(ttl.dividedBy(2)))) {
                b.expiresAt = expires;
                writes.add(b.persist());
            }
        }
        for (String key : plan.add()) {
            if (registry.role(key).isEmpty()) {
                continue;
            }
            IamRoleBinding b = IamRoleBinding.of(root.id, IamRoleBinding.USER, user.id.toString(), key, "token");
            b.source = IamRoleBinding.TOKEN;
            b.expiresAt = expires;
            writes.add(b.persist());
        }
        Uni<Void> chain = Uni.createFrom().voidItem();
        for (Uni<?> write : writes) {
            chain = chain.flatMap(i -> write.replaceWithVoid());
        }
        boolean rolesChanged = !plan.add().isEmpty() || !plan.remove().isEmpty();
        Set<String> changed = new TreeSet<>(plan.add());
        changed.addAll(plan.remove());
        return chain.flatMap(i -> rolesChanged
                        ? projection.usersChanged(root.id, List.of(user.id), changed)
                        : Uni.createFrom().voidItem())
                .flatMap(i -> membership(root, user, plan.baseRole()))
                .flatMap(membershipChanged -> rolesChanged || membershipChanged
                        ? IamAuditEvent.of(root.id, "token", "token-roles.synced", user.email,
                                Map.of("added", plan.add(), "removed", plan.remove(),
                                        "baseRole", String.valueOf(plan.baseRole()))).persist().replaceWithVoid()
                        : Uni.createFrom().voidItem());
    }

    /**
     * Creates or updates the membership the token gives. A membership the token created follows it, and is removed
     * when no id maps any more. A membership granted otherwise keeps the higher of its role and the token's.
     */
    @SuppressWarnings("java:S1612") // Reactive Panache: persist overloads.
    private Uni<Boolean> membership(Organization root, IamUser user, String baseRole) {
        return IamMembership.findOne(root.id, user.id).flatMap(m -> {
            if (m == null) {
                return baseRole == null
                        ? Uni.createFrom().item(false)
                        : IamMembership.of(root.id, user.id, baseRole, IamRoleBinding.TOKEN, "token").persist()
                                .flatMap(created -> projection.memberChanged(root.id, user.email, true))
                                .replaceWith(true);
            }
            if (IamRoleBinding.TOKEN.equals(m.source)) {
                if (baseRole == null) {
                    return m.delete()
                            .flatMap(deleted -> projection.memberChanged(root.id, user.email, false))
                            .replaceWith(true);
                }
                if (!baseRole.equals(m.baseRole)) {
                    m.baseRole = baseRole;
                    return m.persist().replaceWith(true);
                }
                return Uni.createFrom().item(false);
            }
            if (baseRole != null && BaseRole.valueOf(baseRole).compareTo(BaseRole.valueOf(m.baseRole)) > 0) {
                m.baseRole = baseRole;
                return m.persist().replaceWith(true);
            }
            return Uni.createFrom().item(false);
        });
    }

    // --- the map, for platform owners ---

    public Uni<List<Mapping>> list(Organization root) {
        return IamTokenRole.findByOrganization(root.id)
                .map(rows -> rows.stream().map(r -> new Mapping(r.externalId, r.roleKey)).toList());
    }

    /** Maps a role id to a module role or to OWNER, ADMIN or MEMBER. */
    @SuppressWarnings("java:S1612") // Reactive Panache: persist overloads.
    public Uni<Mapping> put(String slug, String externalId, String roleKey, String actor) {
        if (externalId == null || externalId.isBlank() || externalId.length() > 64) {
            throw new IllegalArgumentException("externalId is required (at most 64 characters)");
        }
        if (roleKey == null || (!isBaseRole(roleKey) && registry.role(roleKey).isEmpty())) {
            throw new IllegalArgumentException("Unknown role: " + roleKey);
        }
        String id = externalId.trim();
        return Panache.withTransaction(() -> root(slug).flatMap(org -> IamTokenRole.findOne(org.id, id)
                .flatMap(found -> {
                    IamTokenRole row = found == null ? IamTokenRole.of(org.id, id, roleKey, actor) : found;
                    row.roleKey = roleKey;
                    return row.<IamTokenRole>persist()
                            .flatMap(saved -> IamAuditEvent.of(org.id, actor, "token-role.set", id,
                                    Map.of("role", roleKey)).persist())
                            .replaceWith(new Mapping(id, roleKey));
                })));
    }

    public Uni<Void> delete(String slug, String externalId, String actor) {
        return Panache.withTransaction(() -> root(slug).flatMap(org -> IamTokenRole.findOne(org.id, externalId)
                .flatMap(found -> {
                    if (found == null) {
                        throw new NoSuchElementException("No mapping for " + externalId);
                    }
                    return found.delete()
                            .flatMap(i -> IamAuditEvent.of(org.id, actor, "token-role.removed", externalId,
                                    Map.<String, Object>of("role", found.roleKey)).persist())
                            .replaceWithVoid();
                })));
    }

    public Uni<List<Mapping>> list(String slug) {
        return Panache.withSession(() -> root(slug).flatMap(this::list));
    }

    private static Uni<Organization> root(String slug) {
        return Organization.findBySlug(slug).flatMap(found -> {
            if (found == null) {
                throw new NoSuchElementException("Organization not found: " + slug);
            }
            if (found.parent != null) {
                return Organization.<Organization>findById(found.parent.id);
            }
            return Uni.createFrom().item(found);
        });
    }
}
