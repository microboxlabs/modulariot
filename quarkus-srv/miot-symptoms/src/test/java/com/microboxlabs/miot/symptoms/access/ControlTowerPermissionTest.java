package com.microboxlabs.miot.symptoms.access;

import static com.microboxlabs.miot.symptoms.access.ControlTowerPermission.MAINTAIN;
import static com.microboxlabs.miot.symptoms.access.ControlTowerPermission.OPERATE;
import static com.microboxlabs.miot.symptoms.access.ControlTowerPermission.VIEW;
import static org.junit.jupiter.api.Assertions.assertEquals;

import com.microboxlabs.miot.core.permission.OrganizationRoleService;
import java.util.Set;
import org.junit.jupiter.api.Test;

class ControlTowerPermissionTest {

    private static Set<ControlTowerPermission> nativeGrant(String... roles) {
        return ControlTowerPermission.granted(Set.of(roles), true);
    }

    @Test
    void eachRoleGivesItsPermissions() {
        assertEquals(Set.of(VIEW, OPERATE, MAINTAIN), nativeGrant(OrganizationRoleService.OWNER_ROLE_CODE));
        assertEquals(Set.of(VIEW, OPERATE, MAINTAIN), nativeGrant(ControlTowerRoles.MAINTAINER));
        assertEquals(Set.of(VIEW, OPERATE), nativeGrant(ControlTowerRoles.OPERATOR));
        assertEquals(Set.of(VIEW), nativeGrant(ControlTowerRoles.VIEWER));
    }

    @Test
    void theStrongestRoleWins() {
        assertEquals(Set.of(VIEW, OPERATE), nativeGrant(ControlTowerRoles.VIEWER, ControlTowerRoles.OPERATOR));
    }

    @Test
    void aNativeMemberWithoutAControlTowerRoleGetsNothing() {
        assertEquals(Set.of(), nativeGrant("DASHBOARD_EDITOR"));
    }

    @Test
    void anAlfrescoMemberWithoutARoleKeepsWhatMembersHadBefore() {
        assertEquals(Set.of(VIEW, OPERATE), ControlTowerPermission.granted(Set.of(), false));
        assertEquals(Set.of(VIEW, OPERATE, MAINTAIN),
                ControlTowerPermission.granted(Set.of(OrganizationRoleService.OWNER_ROLE_CODE), false));
    }

    @Test
    void theCatalogListsTheThreeRoles() {
        assertEquals(Set.of(ControlTowerRoles.VIEWER, ControlTowerRoles.OPERATOR, ControlTowerRoles.MAINTAINER),
                new ControlTowerRoles().roleCodes());
    }
}
