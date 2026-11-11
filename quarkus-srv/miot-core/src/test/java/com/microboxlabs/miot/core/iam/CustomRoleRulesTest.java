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
        Set<String> empty = Set.of();
        Map<String, Set<String>> systemKey = Map.of(CoordinatorAccessCatalog.REVIEWER, empty);
        assertThrows(IllegalArgumentException.class,
                () -> RoleDef.of("custom:x", "coordination", "x", "x", empty));
        assertThrows(IllegalArgumentException.class, () -> new OrgRoles(registry, systemKey));
    }

    @Test
    void permissionsMustBeInTheCatalog() {
        assertEquals(Set.of(CoordinatorAccessCatalog.GEOGRAPHIC_VIEW, CoreAccessCatalog.AUDIT_READ),
                CustomRoleRules.permissions(
                        List.of(CoreAccessCatalog.AUDIT_READ, " " + CoordinatorAccessCatalog.GEOGRAPHIC_VIEW,
                                CoreAccessCatalog.AUDIT_READ), registry));
        List<String> platform = List.of("platform:owners.manage");
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.permissions(platform, registry));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.permissions(List.of(), registry));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.permissions(null, registry));
    }

    @Test
    void namesAreRequiredAndBounded() {
        assertEquals("Revisor", CustomRoleRules.name(" Revisor ", "label.es"));
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.name(" ", "label.es"));
        String longName = "x".repeat(81);
        assertThrows(IllegalArgumentException.class, () -> CustomRoleRules.name(longName, "label.es"));
        assertNull(CustomRoleRules.description("  ", "description.es"));
        String longDescription = "x".repeat(501);
        assertThrows(IllegalArgumentException.class,
                () -> CustomRoleRules.description(longDescription, "description.es"));
    }

    @Test
    void onlyOwnersAndAdminsManageCustomRoles() {
        assertDoesNotThrow(() -> CustomRoleRules.checkManage(access(BaseRole.OWNER)));
        assertDoesNotThrow(() -> CustomRoleRules.checkManage(access(BaseRole.ADMIN)));
        Access member = access(BaseRole.MEMBER);
        Access outsider = Access.none(1L, "org");
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkManage(member));
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkManage(outsider));
        // A member holding every permission through roles is still not an administrator.
        Access loaded = new Access(1L, "org", BaseRole.MEMBER, Set.of(), registry.permissionsOf(BaseRole.OWNER));
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkManage(loaded));
    }

    @Test
    void anAdminCannotPutOwnerOnlyPermissionsInARole() {
        Access admin = access(BaseRole.ADMIN);
        assertDoesNotThrow(() -> CustomRoleRules.checkAdded(admin,
                Set.of(CoreAccessCatalog.MEMBERS_INVITE, CoordinatorAccessCatalog.STAGE_ESCALATION), registry));
        Set<String> ownerOnly = Set.of(CoreAccessCatalog.OWNERS_MANAGE);
        assertThrows(SecurityException.class, () -> CustomRoleRules.checkAdded(admin, ownerOnly, registry));
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
        Access admin = access(BaseRole.ADMIN);
        Access owner = access(BaseRole.OWNER);
        List<String> held = List.of(CUSTOM);
        List<String> foreign = List.of("custom:other");
        assertThrows(SecurityException.class, () -> TeamRules.checkGrant(admin, held, roles));
        assertThrows(IllegalArgumentException.class, () -> TeamRules.checkGrant(owner, foreign, roles));
    }
    @Test
    void aDelegatedMemberCannotGrantExplicitPermissionsTheyDoNotHold() {
        Access member = new Access(1L, "org", BaseRole.MEMBER, Set.of(), Set.of(CoreAccessCatalog.MEMBERS_UPDATE));
        List<String> roles = List.of(CoreAccessCatalog.CONTENT_REVIEW_AUTO_APPROVER);
        assertThrows(SecurityException.class, () -> TeamRules.checkGrant(member, roles, registry));
        Access holder = new Access(1L, "org", BaseRole.MEMBER, Set.of(),
                Set.of(CoreAccessCatalog.MEMBERS_UPDATE, CoreAccessCatalog.CONTENT_AUTO_APPROVE));
        assertDoesNotThrow(() -> TeamRules.checkGrant(holder, roles, registry));
        assertDoesNotThrow(() -> TeamRules.checkGrant(access(BaseRole.ADMIN), roles, registry));
    }

}
