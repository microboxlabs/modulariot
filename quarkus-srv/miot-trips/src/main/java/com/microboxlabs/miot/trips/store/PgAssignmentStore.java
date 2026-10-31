package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.Assignment;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link AssignmentStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgAssignmentStore implements AssignmentStore {

    private static final String COLUMNS = """
            id, tenant_code, trip_id, resource_type, resource_id, valid_from, valid_to, reason,
            created_at, created_by, updated_at, updated_by""";

    private static final String INSERT = """
            INSERT INTO miot_trips.trip_resource_assignment
                (tenant_code, trip_id, resource_type, resource_id, valid_from, reason, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgAssignmentStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgAssignmentStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Assignment insert(Assignment a) {
        Tuple params = Tuple.tuple()
                .addString(a.tenantCode()).addUUID(Pg.parse(a.tripId())).addString(a.resourceType())
                .addUUID(Pg.parse(a.resourceId())).addOffsetDateTime(a.validFrom()).addString(a.reason())
                .addString(a.createdBy());
        return assignment(query(pool.get(), INSERT, params).iterator().next());
    }

    @Override
    public Optional<Assignment> find(String tenantCode, UUID id) {
        return first(query(pool.get(),
                "SELECT " + COLUMNS
                        + " FROM miot_trips.trip_resource_assignment WHERE tenant_code = $1 AND id = $2" + Pg.lock(),
                Tuple.of(tenantCode, id)));
    }

    @Override
    public List<Assignment> listByTrip(String tenantCode, UUID tripId) {
        return query(pool.get(),
                "SELECT " + COLUMNS + """
                 FROM miot_trips.trip_resource_assignment
                WHERE tenant_code = $1 AND trip_id = $2 AND version_of IS NULL AND is_active
                ORDER BY valid_from, created_at""",
                Tuple.of(tenantCode, tripId))
                .stream().map(PgAssignmentStore::assignment).toList();
    }

    @Override
    public Optional<Assignment> end(String tenantCode, UUID id, OffsetDateTime validTo, String reason,
            String actor) {
        return first(query(pool.get(), """
                UPDATE miot_trips.trip_resource_assignment
                SET valid_to = $3, reason = COALESCE($4, reason), updated_by = $5, updated_at = now()
                WHERE id = $1 AND tenant_code = $2 AND valid_to IS NULL
                RETURNING\s""" + COLUMNS,
                Tuple.of(id, tenantCode, validTo).addString(reason).addString(actor)));
    }

    private static Optional<Assignment> first(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(assignment(it.next())) : Optional.empty();
    }

    private static Assignment assignment(Row r) {
        return new Assignment(
                text(r.getUUID("id")), r.getString("tenant_code"), text(r.getUUID("trip_id")),
                r.getString("resource_type"), text(r.getUUID("resource_id")),
                time(r, "valid_from"), time(r, "valid_to"), r.getString("reason"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}
