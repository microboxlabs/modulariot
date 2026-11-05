package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

class RoleProjectionTest {

    @Test
    void aFewRemovalsAreAlwaysAllowed() {
        assertFalse(RoleProjection.removalsHeld(3, 4));
    }

    @Test
    void removingMoreThanAQuarterOfAGroupIsHeld() {
        assertTrue(RoleProjection.removalsHeld(4, 10));
        assertFalse(RoleProjection.removalsHeld(4, 40));
    }
}
