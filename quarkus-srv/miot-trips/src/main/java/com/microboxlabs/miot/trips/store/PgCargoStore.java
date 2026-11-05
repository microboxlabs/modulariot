package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.CargoUnit;
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

/** {@link CargoStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgCargoStore implements CargoStore {

    private static final String SELECT = "SELECT ";
    private static final String COLUMNS = """
            id, tenant_code, line_id, partial_no, description, qty, qty_unit, weight_kg, volume_m3,
            status, receipt_result, receipt_notes, received_at, created_at, created_by, updated_at, updated_by""";

    private static final String INSERT = """
            INSERT INTO miot_trips.cargo_unit
                (tenant_code, line_id, partial_no, description, qty, qty_unit, weight_kg, volume_m3, status,
                 created_by, updated_by)
            SELECT $1, $2, COALESCE(max(partial_no), 0) + 1, $3, $4, $5, $6, $7, $8, $9, $9
            FROM miot_trips.cargo_unit WHERE line_id = $2 AND version_of IS NULL
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_trips.cargo_unit SET
                description = $3, qty = $4, qty_unit = $5, weight_kg = $6, volume_m3 = $7, status = $8,
                receipt_result = $9, receipt_notes = $10, received_at = $11, updated_by = $12, updated_at = now()
            WHERE id = $1 AND tenant_code = $2
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgCargoStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgCargoStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public CargoUnit insert(CargoUnit c) {
        Tuple params = Tuple.tuple()
                .addString(c.tenantCode()).addUUID(Pg.parse(c.lineId())).addString(c.description())
                .addBigDecimal(c.qty()).addString(c.qtyUnit()).addBigDecimal(c.weightKg())
                .addBigDecimal(c.volumeM3()).addString(c.status()).addString(c.createdBy());
        return cargo(query(pool.get(), INSERT, params).iterator().next());
    }

    @Override
    public Optional<UUID> mandateOf(String tenantCode, UUID cargoId) {
        RowIterator<Row> it = query(pool.get(), """
                SELECT ml.mandate_id FROM miot_trips.cargo_unit cu
                JOIN miot_trips.mandate_line ml ON ml.id = cu.line_id AND ml.version_of IS NULL AND ml.is_active
                WHERE cu.tenant_code = $1 AND cu.id = $2 AND cu.is_active""",
                Tuple.of(tenantCode, cargoId)).iterator();
        return it.hasNext() ? Optional.of(it.next().getUUID("mandate_id")) : Optional.empty();
    }

    @Override
    public Optional<CargoUnit> find(String tenantCode, UUID id) {
        RowSet<Row> rows = query(pool.get(),
                SELECT + COLUMNS + " FROM miot_trips.cargo_unit WHERE tenant_code = $1 AND id = $2" + Pg.lock(),
                Tuple.of(tenantCode, id));
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(cargo(it.next())) : Optional.empty();
    }

    private static final String CU_COLUMNS = """
            cu.id, cu.tenant_code, cu.line_id, cu.partial_no, cu.description, cu.qty, cu.qty_unit,
            cu.weight_kg, cu.volume_m3, cu.status, cu.receipt_result, cu.receipt_notes, cu.received_at,
            cu.created_at, cu.created_by, cu.updated_at, cu.updated_by""";

    @Override
    public List<CargoUnit> listByMandate(String tenantCode, UUID mandateId) {
        return query(pool.get(), SELECT + CU_COLUMNS + """

                 FROM miot_trips.cargo_unit cu
                 JOIN miot_trips.mandate_line ml ON ml.id = cu.line_id
                 WHERE cu.tenant_code = $1 AND ml.mandate_id = $2
                   AND cu.version_of IS NULL AND cu.is_active
                 ORDER BY cu.partial_no""",
                Tuple.of(tenantCode, mandateId))
                .stream().map(PgCargoStore::cargo).toList();
    }

    @Override
    public List<CargoUnit> listByTrip(String tenantCode, UUID tripId) {
        return query(pool.get(), SELECT + CU_COLUMNS + """

                 FROM miot_trips.cargo_unit cu
                 JOIN miot_trips.trip_cargo tc ON tc.cargo_id = cu.id
                 WHERE cu.tenant_code = $1 AND tc.trip_id = $2
                   AND tc.version_of IS NULL AND tc.is_active
                 ORDER BY cu.partial_no""",
                Tuple.of(tenantCode, tripId))
                .stream().map(PgCargoStore::cargo).toList();
    }

    @Override
    public List<UUID> lockTripsCarrying(String tenantCode, UUID cargoId) {
        return query(pool.get(), """
                SELECT t.id FROM miot_trips.trip t
                JOIN miot_trips.trip_cargo tc ON tc.trip_id = t.id AND tc.tenant_code = t.tenant_code
                WHERE tc.tenant_code = $1 AND tc.cargo_id = $2 AND tc.version_of IS NULL AND tc.is_active
                  AND t.version_of IS NULL
                ORDER BY t.id
                FOR UPDATE OF t""", Tuple.of(tenantCode, cargoId))
                .stream().map(r -> r.getUUID("id")).toList();
    }

    @Override
    public Optional<CargoUnit> update(CargoUnit c) {
        Tuple params = Tuple.tuple()
                .addUUID(Pg.parse(c.id())).addString(c.tenantCode())
                .addString(c.description()).addBigDecimal(c.qty()).addString(c.qtyUnit())
                .addBigDecimal(c.weightKg()).addBigDecimal(c.volumeM3()).addString(c.status())
                .addString(c.receiptResult()).addString(c.receiptNotes()).addOffsetDateTime(c.receivedAt())
                .addString(c.updatedBy());
        RowSet<Row> rows = query(pool.get(), UPDATE, params);
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(cargo(it.next())) : Optional.empty();
    }

    private static CargoUnit cargo(Row r) {
        return new CargoUnit(
                text(r.getUUID("id")), r.getString("tenant_code"), text(r.getUUID("line_id")),
                r.getInteger("partial_no"), r.getString("description"),
                r.getBigDecimal("qty"), r.getString("qty_unit"),
                r.getBigDecimal("weight_kg"), r.getBigDecimal("volume_m3"),
                r.getString("status"), r.getString("receipt_result"), r.getString("receipt_notes"),
                time(r, "received_at"),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}
