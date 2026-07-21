package com.microboxlabs.miot.core.permission;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import jakarta.ws.rs.BadRequestException;
import org.junit.jupiter.api.Test;

class ContentReviewPermissionServiceTest {

    @Test
    void derivesTheSameScopedGroupForFormattedAndNormalizedTaxIds() {
        String prefix = "GROUP_MINTRAL_AUTO_APPROVERS_";

        assertEquals(
                "GROUP_MINTRAL_AUTO_APPROVERS_77856310K",
                ContentReviewPermissionService.targetGroupForTaxId(prefix, "77.856.310-k"));
        assertEquals(
                "GROUP_MINTRAL_AUTO_APPROVERS_77856310K",
                ContentReviewPermissionService.targetGroupForTaxId(prefix, "77856310-K"));
    }

    @Test
    void rejectsOrganizationsWithoutATaxId() {
        assertThrows(BadRequestException.class,
                () -> ContentReviewPermissionService.targetGroupForTaxId("GROUP_", null));
    }
}
