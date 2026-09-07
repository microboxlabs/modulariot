package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;

class PlatformRoleDefinitionTest {

    @Test
    void resolvesThePlatformOwnerRole() {
        PlatformRoleDefinition definition = PlatformRoleDefinition.fromCode("PLATFORM_OWNER");

        assertEquals(PlatformRoleDefinition.OWNER, definition);
        assertEquals("PLATFORM_OWNER", definition.roleCode());
    }

    @Test
    void rejectsUnknownRoleCodes() {
        assertThrows(BadRequestException.class,
                () -> PlatformRoleDefinition.fromCode("ORGANIZATION_OWNER"));
    }
}
