package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.quarkus.runtime.LaunchMode;
import org.junit.jupiter.api.Test;

class DevHeaderTest {

    @Test
    void theDevEmailHeaderNamesAUserOnlyInDevAndTest() {
        assertTrue(IamIdentityAugmentor.devHeaderAllowed(LaunchMode.DEVELOPMENT));
        assertTrue(IamIdentityAugmentor.devHeaderAllowed(LaunchMode.TEST));
        assertFalse(IamIdentityAugmentor.devHeaderAllowed(LaunchMode.NORMAL));
    }
}
