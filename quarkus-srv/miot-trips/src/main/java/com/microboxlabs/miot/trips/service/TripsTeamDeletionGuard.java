package com.microboxlabs.miot.trips.service;

import com.microboxlabs.miot.core.iam.TeamDeletionGuard;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.UUID;
import java.util.function.Supplier;

/** Keeps a team available while a trip monitor assigns it to confirm milestones. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class TripsTeamDeletionGuard implements TeamDeletionGuard {

    private final Supplier<Pool> pool;

    @Inject
    public TripsTeamDeletionGuard(Instance<Pool> pool) {
        this(pool::get);
    }

    public TripsTeamDeletionGuard(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Uni<Void> requireUnused(UUID teamId) {
        return pool.get().query("SELECT to_regclass('miot_trips.milestone_confirmer')::text AS relation")
                .execute().flatMap(schema -> {
                    if (schema.iterator().next().getString("relation") == null) {
                        return Uni.createFrom().voidItem();
                    }
                    return pool.get().preparedQuery("SELECT 1 FROM miot_trips.milestone_confirmer"
                                    + " WHERE team_id = $1 LIMIT 1")
                            .execute(Tuple.of(teamId))
                            .flatMap(rows -> rows.iterator().hasNext()
                                    ? Uni.createFrom().failure(new IllegalStateException(
                                            "Team is assigned to trip milestone confirmations"))
                                    : Uni.createFrom().voidItem());
                });
    }
}
