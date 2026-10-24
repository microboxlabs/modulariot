package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.TripCargoLink;
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

/** {@link TripCargoStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgTripCargoStore implements TripCargoStore {

    private static final String COLUMNS = """
            trip_id, cargo_id, tenant_code, loaded_at_stage, unloaded_at_stage,
            created_at, created_by, updated_at, updated_by""";

    private static final String INSERT = """
            INSERT INTO miot_trips.trip_cargo
                (trip_id, cargo_id, tenant_code, loaded_at_stage, unloaded_at_stage, created_by, updated_by)
            VALUES ($1, $2, $3, $4, $5, $6, $6)
            ON CONFLICT (trip_id, cargo_id) WHERE version_of IS NULL AND is_active DO NOTHING
            RETURNING\s""" + COLUMNS;

    private static final String UPDATE = """
            UPDATE miot_trips.trip_cargo SET
                loaded_at_stage = $4, unloaded_at_stage = $5, updated_by = $6, updated_at = now()
            WHERE tenant_code = $1 AND trip_id = $2 AND cargo_id = $3
              AND version_of IS NULL AND is_active
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgTripCargoStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTripCargoStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<TripCargoLink> insert(TripCargoLink l) {
        Tuple params = Tuple.tuple()
                .addUUID(Pg.parse(l.tripId())).addUUID(Pg.parse(l.cargoId())).addString(l.tenantCode())
                .addUUID(Pg.parse(l.loadedAtStage())).addUUID(Pg.parse(l.unloadedAtStage()))
                .addString(l.createdBy());
        return first(query(pool.get(), INSERT, params));
    }

    @Override
    public Optional<TripCargoLink> find(String tenantCode, UUID tripId, UUID cargoId) {
        return first(query(pool.get(),
                "SELECT " + COLUMNS + """
                 FROM miot_trips.trip_cargo
                WHERE tenant_code = $1 AND trip_id = $2 AND cargo_id = $3
                  AND version_of IS NULL AND is_active""",
                Tuple.of(tenantCode, tripId, cargoId)));
    }

    @Override
    public List<TripCargoLink> listByTrip(String tenantCode, UUID tripId) {
        return query(pool.get(),
                "SELECT " + COLUMNS + """
                 FROM miot_trips.trip_cargo
                WHERE tenant_code = $1 AND trip_id = $2 AND version_of IS NULL AND is_active
                ORDER BY created_at""",
                Tuple.of(tenantCode, tripId))
                .stream().map(PgTripCargoStore::link).toList();
    }

    @Override
    public Optional<TripCargoLink> update(TripCargoLink l) {
        Tuple params = Tuple.tuple()
                .addString(l.tenantCode()).addUUID(Pg.parse(l.tripId())).addUUID(Pg.parse(l.cargoId()))
                .addUUID(Pg.parse(l.loadedAtStage())).addUUID(Pg.parse(l.unloadedAtStage()))
                .addString(l.updatedBy());
        return first(query(pool.get(), UPDATE, params));
    }

    @Override
    public boolean delete(String tenantCode, UUID tripId, UUID cargoId) {
        RowSet<Row> rows = query(pool.get(), """
                UPDATE miot_trips.trip_cargo SET is_active = FALSE, updated_at = now()
                WHERE tenant_code = $1 AND trip_id = $2 AND cargo_id = $3
                  AND version_of IS NULL AND is_active
                RETURNING trip_id""",
                Tuple.of(tenantCode, tripId, cargoId));
        return rows.size() > 0;
    }

    @Override
    public int markLoadedByStage(String tenantCode, UUID stageId, String actor) {
        return query(pool.get(), """
                UPDATE miot_trips.cargo_unit cu SET status = 'picked_up', updated_by = $3, updated_at = now()
                FROM miot_trips.trip_cargo tc
                WHERE tc.cargo_id = cu.id AND tc.tenant_code = $1 AND tc.loaded_at_stage = $2
                  AND tc.version_of IS NULL AND tc.is_active
                  AND cu.status IN ('announced','ready')""",
                Tuple.of(tenantCode, stageId).addString(actor)).rowCount();
    }

    @Override
    public int markDeliveredByStage(String tenantCode, UUID stageId, String actor) {
        return query(pool.get(), """
                UPDATE miot_trips.cargo_unit cu SET status = 'delivered', updated_by = $3, updated_at = now()
                FROM miot_trips.trip_cargo tc
                WHERE tc.cargo_id = cu.id AND tc.tenant_code = $1 AND tc.unloaded_at_stage = $2
                  AND tc.version_of IS NULL AND tc.is_active
                  AND cu.status = 'picked_up'""",
                Tuple.of(tenantCode, stageId).addString(actor)).rowCount();
    }

    private static Optional<TripCargoLink> first(RowSet<Row> rows) {
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(link(it.next())) : Optional.empty();
    }

    private static TripCargoLink link(Row r) {
        return new TripCargoLink(
                text(r.getUUID("trip_id")), text(r.getUUID("cargo_id")), r.getString("tenant_code"),
                text(r.getUUID("loaded_at_stage")), text(r.getUUID("unloaded_at_stage")),
                time(r, "created_at"), r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"));
    }
}
