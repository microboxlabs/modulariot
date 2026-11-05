package com.microboxlabs.miot.core.iam;

import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

/**
 * Down until {@link NativeMembershipMigration} has moved every organization off Alfresco membership, so a rollout
 * keeps sending traffic to the previous version until members can sign in on this one.
 */
@Readiness
@ApplicationScoped
public class NativeMembershipReadiness implements HealthCheck {

    private final NativeMembershipMigration migration;

    @Inject
    public NativeMembershipReadiness(NativeMembershipMigration migration) {
        this.migration = migration;
    }

    @Override
    public HealthCheckResponse call() {
        return HealthCheckResponse.named("native-membership-migration").status(migration.settled()).build();
    }
}
