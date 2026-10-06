package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.core.iam.model.IamRoleBinding;
import java.time.Instant;
import org.junit.jupiter.api.Test;

class IamRoleBindingTest {

    private static final Instant NOW = Instant.parse("2026-10-05T12:00:00Z");

    @Test
    void anOrganizationBindingCoversTheOrganizationAndItsSubAccounts() {
        IamRoleBinding onParent = IamRoleBinding.of(1L, IamRoleBinding.USER, "u", "R", "test");
        assertTrue(onParent.covers(1L, null, NOW));
        assertTrue(onParent.covers(2L, 1L, NOW));
        assertFalse(onParent.covers(3L, null, NOW));
    }

    @Test
    void aSubAccountBindingCoversOnlyThatSubAccount() {
        IamRoleBinding onNorth = IamRoleBinding.of(1L, IamRoleBinding.USER, "u", "R", "test");
        onNorth.scopeKind = IamRoleBinding.SUB_ACCOUNT;
        onNorth.scopeId = "2";
        assertTrue(onNorth.covers(2L, 1L, NOW));
        assertFalse(onNorth.covers(1L, null, NOW));
        assertFalse(onNorth.covers(4L, 1L, NOW));
    }

    @Test
    void anExpiredBindingCoversNothing() {
        IamRoleBinding expired = IamRoleBinding.of(1L, IamRoleBinding.USER, "u", "R", "test");
        expired.expiresAt = NOW;
        assertFalse(expired.covers(1L, null, NOW));
        expired.expiresAt = NOW.plusSeconds(60);
        assertTrue(expired.covers(1L, null, NOW));
    }
}
