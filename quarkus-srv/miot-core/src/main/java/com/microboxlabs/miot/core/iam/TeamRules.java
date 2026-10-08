package com.microboxlabs.miot.core.iam;

import java.util.Collection;
import java.util.Set;

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
        if (current == BaseRole.OWNER && next != BaseRole.OWNER && owners <= 1) {
            throw new IllegalStateException("An organization keeps at least one owner");
        }
    }

    /** The actor may remove a member with this base role. */
    public static void checkRemoval(Access actor, BaseRole target, long owners) {
        if (target == BaseRole.OWNER) {
            checkBaseRoleChange(actor, BaseRole.OWNER, BaseRole.MEMBER, owners);
        }
    }

    /**
     * The actor may grant these module roles: it must hold every permission they give, except explicit-only ones,
     * which an administrator grants without holding them.
     */
    public static void checkGrant(Access actor, Collection<String> roleKeys, AccessRegistry registry) {
        for (String key : roleKeys) {
            RoleDef role = registry.role(key)
                    .orElseThrow(() -> new IllegalArgumentException("Unknown role: " + key));
            for (String permission : role.permissions()) {
                boolean explicitOnly = registry.permissions().stream()
                        .anyMatch(p -> p.key().equals(permission) && p.explicitOnly());
                if (!explicitOnly && !actor.can(permission)) {
                    throw new SecurityException("You cannot grant " + key + ": it gives " + permission);
                }
            }
        }
    }

    /** The base role to invite with, checked like a change from nothing. */
    public static void checkInvite(Access actor, BaseRole baseRole, Set<String> roleKeys, AccessRegistry registry) {
        if (baseRole == BaseRole.OWNER && !actor.can(CoreAccessCatalog.OWNERS_MANAGE)) {
            throw new SecurityException("Only an owner invites owners");
        }
        checkGrant(actor, roleKeys, registry);
    }
}
