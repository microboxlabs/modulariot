package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CustomRoleRulesTest {

    private static final String CUSTOM = "custom:supervisor-de-ruta";

    private final AccessRegistry registry =
            new AccessRegistry(List.of(new CoreAccessCatalog(), new CoordinatorAccessCatalog()));

    private Access access(BaseRole base) {
        return new Access(1L, "org", base, Set.of(), registry.permissionsOf(base));
    }

    @Test
    void aKeyIsTheNameAsASlugUnderTheCustomPrefix() {
        assertEquals(CUSTOM, CustomRoleRules.key("  Supervisor de Ruta ", List.of()));
        assertEquals("custom:revision-n-2", CustomRoleRules.key("Revisión Nº 2", List.of()));
        assertEquals("custom:role", CustomRoleRules.key("¡¿?!", List.of()));
    }

    @Test
    void aTakenKeyGetsANumber() {
        assertEquals(CUSTOM + "-2", CustomRoleRules.key("Supervisor de ruta", List.of(CUSTOM)));
        assertEquals(CUSTOM + "-3", CustomRoleRules.key("Supervisor de ruta", List.of(CUSTOM, CUSTOM + "-2")));
    }

    @Test
    void aLongNameStillFitsTheKeyColumn() {
        String key = CustomRoleRules.key("a".repeat(80), List.of());
        assertTrue(key.length() <= 96 - 4, key);
        assertFalse(key.endsWith("-"));
    }

    @Test
    void noCustomKeyIsAModuleRoleKey() {
        for (RoleDef role : registry.roles()) {
            assertFalse(OrgRoles.isCustom(role.key()), role.key());
            // A custom role named after a module role still gets its own key.
            String key = CustomRoleRules.key(role.key(), List.of());
            assertTrue(registry.role(key).isEmpty(), key);
        }
        assertThrows(IllegalArgumentException.class,
                () -> RoleDef.of("custom:x", "coordination", "x", "x", Set.of()));
        assertThrows(IllegalArgumentException.class,
                () -> new OrgRoles(registry, Map.of(CoordinatorAccessCatalog.REVIEWER, Set.of())));
    }

    @Test
    void permissionsMustBeInTheCatalog() {
        assertEquals(Set.of(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW, CoreAccessCatalog.AUDIT_READ),
                CustomRoleRules.permissions(
                        List.of(CoreAccessCatalog.AUDIT_READ, " " + CoordinatorAccessCatalog.GEOGRAPHIC_VIEW,
                                CoreAccessCatalog.AUDIT_READ), registry));
        assertThrows(IllegalArgumentException.class,
                () -> CustomRoleRules.permissions(List.of("platform:owners.manage"), registry));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.permissions(List.of(), registry));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.permissions(null, registry));
    }

    @Test
    void namesAreRequiredAndBounded() {
        assertEquals("Revisor", CustomRoleRules.name(" Revisor ", "label.es"));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.name(" ", "label.es"));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.name("x".repeat(81), "label.es"));
        assertNull(CustomRoleRules.description("  ", "description.es"));
        assertThrows(IllegalArgumentException.class,
                () -> CustomRoleRules.description("x".repeat(501), "description.es"));
    }

    @Test
    void onlyOwnersAndAdminsManageCustomRoles() {
        assertDoesNotThrow(() -> CustomRoleRules.checkManage(access(BaseRole.OWNER)));
        assertDoesNotThrow(() -> CustomRoleRules.checkManage(access(BaseRole.ADMIN)));
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkManage(access(BaseRole.MEMBER)));
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkManage(Access.none(1L, "org")));
        // A member holding every permission through roles is still not an administrator.
        Access loaded = new Access(1L, "org", BaseRole.MEMBER, Set.of(), registry.permissionsOf(BaseRole.OWNER));
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkManage(loaded));
    }

    @Test
    void anAdminCannotPutOwnerOnlyPermissionsInARole() {
        Access admin = access(BaseRole.ADMIN);
        assertDoesNotThrow(() -> CustomRoleRules.checkAdded(admin,
                Set.of(CoreAccessCatalog.MEMBERS_INVITE, CoordinatorAccessCatalog.STAGE_ESCALATION), registry));
        assertThrows(SecurityException.class,
                () -> CustomRoleRules.checkAdded(admin, Set.of(CoreAccessCatalog.OWNERS_MANAGE), registry));
        assertDoesNotThrow(() -> CustomRoleRules.checkAdded(access(BaseRole.OWNER),
                Set.of(CoreAccessCatalog.OWNERS_MANAGE), registry));
    }

    @Test
    void aBoundCustomRoleGivesItsPermissions() {
        Map<String, Set<String>> custom = Map.of(CUSTOM,
                Set.of(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW, CoreAccessCatalog.AUDIT_READ, "gone:permission"));
        Access access = AccessRules.resolve(1L, "org", Caller.user("ana@example.test"),
                new AccessRules.Facts(BaseRole.MEMBER, false, Set.of(CUSTOM, CoordinatorAccessCatalog.KANBAN_USER),
                        false, custom), registry);
        assertTrue(access.roles().contains(CUSTOM));
        assertTrue(access.can(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW));
        assertTrue(access.can(CoreAccessCatalog.AUDIT_READ));
        assertTrue(access.can(CoordinatorAccessCatalog.TASK_COMPLETE));
        // A permission the catalog no longer declares is not granted.
        assertFalse(access.can("gone:permission"));
        assertFalse(access.can(CoreAccessCatalog.MEMBERS_INVITE));
    }

    @Test
    void aCustomKeyTheOrganizationDoesNotHaveGivesNothing() {
        Access access = AccessRules.resolve(1L, "org", Caller.user("ana@example.test"),
                new AccessRules.Facts(BaseRole.MEMBER, false, Set.of(CUSTOM)), registry);
        assertEquals(registry.permissionsOf(BaseRole.MEMBER), access.permissions());
        assertEquals(Optional.empty(), OrgRoles.system(registry).permissions(CUSTOM));
    }

    @Test
    void grantingACustomRoleFollowsTheModuleRoleRule() {
        OrgRoles roles = new OrgRoles(registry, Map.of(CUSTOM, Set.of(CoreAccessCatalog.OWNERS_MANAGE)));
        assertDoesNotThrow(() -> TeamRules.checkGrant(access(BaseRole.OWNER), List.of(CUSTOM), roles));
        assertThrows(SecurityException.class,
                () -> TeamRules.checkGrant(access(BaseRole.ADMIN), List.of(CUSTOM), roles));
        assertThrows(IllegalArgumentException.class,
                () -> TeamRules.checkGrant(access(BaseRole.OWNER), List.of("custom:other"), roles));
    }
}
