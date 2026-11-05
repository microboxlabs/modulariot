package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;

import com.microboxlabs.miot.core.iam.TeamDeletionGuard;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.TreeSet;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link ConfirmerStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgConfirmerStore implements ConfirmerStore {

    private final Supplier<Pool> pool;

    @Inject
    PgConfirmerStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgConfirmerStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Map<String, UUID> ofMonitor(String tenantCode, String monitorKey) {
        return teams(query(pool.get(), """
                SELECT milestone, team_id FROM miot_trips.milestone_confirmer
                WHERE tenant_code = $1 AND monitor_key = $2""", Tuple.of(tenantCode, monitorKey)));
    }

    @Override
    public Map<String, UUID> ofTrip(String tenantCode, UUID tripId) {
        return teams(query(pool.get(), """
                SELECT c.milestone, c.team_id
                FROM miot_trips.trip_monitor_state s
                JOIN miot_trips.milestone_confirmer c
                  ON c.tenant_code = s.tenant_code AND c.monitor_key = s.monitor_key
                WHERE s.tenant_code = $1 AND s.trip_id = $2""", Tuple.of(tenantCode, tripId)));
    }

    @Override
    public void replace(String tenantCode, String monitorKey, Map<String, UUID> teams, String actor) {
        PgMonitorStore.lockMonitor(pool.get(), tenantCode, monitorKey);
        for (UUID teamId : new TreeSet<>(teams.values())) {
            query(pool.get(), "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                    Tuple.of(TeamDeletionGuard.lockKey(teamId)));
            if (!query(pool.get(), "SELECT 1 FROM miot_iam.iam_team WHERE id = $1", Tuple.of(teamId))
                    .iterator().hasNext()) {
                throw new IllegalArgumentException("team " + teamId + " no longer exists");
            }
        }
        query(pool.get(), "DELETE FROM miot_trips.milestone_confirmer WHERE tenant_code = $1 AND monitor_key = $2",
                Tuple.of(tenantCode, monitorKey));
        teams.forEach((milestone, team) -> query(pool.get(), """
                INSERT INTO miot_trips.milestone_confirmer (tenant_code, monitor_key, milestone, team_id, updated_by)
                VALUES ($1, $2, $3, $4, $5)""", Tuple.of(tenantCode, monitorKey, milestone, team, actor)));
    }

    private static Map<String, UUID> teams(RowSet<Row> rows) {
        Map<String, UUID> out = new LinkedHashMap<>();
        rows.forEach(r -> out.put(r.getString("milestone"), r.getUUID("team_id")));
        return out;
    }
}
