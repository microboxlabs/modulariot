package com.microboxlabs.miot.core.iam;

import static org.junit.jupiter.api.Assertions.assertEquals;

import io.smallrye.mutiny.Uni;
import java.time.Duration;
import org.eclipse.microprofile.health.HealthCheckResponse.Status;
import org.junit.jupiter.api.Test;

/** A pod that does not serve the API leaves the migration to the one that does. */
class NativeMembershipMigrationSwitchTest {

    @Test
    void offItTouchesNoOrganizationAndReadinessStaysUp() {
        NativeMembershipMigration off = new NativeMembershipMigration(null, null, null, "alfresco", "stub", false, "1m",
                false, Duration.ofMinutes(5));

        // Without the switch this would list the organizations on Alfresco membership and mark them native.
        off.scheduled().await().atMost(Duration.ofSeconds(1));
        assertEquals(Status.UP, new NativeMembershipReadiness(off, false).call()
                .await().atMost(Duration.ofSeconds(1)).getStatus());
    }

    @Test
    void anApiWaitsForTheMigrationOwnedByAnotherPod() {
        NativeMembershipMigration pending = migration(Uni.createFrom().item(false));
        assertEquals(Status.DOWN, new NativeMembershipReadiness(pending, true).call()
                .await().atMost(Duration.ofSeconds(1)).getStatus());

        NativeMembershipMigration migrated = migration(Uni.createFrom().item(true));
        assertEquals(Status.UP, new NativeMembershipReadiness(migrated, true).call()
                .await().atMost(Duration.ofSeconds(1)).getStatus());
    }

    @Test
    void aFailedMembershipReadDoesNotAdmitApiTraffic() {
        NativeMembershipMigration failed = migration(Uni.createFrom().failure(new IllegalStateException("offline")));
        assertEquals(Status.DOWN, new NativeMembershipReadiness(failed, true).call()
                .await().atMost(Duration.ofSeconds(1)).getStatus());
    }

    private static NativeMembershipMigration migration(Uni<Boolean> settled) {
        return new NativeMembershipMigration(null, null, null, "alfresco", "stub", false, "1m", false,
                Duration.ofMinutes(5)) {
            @Override
            public Uni<Boolean> settled() {
                return settled;
            }
        };
    }
}
