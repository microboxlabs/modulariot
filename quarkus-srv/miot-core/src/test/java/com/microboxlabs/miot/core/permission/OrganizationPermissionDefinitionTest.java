package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.NotFoundException;
import org.junit.jupiter.api.Test;

class OrganizationPermissionDefinitionTest {

    @Test
    void resolvesPermissionCodesCaseInsensitively() {
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode(
                        "content_multimedia_review_auto_approve");

        assertEquals(
                "CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE",
                permission.permissionCode());
        assertEquals("CONTENT_REVIEW_AUTO_APPROVER", permission.roleCode());
    }

    @Test
    void rejectsUnsupportedPermissionCodes() {
        assertThrows(NotFoundException.class,
                () -> OrganizationPermissionDefinition.fromCode("UNKNOWN"));
    }
}
