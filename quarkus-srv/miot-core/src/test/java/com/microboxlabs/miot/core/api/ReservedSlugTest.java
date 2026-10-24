package com.microboxlabs.miot.core.api;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import org.junit.jupiter.api.Test;

/** No organization can take a slug of the platform scope: they start with "_". */
class ReservedSlugTest {

    @Test
    void aSlugStartingWithAnUnderscoreIsRefused() {
        assertFalse("_platform".matches(PlatformOrganizationsResource.SLUG));
        assertFalse("_acme".matches(PlatformOrganizationsResource.SLUG));
        assertTrue("acme-north".matches(PlatformOrganizationsResource.SLUG));
    }
}
