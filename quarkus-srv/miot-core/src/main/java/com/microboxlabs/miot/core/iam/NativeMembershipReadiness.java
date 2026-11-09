package com.microboxlabs.miot.core.iam;

import io.smallrye.health.api.AsyncHealthCheck;
import io.smallrye.mutiny.Uni;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.eclipse.microprofile.health.Readiness;

/**
 * Down until {@link NativeMembershipMigration} has moved every organization off Alfresco membership, so a rollout
 * keeps sending traffic to the previous version until members can sign in on this one.
 */
@Readiness
@ApplicationScoped
public class NativeMembershipReadiness implements AsyncHealthCheck {

    private final NativeMembershipMigration migration;
    private final boolean api;

    @Inject
    public NativeMembershipReadiness(NativeMembershipMigration migration,
            @ConfigProperty(name = "miot.api.enabled", defaultValue = "true") boolean api) {
        this.migration = migration;
        this.api = api;
    }

    @Override
    public Uni<HealthCheckResponse> call() {
        return (api ? migration.settled() : Uni.createFrom().item(true))
                .onFailure().recoverWithItem(false)
                .map(ready -> HealthCheckResponse.named("native-membership-migration").status(ready).build());
    }
}
