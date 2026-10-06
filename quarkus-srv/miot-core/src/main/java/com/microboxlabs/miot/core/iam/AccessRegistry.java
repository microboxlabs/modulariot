package com.microboxlabs.miot.core.iam;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeSet;

/**
 * Every permission and module role the running modulith knows, from all {@link AccessCatalog} beans. Fails at
 * construction, so at startup, when two catalogs declare the same key or a role names an unknown permission.
 */
@ApplicationScoped
public class AccessRegistry {

    private final Map<String, PermissionDef> permissions = new LinkedHashMap<>();
    private final Map<String, RoleDef> roles = new LinkedHashMap<>();
    private final Map<BaseRole, Set<String>> basePermissions;

    @Inject
    public AccessRegistry(Instance<AccessCatalog> catalogs) {
        this((Iterable<AccessCatalog>) catalogs);
    }

    public AccessRegistry(Iterable<AccessCatalog> catalogs) {
        List<AccessCatalog> all = new ArrayList<>();
        catalogs.forEach(all::add);
        all.forEach(catalog -> catalog.permissions().forEach(this::addPermission));
        all.forEach(catalog -> catalog.roles().forEach(this::addRole));
        Set<String> owner = new TreeSet<>();
        Set<String> admin = new TreeSet<>();
        for (PermissionDef p : permissions.values()) {
            if (!p.explicitOnly()) {
                owner.add(p.key());
                if (!p.ownerOnly()) {
                    admin.add(p.key());
                }
            }
        }
        basePermissions = Map.of(
                BaseRole.OWNER, Set.copyOf(owner),
                BaseRole.ADMIN, Set.copyOf(admin),
                BaseRole.MEMBER, Set.of(CoreAccessCatalog.ORG_READ, CoreAccessCatalog.MEMBERS_READ));
    }

    private void addPermission(PermissionDef p) {
        if (permissions.putIfAbsent(p.key(), p) != null) {
            throw new IllegalStateException("permission declared twice: " + p.key());
        }
    }

    private void addRole(RoleDef r) {
        for (String p : r.permissions()) {
            if (!permissions.containsKey(p)) {
                throw new IllegalStateException("role " + r.key() + " names unknown permission " + p);
            }
        }
        if (roles.putIfAbsent(r.key(), r) != null) {
            throw new IllegalStateException("role declared twice: " + r.key());
        }
    }

    public Collection<PermissionDef> permissions() {
        return permissions.values();
    }

    public Collection<RoleDef> roles() {
        return roles.values();
    }

    public Optional<RoleDef> role(String key) {
        return Optional.ofNullable(roles.get(key));
    }

    public boolean knowsPermission(String key) {
        return permissions.containsKey(key);
    }

    public Set<String> permissionsOf(BaseRole base) {
        return base == null ? Set.of() : basePermissions.get(base);
    }

    /** The permissions of the base role plus the module roles, ignoring role keys this modulith does not know. */
    public Set<String> permissionsOf(BaseRole base, Collection<String> roleKeys) {
        Set<String> granted = new TreeSet<>(permissionsOf(base));
        for (String key : roleKeys) {
            RoleDef role = roles.get(key);
            if (role != null) {
                granted.addAll(role.permissions());
            }
        }
        return granted;
    }

    /** The legacy-default role of each module that has one, keyed by module. */
    public Map<String, RoleDef> legacyDefaults() {
        Map<String, RoleDef> defaults = new LinkedHashMap<>();
        for (RoleDef r : roles.values()) {
            if (r.legacyDefault()) {
                defaults.put(r.module(), r);
            }
        }
        return defaults;
    }
}
