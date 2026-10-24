package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.microboxlabs.miot.trips.domain.TripLiveProjection;
import com.microboxlabs.miot.trips.domain.TripLiveRow;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowIterator;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.Arrays;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link TripLiveStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgTripLiveStore implements TripLiveStore {

    private static final String COLUMNS = """
            trip_id, tenant_code, mandate_codes::text AS mandate_codes, asset_id, trip_type,
            origin_geofence_id, destination_geofence_id, origin_geofence_label, destination_geofence_label,
            stop_geofence_ids, status, driver_id, driver_name, driver_contact_phone, double_driver,
            second_driver_id, second_driver_name, second_driver_contact_phone,
            carrier_id, carrier_name, carrier_contact_phone, rampla_plate,
            start_time, end_time, estimated_arrival_time, type_load,
            current_geofence_id, origin_visited, destination_visited, origin_is_internal, forward_id,
            created_at, updated_at""";

    private final Supplier<Pool> pool;

    @Inject
    PgTripLiveStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTripLiveStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<TripLiveRow> list(String tenantCode) {
        return query(pool.get(),
                "SELECT " + COLUMNS + " FROM miot_trips.trip_live WHERE tenant_code = $1 ORDER BY updated_at DESC",
                Tuple.of(tenantCode))
                .stream().map(PgTripLiveStore::row).toList();
    }

    @Override
    public Optional<TripLiveRow> find(String tenantCode, UUID tripId) {
        RowSet<Row> rows = query(pool.get(),
                "SELECT " + COLUMNS + " FROM miot_trips.trip_live WHERE tenant_code = $1 AND trip_id = $2",
                Tuple.of(tenantCode, tripId));
        RowIterator<Row> it = rows.iterator();
        return it.hasNext() ? Optional.of(row(it.next())) : Optional.empty();
    }

    @Override
    public void upsert(TripLiveProjection p) {
        query(pool.get(), """
                INSERT INTO miot_trips.trip_live (
                    trip_id, tenant_code, mandate_codes, asset_id, trip_type,
                    origin_geofence_label, destination_geofence_label,
                    status, driver_id, driver_name, driver_contact_phone,
                    double_driver, second_driver_id, second_driver_name, second_driver_contact_phone,
                    carrier_id, carrier_name, carrier_contact_phone, rampla_plate,
                    start_time, end_time, estimated_arrival_time, type_load)
                VALUES ($1, $2, $3::jsonb, $4, 'v', $5, $6, $7, $8, $9, $10, $11::text IS NOT NULL, $11, $12, $13,
                    $14, $15, $16, $17, $18, $19, $20, $21)
                ON CONFLICT (trip_id) DO UPDATE SET
                    mandate_codes = EXCLUDED.mandate_codes,
                    asset_id = EXCLUDED.asset_id,
                    origin_geofence_label = EXCLUDED.origin_geofence_label,
                    destination_geofence_label = EXCLUDED.destination_geofence_label,
                    stop_geofence_ids = NULL,
                    status = EXCLUDED.status,
                    driver_id = EXCLUDED.driver_id,
                    driver_name = EXCLUDED.driver_name,
                    driver_contact_phone = EXCLUDED.driver_contact_phone,
                    double_driver = EXCLUDED.double_driver,
                    second_driver_id = EXCLUDED.second_driver_id,
                    second_driver_name = EXCLUDED.second_driver_name,
                    second_driver_contact_phone = EXCLUDED.second_driver_contact_phone,
                    carrier_id = EXCLUDED.carrier_id,
                    carrier_name = EXCLUDED.carrier_name,
                    carrier_contact_phone = EXCLUDED.carrier_contact_phone,
                    rampla_plate = EXCLUDED.rampla_plate,
                    start_time = EXCLUDED.start_time,
                    end_time = EXCLUDED.end_time,
                    estimated_arrival_time = EXCLUDED.estimated_arrival_time,
                    type_load = EXCLUDED.type_load,
                    updated_at = now()""",
                Tuple.tuple().addUUID(UUID.fromString(p.tripId())).addString(p.tenantCode())
                        .addString(p.mandateCodes()).addString(p.assetId())
                        .addString(p.originGeofenceLabel()).addString(p.destinationGeofenceLabel())
                        .addString(p.status()).addString(p.driverId()).addString(p.driverName())
                        .addString(p.driverContactPhone()).addString(p.secondDriverId())
                        .addString(p.secondDriverName()).addString(p.secondDriverContactPhone())
                        .addString(p.carrierId()).addString(p.carrierName()).addString(p.carrierContactPhone())
                        .addString(p.ramplaPlate()).addOffsetDateTime(p.startTime())
                        .addOffsetDateTime(p.endTime()).addOffsetDateTime(p.estimatedArrivalTime())
                        .addString(p.typeLoad()));
    }

    @Override
    public void delete(String tenantCode, UUID tripId) {
        query(pool.get(), "DELETE FROM miot_trips.trip_live WHERE tenant_code = $1 AND trip_id = $2",
                Tuple.of(tenantCode, tripId));
    }

    private static TripLiveRow row(Row r) {
        Integer[] stops = r.getArrayOfIntegers("stop_geofence_ids");
        String[] forwards = r.getArrayOfStrings("forward_id");
        return new TripLiveRow(
                text(r.getUUID("trip_id")), r.getString("tenant_code"), r.getString("mandate_codes"),
                r.getString("asset_id"), r.getString("trip_type"),
                r.getInteger("origin_geofence_id"), r.getInteger("destination_geofence_id"),
                r.getString("origin_geofence_label"), r.getString("destination_geofence_label"),
                stops == null ? null : Arrays.asList(stops),
                r.getString("status"), r.getString("driver_id"), r.getString("driver_name"),
                r.getString("driver_contact_phone"), Boolean.TRUE.equals(r.getBoolean("double_driver")),
                r.getString("second_driver_id"), r.getString("second_driver_name"),
                r.getString("second_driver_contact_phone"),
                r.getString("carrier_id"), r.getString("carrier_name"), r.getString("carrier_contact_phone"),
                r.getString("rampla_plate"),
                time(r, "start_time"), time(r, "end_time"), time(r, "estimated_arrival_time"),
                r.getString("type_load"),
                r.getInteger("current_geofence_id"), Boolean.TRUE.equals(r.getBoolean("origin_visited")),
                Boolean.TRUE.equals(r.getBoolean("destination_visited")), r.getBoolean("origin_is_internal"),
                forwards == null ? null : Arrays.asList(forwards),
                time(r, "created_at"), time(r, "updated_at"));
    }
}
