package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.api.dto.SetOrganizationRoleRequest;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import jakarta.ws.rs.BadRequestException;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrganizationRoleServiceTest {

    private static final Long ORGANIZATION_ID = 1L;

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
    void resolvesPersistedOwnersAndRegularMembers() {
        List<OrganizationRoleAssignment> owners = List.of(
                owner("owner@example.com"));

        assertEquals(OrganizationRoleService.OWNER_ACCESS_ROLE,
                OrganizationRoleService.resolveAssignedRole(
                        owners, "owner@example.com"));
        assertEquals(OrganizationRoleService.MEMBER_ACCESS_ROLE,
                OrganizationRoleService.resolveAssignedRole(
                        owners, "member@example.com"));
    }

    @Test
    void requestsBootstrapResolutionWhenNoOwnerIsPersisted() {
        assertNull(OrganizationRoleService.resolveAssignedRole(
                List.of(), "manager@example.com"));
    }

    @Test
    void onlyLegacyManagersBootstrapTheInitialOwner() {
        assertEquals(OrganizationRoleService.OWNER_ACCESS_ROLE,
                OrganizationRoleService.resolveBootstrapAccessRole("SITE_MANAGER"));
        assertEquals(OrganizationRoleService.OWNER_ACCESS_ROLE,
                OrganizationRoleService.resolveBootstrapAccessRole("GROUP_ADMIN"));
        assertEquals(OrganizationRoleService.MEMBER_ACCESS_ROLE,
                OrganizationRoleService.resolveBootstrapAccessRole("SITE_CONSUMER"));
    }

    private static OrganizationRoleAssignment owner(String personId) {
        return new OrganizationRoleAssignment(
                ORGANIZATION_ID,
                OrganizationRoleService.OWNER_ROLE_CODE,
                personId);
    }
}
