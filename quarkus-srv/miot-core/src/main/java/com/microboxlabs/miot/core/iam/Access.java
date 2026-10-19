package com.microboxlabs.miot.core.iam;

import java.util.Set;

/**
 * What a caller may do in one organization: its base role (null when it is not a member), the module roles it holds,
 * and the permissions they give.
 *
 * @param alfrescoRole the caller's Alfresco site or group role when membership was checked against Alfresco
 */
public record Access(Long organizationId, String organizationSlug, BaseRole baseRole, Set<String> roles,
        Set<String> permissions, String alfrescoRole) {

    public Access {
        roles = Set.copyOf(roles);
        permissions = Set.copyOf(permissions);
    }

    public static Access none(Long organizationId, String organizationSlug) {
        return new Access(organizationId, organizationSlug, null, Set.of(), Set.of(), null);
    }

    public boolean member() {
        return baseRole != null;
    }

    public boolean can(String permission) {
        return permissions.contains(permission);
    }
}
