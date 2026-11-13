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
    private final Map<String, ModuleDef> modules = new LinkedHashMap<>();
    private final Map<BaseRole, Set<String>> basePermissions;
    private final Set<String> anyRolePermissions = new TreeSet<>();

    @Inject
    public AccessRegistry(Instance<AccessCatalog> catalogs) {
        this((Iterable<AccessCatalog>) catalogs);
    }

    public AccessRegistry(Iterable<AccessCatalog> catalogs) {
        List<AccessCatalog> all = new ArrayList<>();
        catalogs.forEach(all::add);
        all.forEach(catalog -> catalog.permissions().forEach(this::addPermission));
        all.forEach(catalog -> catalog.roles().forEach(this::addRole));
        all.forEach(catalog -> catalog.modules().forEach(m -> modules.putIfAbsent(m.key(), m)));
        all.forEach(catalog -> catalog.anyRolePermissions().forEach(p -> {
            if (!permissions.containsKey(p)) {
                throw new IllegalStateException("any-role permission is unknown: " + p);
            }
            anyRolePermissions.add(p);
        }));
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

    /** The modules that have roles, in declaration order; a module without a {@link ModuleDef} is named by its key. */
    public List<ModuleDef> modules() {
        Map<String, ModuleDef> out = new LinkedHashMap<>();
        roles.values().forEach(r -> out.computeIfAbsent(r.module(),
                key -> modules.getOrDefault(key, new ModuleDef(key, Map.of(), Map.of(), false))));
        return List.copyOf(out.values());
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

    /** The permissions every holder of at least one role gets, see {@link AccessCatalog#anyRolePermissions}. */
    public Set<String> anyRolePermissions() {
        return Set.copyOf(anyRolePermissions);
    }

    /**
     * The permissions of the base role plus the module roles, ignoring role keys this modulith does not know. Holding
     * a known role adds {@link #anyRolePermissions}.
     */
    public Set<String> permissionsOf(BaseRole base, Collection<String> roleKeys) {
        Set<String> granted = new TreeSet<>(permissionsOf(base));
        boolean holdsRole = false;
        for (String key : roleKeys) {
            RoleDef role = roles.get(key);
            if (role != null) {
                granted.addAll(role.permissions());
                holdsRole = true;
            }
        }
        if (holdsRole) {
            granted.addAll(anyRolePermissions);
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
