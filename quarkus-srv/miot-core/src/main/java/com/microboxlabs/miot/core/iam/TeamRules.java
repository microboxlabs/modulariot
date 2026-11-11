package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import java.time.Instant;
import java.util.Collection;
import java.util.Set;
import java.util.TreeSet;

/**
 * Who may change whom. No I/O. Every refusal is an {@link IllegalStateException} (409) for a state the
 * organization must keep, or a {@link SecurityException} (403) for a change the actor may not make.
 */
public final class TeamRules {

    private TeamRules() {
    }

    /**
     * The actor may set {@code target}'s base role from {@code current} to {@code next}. Making or unmaking an Owner
     * needs {@code owners:manage}; the last Owner keeps the role.
     */
    public static void checkBaseRoleChange(Access actor, BaseRole current, BaseRole next, long owners) {
        boolean touchesOwner = current == BaseRole.OWNER || next == BaseRole.OWNER;
        if (touchesOwner && !actor.can(CoreAccessCatalog.OWNERS_MANAGE)) {
            throw new SecurityException("Only an owner changes who is an owner");
        }
        if (current == BaseRole.ADMIN || next == BaseRole.ADMIN) {
            requireAdministrator(actor);
        }
        if (current == BaseRole.OWNER && next != BaseRole.OWNER && owners <= 1) {
            throw new IllegalStateException("An organization keeps at least one owner");
        }
    }

    /** The actor may remove a member with this base role. */
    public static void checkRemoval(Access actor, BaseRole target, long owners) {
        if (target == BaseRole.OWNER) {
            checkBaseRoleChange(actor, BaseRole.OWNER, BaseRole.MEMBER, owners);
        }
        if (target == BaseRole.ADMIN) {
            requireAdministrator(actor);
        }
    }

    /**
     * Making, unmaking or removing an Admin needs an Owner or Admin, or {@code owners:manage}. A member who holds
     * {@code members:invite}, {@code members:update} or {@code members:remove} through a role manages members only.
     */
    private static void requireAdministrator(Access actor) {
        boolean administrator = actor.member() && actor.baseRole().atLeast(BaseRole.ADMIN);
        if (!administrator && !actor.can(CoreAccessCatalog.OWNERS_MANAGE)) {
            throw new SecurityException("Only an owner or admin changes who is an admin");
        }
    }

    /**
     * The actor may grant these module roles: it must hold every permission they give, except explicit-only ones,
     * which an administrator grants without holding them.
     */
    public static void checkGrant(Access actor, Collection<String> roleKeys, AccessRegistry registry) {
        checkGrant(actor, roleKeys, OrgRoles.system(registry));
    }

    /** {@link #checkGrant(Access, Collection, AccessRegistry)} over the organization's module and custom roles. */
    public static void checkGrant(Access actor, Collection<String> roleKeys, OrgRoles roles) {
        AccessRegistry registry = roles.registry();
        for (String key : roleKeys) {
            Set<String> permissions = roles.permissions(key)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + key));
            for (String permission : permissions) {
                boolean explicitOnly = registry.permissions().stream()
                        .anyMatch(p -> p.key().equals(permission) && p.explicitOnly());
                if (!explicitOnly && !actor.can(permission)) {
                    throw new SecurityException("You cannot grant " + key + ": it gives " + permission);
                }
            }
        }
    }

    /**
     * The actor may give access through roles already bound to a principal: adding a member to a team, or issuing a
     * key for a service account. Same rule as {@link #checkGrant}; bound keys the organization no longer has give
     * nothing and are skipped.
     */
    public static void checkGrantBound(Access actor, Collection<String> boundRoleKeys, OrgRoles roles) {
        checkGrant(actor, boundRoleKeys.stream().filter(key -> roles.permissions(key).isPresent()).toList(), roles);
    }

    /** The role keys of the bindings that have not expired, on any scope. */
    public static Set<String> unexpired(Collection<IamRoleBinding> bindings) {
        Instant now = Instant.now();
        Set<String> keys = new TreeSet<>();
        bindings.stream().filter(b -> b.expiresAt == null || b.expiresAt.isAfter(now))
                .forEach(b -> keys.add(b.roleKey));
        return keys;
    }

    /** The base role to invite with, checked like a change from nothing. */
    public static void checkInvite(Access actor, BaseRole baseRole, Set<String> roleKeys, AccessRegistry registry) {
        checkInvite(actor, baseRole, roleKeys, OrgRoles.system(registry));
    }

    public static void checkInvite(Access actor, BaseRole baseRole, Set<String> roleKeys, OrgRoles roles) {
        if (baseRole == BaseRole.OWNER && !actor.can(CoreAccessCatalog.OWNERS_MANAGE)) {
            throw new SecurityException("Only an owner invites owners");
        }
        if (baseRole == BaseRole.ADMIN) {
            requireAdministrator(actor);
        }
        checkGrant(actor, roleKeys, roles);
    }
}
