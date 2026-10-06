package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.iam.Access;
import com.microboxlabs.miot.core.iam.BaseRole;
import jakarta.ws.rs.BadRequestException;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrganizationRoleServiceTest {

    @Test
    void onlyTheOwnerRoleMustKeepAnAssignee() {
        SetOrganizationRoleRequest none = new SetOrganizationRoleRequest(Set.of(" "));
        assertThrows(BadRequestException.class,
                () -> OrganizationRoleService.normalizeAssignees(none, OrganizationRoleService.OWNER_ROLE_CODE));
        assertTrue(OrganizationRoleService.normalizeAssignees(none, "CONTROL_TOWER_VIEWER").isEmpty());
        assertEquals(Set.of("ana@example.com"), OrganizationRoleService.normalizeAssignees(
                new SetOrganizationRoleRequest(Set.of(" ana@example.com ")), "CONTROL_TOWER_VIEWER"));
    }

    @Test
    void ownersAndAdminsHaveOwnerAccessForTheApp() {
        assertEquals("OWNER", OrganizationRoleService.accessRole(access(BaseRole.OWNER)));
        assertEquals("OWNER", OrganizationRoleService.accessRole(access(BaseRole.ADMIN)));
        assertEquals("MEMBER", OrganizationRoleService.accessRole(access(BaseRole.MEMBER)));
        assertEquals("MEMBER", OrganizationRoleService.accessRole(Access.none(1L, "acme")));
    }

    private static Access access(BaseRole base) {
        return new Access(1L, "acme", base, Set.of(), Set.of(), null);
    }
}
