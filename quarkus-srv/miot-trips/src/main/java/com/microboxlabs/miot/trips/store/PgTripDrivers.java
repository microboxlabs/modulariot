package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.core.trips.TripDrivers;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.stream.Collectors;

/** {@link TripDrivers} from the current driver assignments, by the time they were made. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgTripDrivers implements TripDrivers {

    private static final String CURRENT_DRIVERS = """
             FROM miot_trips.trip_resource_assignment
            WHERE resource_type = 'driver' AND version_of IS NULL AND is_active""";

    private final Supplier<Pool> pool;

    @Inject
    PgTripDrivers(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgTripDrivers(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public boolean listsDrivers() {
        return true;
    }

    @Override
    public List<String> tenantsAssigningDrivers(OffsetDateTime since) {
        return query(pool.get(), "SELECT DISTINCT tenant_code" + CURRENT_DRIVERS
                + " AND created_at > $1 ORDER BY tenant_code", Tuple.of(since))
                .stream().map(r -> r.getString("tenant_code")).toList();
    }

    @Override
    public Set<UUID> recentlyAssignedDrivers(String tenantCode, Collection<UUID> ids, OffsetDateTime since) {
        if (ids.isEmpty()) {
            return Set.of();
        }
        return query(pool.get(), "SELECT DISTINCT resource_id" + CURRENT_DRIVERS
                + " AND tenant_code = $1 AND resource_id = ANY($2) AND created_at > $3",
                Tuple.of(tenantCode, ids.toArray(UUID[]::new), since))
                .stream().map(r -> r.getUUID("resource_id")).collect(Collectors.toSet());
    }

    @Override
    public List<Assigned> driversAssignedSince(String tenantCode, OffsetDateTime since, UUID afterId, int limit) {
        Tuple params = Tuple.of(tenantCode, since);
        String from = " AND created_at > $2";
        String after = "";
        if (afterId != null) {
            params.addUUID(afterId);
            from = " AND created_at >= $2";
            after = " HAVING (max(created_at), resource_id) > ($2, $3)";
        }
        params.addInteger(limit);
        return query(pool.get(), "SELECT resource_id, max(created_at) AS assigned_at" + CURRENT_DRIVERS
                + " AND tenant_code = $1" + from + " GROUP BY resource_id" + after
                + " ORDER BY assigned_at, resource_id LIMIT $" + params.size(), params)
                .stream().map(r -> new Assigned(r.getUUID("resource_id"), time(r, "assigned_at"))).toList();
    }
}
