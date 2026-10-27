package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.MandateRef;
import com.microboxlabs.miot.trips.domain.Trip;
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

/** {@link TripStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgTripStore implements TripStore {

    private static final String COLUMNS = """
            id, tenant_code, status, origin_id, destination_id, planned_start, actual_start, actual_end,
            cancel_reason, created_at, created_by, updated_at, updated_by""";

    private static final String T_COLUMNS = """
            t.id, t.tenant_code, t.status, t.origin_id, t.destination_id, t.planned_start, t.actual_start,
            t.actual_end, t.cancel_reason, t.created_at, t.created_by, t.updated_at, t.updated_by""";

    private static final String INSERT = """
            INSERT INTO miot_trips.trip
                (tenant_code, origin_id, destination_id, planned_start, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $5)
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_trips.trip SET
                status = $3, origin_id = $4, destination_id = $5, planned_start = $6,
                actual_start = $7, actual_end = $8, cancel_reason = $9, updated_by = $10, updated_at = now()
            WHERE id = $1 AND tenant_code = $2
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgTripStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTripStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Trip insert(Trip t) {
        Tuple params = Tuple.tuple()
                .addString(t.tenantCode()).addUUID(Pg.parse(t.originId())).addUUID(Pg.parse(t.destinationId()))
                .addOffsetDateTime(t.plannedStart()).addString(t.createdBy());
        return trip(query(pool.get(), INSERT, params).iterator().next());
    }

    @Override
    public Optional<Trip> find(String tenantCode, UUID id) {
        RowSet<Row> rows = query(pool.get(),
                "SELECT " + COLUMNS + " FROM miot_trips.trip WHERE tenant_code = $1 AND id = $2" + Pg.lock(),
                Tuple.of(tenantCode, id));
        return first(rows);
    }

    @Override
    public List<Trip> list(String tenantCode, TripFilter filter, int page, int size) {
        String status = filter.status();
        UUID mandateId = filter.mandateId();
        String assetId = filter.assetId();
        OffsetDateTime from = filter.from();
        OffsetDateTime to = filter.to();
        StringBuilder sql = new StringBuilder("SELECT ").append(T_COLUMNS)
                .append(" FROM miot_trips.trip t");
        if (mandateId != null) {
            sql.append(" JOIN miot_trips.trip_mandate tm ON tm.trip_id = t.id");
        }
        if (assetId != null) {
            sql.append(" JOIN miot_trips.trip_live tl ON tl.trip_id = t.id");
        }
        sql.append(" WHERE t.tenant_code = $1 AND t.version_of IS NULL AND t.is_active");
        if (mandateId != null) {
            sql.append(" AND tm.version_of IS NULL AND tm.is_active");
        }
        Tuple params = Tuple.of(tenantCode);
        if (status != null) {
            params.addString(status);
            sql.append(" AND t.status = $").append(params.size());
        }
        if (mandateId != null) {
            params.addUUID(mandateId);
            sql.append(" AND tm.mandate_id = $").append(params.size());
        }
        if (assetId != null) {
            params.addString(assetId);
            sql.append(" AND tl.asset_id = $").append(params.size());
        }
        if (from != null) {
            params.addOffsetDateTime(from);
            sql.append(" AND t.created_at >= $").append(params.size());
        }
        if (to != null) {
            params.addOffsetDateTime(to);
            sql.append(" AND t.created_at < $").append(params.size());
        }
        params.addInteger(size);
        sql.append(" ORDER BY t.created_at DESC, t.id DESC LIMIT $").append(params.size());
        params.addInteger(page * size);
        sql.append(" OFFSET $").append(params.size());
        return query(pool.get(), sql.toString(), params).stream().map(PgTripStore::trip).toList();
    }

    @Override
    public Optional<Trip> update(Trip t) {
        Tuple params = Tuple.tuple()
                .addUUID(Pg.parse(t.id())).addString(t.tenantCode())
                .addString(t.status()).addUUID(Pg.parse(t.originId())).addUUID(Pg.parse(t.destinationId()))
                .addOffsetDateTime(t.plannedStart()).addOffsetDateTime(t.actualStart())
                .addOffsetDateTime(t.actualEnd()).addString(t.cancelReason()).addString(t.updatedBy());
        return first(query(pool.get(), UPDATE, params));
    }

    @Override
    public boolean linkMandate(String tenantCode, UUID tripId, UUID mandateId, int seq, String role, String actor) {
        RowSet<Row> rows = query(pool.get(), """
                INSERT INTO miot_trips.trip_mandate (trip_id, mandate_id, tenant_code, seq, role, created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $6)
                ON CONFLICT (trip_id, mandate_id) WHERE version_of IS NULL AND is_active DO NOTHING
                RETURNING trip_id""",
                Tuple.tuple().addUUID(tripId).addUUID(mandateId).addString(tenantCode)
                        .addInteger(seq).addString(role).addString(actor));
        return rows.size() > 0;
    }

    @Override
    public boolean unlinkMandate(String tenantCode, UUID tripId, UUID mandateId) {
        RowSet<Row> rows = query(pool.get(), """
                UPDATE miot_trips.trip_mandate SET is_active = FALSE, updated_at = now()
                WHERE tenant_code = $1 AND trip_id = $2 AND mandate_id = $3
                  AND version_of IS NULL AND is_active
                RETURNING trip_id""",
                Tuple.of(tenantCode, tripId, mandateId));
        return rows.size() > 0;
    }

    @Override
    public List<UUID> openTripsAt(String tenantCode, UUID locationId) {
        return query(pool.get(), """
                SELECT id FROM miot_trips.trip t
                WHERE tenant_code = $1
                  AND (origin_id = $2 OR destination_id = $2 OR EXISTS (
                        SELECT 1 FROM miot_trips.stage s
                        WHERE s.subject_type = 'trip' AND s.subject_id = t.id AND s.location_id = $2
                          AND s.version_of IS NULL AND s.is_active))
                  AND version_of IS NULL AND is_active AND status NOT IN ($3, $4)""",
                Tuple.of(tenantCode, locationId, Trip.DONE, Trip.CANCELLED))
                .stream().map(r -> r.getUUID("id")).toList();
    }

    @Override
    public List<MandateRef> mandatesOf(String tenantCode, UUID tripId) {
        return query(pool.get(), """
                SELECT tm.mandate_id, m.external_code, m.status, tm.seq, tm.role
                FROM miot_trips.trip_mandate tm JOIN miot_trips.mandate m ON m.id = tm.mandate_id
                WHERE tm.tenant_code = $1 AND tm.trip_id = $2
                  AND tm.version_of IS NULL AND tm.is_active ORDER BY tm.seq""",
                Tuple.of(tenantCode, tripId))
                .stream()
                .map(r -> new MandateRef(text(r.getUUID("mandate_id")), r.getString("external_code"),
                        r.getString("status"), r.getInteger("seq"), r.getString("role")))
                .toList();
    }

    @Override
    public int cargoOfMandateOnTrip(String tenantCode, UUID tripId, UUID mandateId) {
        RowSet<Row> rows = query(pool.get(), """
                SELECT count(*) AS n
                FROM miot_trips.trip_cargo tc
                JOIN miot_trips.cargo_unit cu ON cu.id = tc.cargo_id
                JOIN miot_trips.mandate_line ml ON ml.id = cu.line_id
                WHERE tc.tenant_code = $1 AND tc.trip_id = $2 AND ml.mandate_id = $3
                  AND tc.version_of IS NULL AND tc.is_active""",
                Tuple.of(tenantCode, tripId, mandateId));
        return rows.iterator().next().getInteger("n");
    }

    private static Optional<Trip> first(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(trip(it.next())) : Optional.empty();
    }

    private static Trip trip(Row r) {
        return new Trip(
                text(r.getUUID("id")), r.getString("tenant_code"), r.getString("status"),
                text(r.getUUID("origin_id")), text(r.getUUID("destination_id")),
                time(r, "planned_start"), time(r, "actual_start"), time(r, "actual_end"),
                r.getString("cancel_reason"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}
