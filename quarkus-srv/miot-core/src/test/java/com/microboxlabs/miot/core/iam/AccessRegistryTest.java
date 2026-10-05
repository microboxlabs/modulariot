package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class AccessRegistryTest {

    private static AccessCatalog catalog(List<PermissionDef> permissions, List<RoleDef> roles) {
        return new AccessCatalog() {
            @Override
            public List<PermissionDef> permissions() {
                return permissions;
            }

            @Override
            public List<RoleDef> roles() {
                return roles;
            }
        };
    }

    @Test
    void aRoleNamingAnUnknownPermissionFailsAtStartup() {
        AccessCatalog broken = catalog(List.of(), List.of(RoleDef.of("X_VIEWER", "x", "x", "x", Set.of("x:view"))));
        assertThrows(IllegalStateException.class, () -> new AccessRegistry(List.of(broken)));
    }

    @Test
    void aKeyDeclaredTwiceFailsAtStartup() {
        assertThrows(IllegalStateException.class,
                () -> new AccessRegistry(List.of(new CoreAccessCatalog(), new CoreAccessCatalog())));
    }

    @Test
    void keysFollowTheNamingRules() {
        assertThrows(IllegalArgumentException.class, () -> PermissionDef.of("View", "x", "x"));
        assertThrows(IllegalArgumentException.class, () -> RoleDef.of("viewer", "x", "x", "x", Set.of()));
    }

    @Test
    void baseRolesFollowTheExplicitAndOwnerOnlyFlags() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog()));
        Set<String> owner = registry.permissionsOf(BaseRole.OWNER);
        Set<String> admin = registry.permissionsOf(BaseRole.ADMIN);
        assertTrue(owner.contains(CoreAccessCatalog.BILLING_MANAGE));
        assertTrue(owner.contains(CoreAccessCatalog.HARNESS_TRAIN));
        assertTrue(!owner.contains(CoreAccessCatalog.CONTENT_AUTO_APPROVE));
        assertTrue(!admin.contains(CoreAccessCatalog.BILLING_MANAGE));
        assertTrue(admin.contains(CoreAccessCatalog.TEAMS_MANAGE));
        assertEquals(Set.of(CoreAccessCatalog.ORG_READ, CoreAccessCatalog.MEMBERS_READ),
                registry.permissionsOf(BaseRole.MEMBER));
    }

    @Test
    void unknownRoleKeysAreIgnored() {
        AccessRegistry registry = new AccessRegistry(List.of(new CoreAccessCatalog()));
        assertEquals(registry.permissionsOf(BaseRole.MEMBER),
                registry.permissionsOf(BaseRole.MEMBER, List.of("FROM_A_MODULE_NOT_DEPLOYED")));
    }
}
