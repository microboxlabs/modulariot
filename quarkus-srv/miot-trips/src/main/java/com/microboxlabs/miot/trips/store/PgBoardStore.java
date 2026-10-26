package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.trips.domain.BoardRow;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.Arrays;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/** {@link BoardStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgBoardStore implements BoardStore {

    private static final String TRIP_STATE = """
            t.id AS trip_id, t.status, t.planned_start, t.actual_start, t.actual_end, t.cancel_reason,
            (SELECT s.stage_type FROM miot_trips.stage s
              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                AND s.status = 'in_progress' AND s.version_of IS NULL AND s.is_active
              LIMIT 1) AS current_stage,
            (SELECT s.stage_type FROM miot_trips.stage s
              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                AND s.status = 'completed' AND s.version_of IS NULL AND s.is_active
              ORDER BY s.seq DESC LIMIT 1) AS last_stage,
            (SELECT jsonb_object_agg(m.milestone, m.status)::text FROM miot_trips.trip_milestone m
              WHERE m.trip_id = t.id) AS milestones,
            ARRAY(SELECT DISTINCT a->>'value' FROM miot_trips.trip_transition x, jsonb_array_elements(x.actions) a
                   WHERE x.trip_id = t.id AND a->>'type' = 'alert') AS alerts,
            (SELECT ms.monitor_key FROM miot_trips.trip_monitor_state ms WHERE ms.trip_id = t.id) AS monitor_key,
            ARRAY(SELECT m.external_code FROM miot_trips.trip_mandate tm
                    JOIN miot_trips.mandate m ON m.id = tm.mandate_id AND m.version_of IS NULL
                   WHERE tm.trip_id = t.id AND tm.version_of IS NULL AND tm.is_active
                   ORDER BY tm.seq) AS codes""";

    private static final String OPEN = "SELECT " + TRIP_STATE + """
            ,
            l.status AS label, l.origin_geofence_label AS origin, l.destination_geofence_label AS destination,
            l.asset_id AS truck, l.rampla_plate AS trailer, l.driver_name AS driver,
            l.second_driver_name AS second_driver, l.carrier_name AS carrier,
            l.estimated_arrival_time AS planned_arrival, false AS regularized, l.updated_at
            FROM miot_trips.trip_live l
            JOIN miot_trips.trip t ON t.id = l.trip_id AND t.tenant_code = l.tenant_code
            WHERE l.tenant_code = $1
              AND ($2::text IS NULL OR concat_ws(' ', l.mandate_codes::text, l.asset_id, l.rampla_plate,
                    l.driver_name, l.second_driver_name, l.carrier_name, l.origin_geofence_label,
                    l.destination_geofence_label) ILIKE '%' || $2 || '%')""";

    private static final String FINISHED = """
            WITH done AS (
                SELECT t.*, o.name AS origin, d.name AS destination
                FROM miot_trips.trip t
                LEFT JOIN miot_trips.location o
                       ON o.id = t.origin_id AND o.tenant_code = t.tenant_code AND o.version_of IS NULL
                LEFT JOIN miot_trips.location d
                       ON d.id = t.destination_id AND d.tenant_code = t.tenant_code AND d.version_of IS NULL
                WHERE t.tenant_code = $1 AND t.version_of IS NULL AND t.is_active
                  AND t.status IN ('completed', 'cancelled')
                  AND coalesce(t.actual_end, t.updated_at) >= $3 AND coalesce(t.actual_end, t.updated_at) < $4
            ), rows AS (
            SELECT""" + " " + TRIP_STATE + """
            ,
            t.origin, t.destination,
            (SELECT s.service_status FROM miot_trips.stage s
              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                AND s.status = 'completed' AND s.version_of IS NULL AND s.is_active AND s.service_status IS NOT NULL
              ORDER BY s.seq DESC LIMIT 1) AS label,
            (SELECT max(s.planned_end) FROM miot_trips.stage s
              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                AND s.version_of IS NULL AND s.is_active) AS planned_arrival,
            (SELECT a.resource_id::text FROM miot_trips.trip_resource_assignment a
              WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'truck'
                AND a.version_of IS NULL AND a.is_active ORDER BY a.valid_from DESC LIMIT 1) AS truck,
            NULL::text AS trailer,
            (SELECT a.resource_id::text FROM miot_trips.trip_resource_assignment a
              WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'driver'
                AND a.version_of IS NULL AND a.is_active ORDER BY a.valid_from LIMIT 1) AS driver,
            NULL::text AS second_driver, NULL::text AS carrier,
            EXISTS (SELECT 1 FROM miot_trips.audit_event e
                     WHERE e.tenant_code = t.tenant_code AND e.entity_type = 'trip' AND e.entity_id = t.id::text
                       AND e.action = 'trip.created' AND e.details->>'regularized' = 'true') AS regularized,
            t.updated_at
            FROM done t
            )
            SELECT * FROM rows
            WHERE $2::text IS NULL OR concat_ws(' ', array_to_string(codes, ' '), origin, destination)
                  ILIKE '%' || $2 || '%'
            ORDER BY coalesce(actual_end, updated_at) DESC
            LIMIT $5""";

    private final Supplier<Pool> pool;

    @Inject
    PgBoardStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgBoardStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<BoardRow> open(String tenantCode, String q) {
        return query(pool.get(), OPEN, Tuple.of(tenantCode, q)).stream().map(PgBoardStore::row).toList();
    }

    @Override
    public List<BoardRow> finished(String tenantCode, String q, OffsetDateTime from, OffsetDateTime to, int limit) {
        return query(pool.get(), FINISHED, Tuple.tuple().addString(tenantCode).addString(q)
                .addOffsetDateTime(from).addOffsetDateTime(to).addInteger(limit))
                .stream().map(PgBoardStore::row).toList();
    }

    private static BoardRow row(Row r) {
        Map<String, String> milestones = Pg.json(r, "milestones", new TypeReference<Map<String, String>>() {
        });
        String[] alerts = r.getArrayOfStrings("alerts");
        String[] codes = r.getArrayOfStrings("codes");
        return new BoardRow(text(r.getUUID("trip_id")), r.getString("status"), time(r, "planned_start"),
                time(r, "planned_arrival"), time(r, "actual_start"), time(r, "actual_end"),
                r.getString("current_stage"), r.getString("last_stage"), milestones,
                alerts == null ? null : new HashSet<>(Arrays.asList(alerts)),
                codes == null ? null : Arrays.asList(codes), r.getString("label"), r.getString("origin"),
                r.getString("destination"), r.getString("truck"), r.getString("trailer"), r.getString("driver"),
                r.getString("second_driver"), r.getString("carrier"), r.getString("monitor_key"),
                Boolean.TRUE.equals(r.getBoolean("regularized")), r.getString("cancel_reason"),
                time(r, "updated_at"));
    }
}
