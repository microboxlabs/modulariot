package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertTrue;

import java.time.Duration;
import org.junit.jupiter.api.Test;

/** A pod that does not serve the API leaves the migration to the one that does. */
class NativeMembershipMigrationSwitchTest {

    @Test
    void offItTouchesNoOrganizationAndReadinessStaysUp() {
        NativeMembershipMigration off = new NativeMembershipMigration(null, null, "alfresco", "stub", false, "1m",
                false);

        // Without the switch this would list the organizations on Alfresco membership and mark them native.
        off.scheduled().await().atMost(Duration.ofSeconds(1));
        assertTrue(off.settled());
    }
}
