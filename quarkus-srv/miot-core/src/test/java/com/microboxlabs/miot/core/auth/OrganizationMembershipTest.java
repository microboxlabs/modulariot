package com.microboxlabs.miot.core.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertSame;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.model.Organization;
import com.microboxlabs.miot.core.model.OrganizationRoleAssignment;
import java.util.List;
import java.util.Set;
import org.junit.jupiter.api.Test;

class OrganizationMembershipTest {

    private static final List<OrganizationRoleAssignment> ASSIGNMENTS = List.of(
            new OrganizationRoleAssignment(1L, "ORGANIZATION_OWNER", "Ana@Example.com"),
            new OrganizationRoleAssignment(1L, "CONTROL_TOWER_OPERATOR", "ana@example.com"),
            new OrganizationRoleAssignment(1L, "CONTROL_TOWER_VIEWER", "bo@example.com"));

    @Test
    void nativeOnlyWhenConfiguredSo() {
        assertTrue(new OrganizationMembership("native").isNative());
        assertTrue(new OrganizationMembership(" NATIVE ").isNative());
        assertFalse(new OrganizationMembership("alfresco").isNative());
    }

    @Test
    void aPersonHoldsTheirRolesWhateverTheCaseOfTheirEmail() {
        assertEquals(Set.of("ORGANIZATION_OWNER", "CONTROL_TOWER_OPERATOR"),
                OrganizationMembership.heldRoles(ASSIGNMENTS, " ana@EXAMPLE.com "));
        assertEquals(Set.of("CONTROL_TOWER_VIEWER"), OrganizationMembership.heldRoles(ASSIGNMENTS, "bo@example.com"));
    }

    @Test
    void someoneWithoutAnAssignmentHoldsNothing() {
        assertTrue(OrganizationMembership.heldRoles(ASSIGNMENTS, "eve@example.com").isEmpty());
        assertTrue(OrganizationMembership.heldRoles(ASSIGNMENTS, null).isEmpty());
        assertTrue(OrganizationMembership.heldRoles(ASSIGNMENTS, " ").isEmpty());
    }

    @Test
    void aSubAccountTakesItsRolesFromItsParent() {
        Organization parent = new Organization();
        Organization child = new Organization();
        child.parent = parent;
        assertSame(parent, OrganizationMembership.roleOwner(child));
        assertSame(parent, OrganizationMembership.roleOwner(parent));
    }
}
