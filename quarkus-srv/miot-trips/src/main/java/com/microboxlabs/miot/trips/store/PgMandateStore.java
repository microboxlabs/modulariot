package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.Mandate;
import com.microboxlabs.miot.trips.domain.MandateLine;
import com.microboxlabs.miot.trips.domain.TripRef;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link MandateStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgMandateStore implements MandateStore {

    private static final String SELECT = "SELECT ";
    private static final String STATUS = "status";
    private static final String COLUMNS = """
            id, tenant_code, external_code, order_type, order_ref, status, origin_id, destination_id,
            sla_minutes, closed_at, cancel_reason, created_at, created_by, updated_at, updated_by""";

    /** The mandate and its line seq 1 in one statement: no item catalog yet, so every mandate carries one line. */
    private static final String INSERT = """
            WITH m AS (
                INSERT INTO miot_trips.mandate
                    (tenant_code, external_code, order_type, order_ref, origin_id, destination_id, sla_minutes,
                     created_by, updated_by)
                VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $8)
                ON CONFLICT (tenant_code, external_code) WHERE version_of IS NULL AND is_active DO NOTHING
                RETURNING *),
            line AS (
                INSERT INTO miot_trips.mandate_line (tenant_code, mandate_id, seq, created_by, updated_by)
                SELECT tenant_code, id, 1, created_by, created_by FROM m)
            SELECT\s""" + COLUMNS + " FROM m";

    private static final String UPDATE = """
            UPDATE miot_trips.mandate SET
                order_type = $3, order_ref = $4, status = $5, origin_id = $6, destination_id = $7,
                sla_minutes = $8, closed_at = $9, cancel_reason = $10, updated_by = $11, updated_at = now()
            WHERE id = $1 AND tenant_code = $2
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgMandateStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgMandateStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public CreateOrGet insertOrGet(Mandate m) {
        Tuple params = Tuple.tuple()
                .addString(m.tenantCode()).addString(m.externalCode()).addString(m.orderType())
                .addString(m.orderRef()).addUUID(Pg.parse(m.originId())).addUUID(Pg.parse(m.destinationId()))
                .addInteger(m.slaMinutes()).addString(m.createdBy());
        RowSet<Row> rows = query(pool.get(), INSERT, params);
        if (rows.size() > 0) {
            return new CreateOrGet(mandate(rows.iterator().next()), true);
        }
        Mandate existing = findByCode(m.tenantCode(), m.externalCode())
                .orElseThrow(() -> new IllegalStateException("mandate vanished during insert"));
        return new CreateOrGet(existing, false);
    }

    @Override
    public Optional<Mandate> find(String tenantCode, UUID id) {
        RowSet<Row> rows = query(pool.get(),
                SELECT + COLUMNS + " FROM miot_trips.mandate WHERE tenant_code = $1 AND id = $2" + Pg.lock(),
                Tuple.of(tenantCode, id));
        return first(rows);
    }

    @Override
    public Optional<Mandate> findByCode(String tenantCode, String externalCode) {
        RowSet<Row> rows = query(pool.get(),
                SELECT + COLUMNS + """
                 FROM miot_trips.mandate
                WHERE tenant_code = $1 AND external_code = $2 AND version_of IS NULL AND is_active""",
                Tuple.of(tenantCode, externalCode));
        return first(rows);
    }

    @Override
    public List<Mandate> list(String tenantCode, String status, String externalCode, int page, int size) {
        StringBuilder sql = new StringBuilder(SELECT).append(COLUMNS)
                .append(" FROM miot_trips.mandate WHERE tenant_code = $1 AND version_of IS NULL AND is_active");
        Tuple params = Tuple.of(tenantCode);
        if (status != null) {
            params.addString(status);
            sql.append(" AND status = $").append(params.size());
        }
        if (externalCode != null) {
            params.addString(externalCode);
            sql.append(" AND external_code = $").append(params.size());
        }
        params.addInteger(size);
        sql.append(" ORDER BY created_at DESC, id DESC LIMIT $").append(params.size());
        params.addInteger(page * size);
        sql.append(" OFFSET $").append(params.size());
        return query(pool.get(), sql.toString(), params).stream().map(PgMandateStore::mandate).toList();
    }

    @Override
    public Optional<Mandate> update(Mandate m) {
        Tuple params = Tuple.tuple()
                .addUUID(Pg.parse(m.id())).addString(m.tenantCode())
                .addString(m.orderType()).addString(m.orderRef()).addString(m.status())
                .addUUID(Pg.parse(m.originId())).addUUID(Pg.parse(m.destinationId()))
                .addInteger(m.slaMinutes()).addOffsetDateTime(m.closedAt()).addString(m.cancelReason())
                .addString(m.updatedBy());
        return first(query(pool.get(), UPDATE, params));
    }

    @Override
    public Optional<MandateLine> lineOf(String tenantCode, UUID mandateId) {
        RowSet<Row> rows = query(pool.get(), """
                SELECT id, tenant_code, mandate_id, seq, item_id FROM miot_trips.mandate_line
                WHERE tenant_code = $1 AND mandate_id = $2 AND version_of IS NULL AND is_active
                ORDER BY seq LIMIT 1""",
                Tuple.of(tenantCode, mandateId));
        RowIterator<Row> it = rows.iterator();
        if (!it.hasNext()) {
            return Optional.empty();
        }
        Row r = it.next();
        return Optional.of(new MandateLine(text(r.getUUID("id")), r.getString("tenant_code"),
                text(r.getUUID("mandate_id")), r.getInteger("seq"), text(r.getUUID("item_id"))));
    }

    @Override
    public List<TripRef> tripsOf(String tenantCode, UUID mandateId) {
        return query(pool.get(), """
                SELECT tm.trip_id, t.status, tm.seq, tm.role
                FROM miot_trips.trip_mandate tm JOIN miot_trips.trip t ON t.id = tm.trip_id
                WHERE tm.tenant_code = $1 AND tm.mandate_id = $2
                  AND tm.version_of IS NULL AND tm.is_active ORDER BY tm.seq""",
                Tuple.of(tenantCode, mandateId))
                .stream()
                .map(r -> new TripRef(text(r.getUUID("trip_id")), r.getString(STATUS),
                        r.getInteger("seq"), r.getString("role")))
                .toList();
    }

    @Override
    public Optional<String> statusForLink(String tenantCode, UUID mandateId) {
        RowIterator<Row> it = query(pool.get(),
                "SELECT status FROM miot_trips.mandate WHERE tenant_code = $1 AND id = $2"
                        + " AND version_of IS NULL AND is_active FOR SHARE",
                Tuple.of(tenantCode, mandateId)).iterator();
        return it.hasNext() ? Optional.of(it.next().getString(STATUS)) : Optional.empty();
    }

    @Override
    public int openTrips(String tenantCode, UUID mandateId) {
        RowSet<Row> rows = query(pool.get(), """
                SELECT count(*) AS n
                FROM miot_trips.trip_mandate tm JOIN miot_trips.trip t ON t.id = tm.trip_id
                WHERE tm.tenant_code = $1 AND tm.mandate_id = $2 AND t.status NOT IN ('completed','cancelled')
                  AND tm.version_of IS NULL AND tm.is_active""",
                Tuple.of(tenantCode, mandateId));
        return rows.iterator().next().getInteger("n");
    }

    private static Optional<Mandate> first(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(mandate(it.next())) : Optional.empty();
    }

    private static Mandate mandate(Row r) {
        return new Mandate(
                text(r.getUUID("id")), r.getString("tenant_code"), r.getString("external_code"),
                r.getString("order_type"), r.getString("order_ref"), r.getString(STATUS),
                text(r.getUUID("origin_id")), text(r.getUUID("destination_id")),
                r.getInteger("sla_minutes"), time(r, "closed_at"), r.getString("cancel_reason"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}
