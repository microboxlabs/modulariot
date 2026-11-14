package com.microboxlabs.miot.core.iam;

import com.microboxlabs.miot.core.iam.model.IamCustomRole;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

/**
 * The roles one organization can bind: the module roles of the {@link AccessRegistry} plus the organization's
 * custom roles. A custom role key starts with {@value #CUSTOM_PREFIX}; module role keys are UPPER_SNAKE, so the two
 * never collide.
 *
 * @param custom the permission keys of each custom role, by role key
 */
public record OrgRoles(AccessRegistry registry, Map<String, Set<String>> custom) {

    public static final String CUSTOM_PREFIX = "custom:";

    public OrgRoles {
        Map<String, Set<String>> copy = new LinkedHashMap<>();
        (custom == null ? Map.<String, Set<String>>of() : custom).forEach((key, permissions) -> {
            if (!isCustom(key)) {
                throw new IllegalArgumentException("custom role key must start with " + CUSTOM_PREFIX + ", got " + key);
            }
            copy.put(key, Set.copyOf(permissions));
        });
        custom = Map.copyOf(copy);
    }

    /** The module roles only. */
    public static OrgRoles system(AccessRegistry registry) {
        return new OrgRoles(registry, Map.of());
    }

    public static OrgRoles of(AccessRegistry registry, Collection<IamCustomRole> rows) {
        return new OrgRoles(registry, permissionsByKey(rows));
    }

    public static Map<String, Set<String>> permissionsByKey(Collection<IamCustomRole> rows) {
        Map<String, Set<String>> out = new LinkedHashMap<>();
        rows.forEach(row -> out.put(row.roleKey, Set.copyOf(row.permissions())));
        return out;
    }

    public static boolean isCustom(String roleKey) {
        return roleKey != null && roleKey.startsWith(CUSTOM_PREFIX);
    }

    /**
     * The permissions the role gives; empty when the organization has no such role. A custom role gives only the
     * permissions the running modulith still declares.
     */
    public Optional<Set<String>> permissions(String roleKey) {
        Optional<RoleDef> system = registry.role(roleKey);
        if (system.isPresent()) {
            return system.map(RoleDef::permissions);
        }
        Set<String> own = custom.get(roleKey);
        if (own == null) {
            return Optional.empty();
        }
        Set<String> known = new TreeSet<>();
        own.stream().filter(registry::knowsPermission).forEach(known::add);
        return Optional.of(known);
    }

    /**
     * The permissions of the base role plus these roles, ignoring role keys the organization does not have. Holding
     * one of its roles adds {@link AccessRegistry#anyRolePermissions}.
     */
    public Set<String> permissionsOf(BaseRole base, Collection<String> roleKeys) {
        Set<String> granted = new TreeSet<>(registry.permissionsOf(base));
        boolean holdsRole = false;
        for (String key : roleKeys) {
            Optional<Set<String>> given = permissions(key);
            if (given.isPresent()) {
                granted.addAll(given.get());
                holdsRole = true;
            }
        }
        if (holdsRole) {
            granted.addAll(registry.anyRolePermissions());
        }
        return granted;
    }
}
