package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;

class OrganizationRoleDefinitionTest {

    @Test
    void resolvesTheOrganizationOwnerRole() {
        OrganizationRoleDefinition definition =
                OrganizationRoleDefinition.fromCode("ORGANIZATION_OWNER");

        assertEquals(OrganizationRoleDefinition.OWNER, definition);
        assertEquals("ORGANIZATION_OWNER", definition.roleCode());
    }

    @Test
    void rejectsUnknownRoleCodes() {
        assertThrows(BadRequestException.class,
                () -> OrganizationRoleDefinition.fromCode("ALFRESCO_ADMIN"));
    }
}
