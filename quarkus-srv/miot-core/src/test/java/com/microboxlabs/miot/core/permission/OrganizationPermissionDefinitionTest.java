package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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
    void harnessTrainerIsGrantedByItsRoleAndToOwners() {
        OrganizationPermissionDefinition permission =
                OrganizationPermissionDefinition.fromCode("harness_trainer");

        assertEquals(OrganizationPermissionDefinition.HARNESS_TRAINER, permission);
        assertEquals("HARNESS_TRAINER", permission.roleCode());
        assertTrue(permission.grantedToOwners());
        assertFalse(OrganizationPermissionDefinition
                .CONTENT_MULTIMEDIA_REVIEW_AUTO_APPROVE.grantedToOwners());
    }

    @Test
    void rejectsUnsupportedPermissionCodes() {
        assertThrows(NotFoundException.class,
                () -> OrganizationPermissionDefinition.fromCode("UNKNOWN"));
    }
}
