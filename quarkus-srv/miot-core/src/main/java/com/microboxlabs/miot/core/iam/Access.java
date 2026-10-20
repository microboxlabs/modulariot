package com.microboxlabs.miot.core.iam;

import java.util.Set;

/**
 * What a caller may do in one organization: its base role (null when it is not a member), the module roles it holds,
 * and the permissions they give.
 */
public record Access(Long organizationId, String organizationSlug, BaseRole baseRole, Set<String> roles,
        Set<String> permissions) {

    public Access {
        roles = Set.copyOf(roles);
        permissions = Set.copyOf(permissions);
    }

    public static Access none(Long organizationId, String organizationSlug) {
        return new Access(organizationId, organizationSlug, null, Set.of(), Set.of());
    }

    public boolean member() {
        return baseRole != null;
    }

    public boolean can(String permission) {
        return permissions.contains(permission);
    }
}
