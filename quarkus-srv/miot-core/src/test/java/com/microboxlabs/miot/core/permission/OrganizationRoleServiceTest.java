package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import java.util.List;
import org.junit.jupiter.api.Test;

class OrganizationRoleServiceTest {

    private static final Long ORGANIZATION_ID = 1L;

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
