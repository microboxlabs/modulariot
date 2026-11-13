package com.microboxlabs.miot.core.iam;

import java.util.List;
import java.util.Set;

/**
 * The permissions and module roles a module adds. Every module that checks permissions provides one bean;
 * {@link AccessRegistry} validates them all at startup.
 */
public interface AccessCatalog {

    List<PermissionDef> permissions();

    List<RoleDef> roles();

    /** Names and descriptions of the modules this catalog's roles belong to. */
    default List<ModuleDef> modules() {
        return List.of();
    }

    /** Permissions given to everyone who holds at least one role, module or custom. */
    default Set<String> anyRolePermissions() {
        return Set.of();
    }
}
