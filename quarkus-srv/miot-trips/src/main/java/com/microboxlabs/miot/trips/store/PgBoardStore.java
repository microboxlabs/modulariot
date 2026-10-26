package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
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
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
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
            coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                       WHERE m.trip_id = t.id AND m.milestone = 'departure' AND m.status = 'confirmed'),
                     (SELECT min(s.actual_start) FROM miot_trips.stage s
                       WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                         AND s.stage_type IN ('transit', 'stop') AND s.version_of IS NULL AND s.is_active))
                AS departed_at,
            coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                       WHERE m.trip_id = t.id AND m.milestone = 'arrival' AND m.status = 'confirmed'),
                     (SELECT min(s.actual_start) FROM miot_trips.stage s
                       WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                         AND s.stage_type IN ('unloading', 'closing') AND s.version_of IS NULL AND s.is_active))
                AS arrived_at,
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
            WHERE l.tenant_code = $1 AND ($3::uuid IS NULL OR l.trip_id = $3)
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
                  AND ($3::timestamptz IS NULL OR coalesce(t.actual_end, t.updated_at) >= $3)
                  AND ($4::timestamptz IS NULL OR coalesce(t.actual_end, t.updated_at) < $4)
                  AND ($6::uuid IS NULL OR t.id = $6)
            ), rows AS (
            SELECT""" + " " + TRIP_STATE + """
            ,
            t.origin, t.destination,
            coalesce((SELECT s.service_status FROM miot_trips.stage s
              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                AND s.status <> 'pending' AND s.version_of IS NULL AND s.is_active
                AND s.service_status IS NOT NULL
              ORDER BY (s.status = 'in_progress') DESC, s.actual_start DESC NULLS LAST, s.seq DESC LIMIT 1),
              t.status) AS label,
            (SELECT max(s.planned_end) FROM miot_trips.stage s
              WHERE s.tenant_code = t.tenant_code AND s.subject_type = 'trip' AND s.subject_id = t.id
                AND s.version_of IS NULL AND s.is_active) AS planned_arrival,
            (SELECT a.resource_id::text FROM miot_trips.trip_resource_assignment a
              WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'truck'
                AND a.version_of IS NULL AND a.is_active
              ORDER BY (a.valid_to IS NULL) DESC, a.valid_to DESC NULLS LAST, a.valid_from DESC, a.id
              LIMIT 1) AS truck,
            (SELECT a.resource_id::text FROM miot_trips.trip_resource_assignment a
              WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'trailer'
                AND a.version_of IS NULL AND a.is_active
              ORDER BY (a.valid_to IS NULL) DESC, a.valid_to DESC NULLS LAST, a.valid_from DESC, a.id
              LIMIT 1) AS trailer,
            (SELECT a.resource_id::text FROM miot_trips.trip_resource_assignment a
              WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'driver'
                AND a.version_of IS NULL AND a.is_active
              ORDER BY (a.valid_to IS NULL) DESC, a.valid_to DESC NULLS LAST, a.valid_from ASC, a.created_at ASC
              LIMIT 1) AS driver,
            (SELECT a.resource_id::text FROM miot_trips.trip_resource_assignment a
              WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'driver'
                AND a.valid_to IS NULL AND a.version_of IS NULL AND a.is_active
              ORDER BY a.valid_from, a.created_at OFFSET 1 LIMIT 1) AS second_driver,
            NULL::text AS carrier,
            EXISTS (SELECT 1 FROM miot_trips.audit_event e
                     WHERE e.tenant_code = t.tenant_code AND e.entity_type = 'trip' AND e.entity_id = t.id::text
                       AND e.action = 'trip.created' AND e.details->>'regularized' = 'true') AS regularized,
            t.updated_at
            FROM done t
            ), matched AS (
                SELECT rows.*,
                       CASE WHEN status = 'cancelled' THEN 'cancelled'
                            WHEN regularized THEN 'regularized' ELSE 'completed' END AS board_lane
                FROM rows
                WHERE $2::text IS NULL OR concat_ws(' ', array_to_string(codes, ' '), origin, destination)
                      ILIKE '%' || $2 || '%'
                   OR EXISTS (SELECT 1 FROM miot_fleet.truck v
                              LEFT JOIN miot_fleet.carrier c ON c.id = v.carrier_id
                                    AND c.tenant_code = v.tenant_code AND c.version_of IS NULL
                              WHERE v.id = rows.truck::uuid AND v.tenant_code = $1 AND v.version_of IS NULL
                                AND (v.license_plate ILIKE '%' || $2 || '%'
                                     OR c.legal_name ILIKE '%' || $2 || '%'))
                   OR EXISTS (SELECT 1 FROM miot_fleet.trailer v
                              WHERE v.id = rows.trailer::uuid AND v.tenant_code = $1 AND v.version_of IS NULL
                                AND v.license_plate ILIKE '%' || $2 || '%')
                   OR EXISTS (SELECT 1 FROM miot_fleet.driver d
                              WHERE d.id = rows.driver::uuid AND d.tenant_code = $1 AND d.version_of IS NULL
                                AND d.full_name ILIKE '%' || $2 || '%')
                   OR EXISTS (SELECT 1 FROM miot_fleet.driver d
                              WHERE d.id = rows.second_driver::uuid AND d.tenant_code = $1
                                AND d.version_of IS NULL AND d.full_name ILIKE '%' || $2 || '%')
            ), ranked AS (
                SELECT matched.*,
                       count(*) OVER (PARTITION BY board_lane) AS lane_count,
                       row_number() OVER (PARTITION BY board_lane
                                          ORDER BY coalesce(actual_end, updated_at) DESC NULLS LAST, trip_id)
                           AS lane_rank
                FROM matched
            )
            SELECT * FROM ranked WHERE lane_rank <= $5 ORDER BY board_lane, lane_rank""";

    private static final ObjectMapper JSON = new ObjectMapper();

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
        return open(tenantCode, q, null);
    }

    @Override
    public FinishedPage finished(String tenantCode, String q, OffsetDateTime from, OffsetDateTime to, int perLane) {
        return finished(tenantCode, q, from, to, perLane, null);
    }

    @Override
    public Optional<BoardRow> trip(String tenantCode, UUID tripId) {
        return open(tenantCode, null, tripId).stream().findFirst()
                .or(() -> finished(tenantCode, null, null, null, 1, tripId).rows().stream().findFirst());
    }

    @Override
    public Optional<FeedSource> feedSource(String tenantCode, UUID tripId) {
        return query(pool.get(), """
                SELECT feed_key, external_code, desired::text AS desired, last_action,
                       last_result::text AS last_result,
                       last_reconciled_at
                FROM miot_trips.feed_service WHERE tenant_code = $1 AND trip_id = $2
                ORDER BY last_reconciled_at DESC NULLS LAST LIMIT 1""", Tuple.of(tenantCode, tripId))
                .stream().findFirst().map(r -> new FeedSource(r.getString("feed_key"), r.getString("external_code"),
                        source(r.getString("desired")), r.getString("last_action"), r.getString("last_result"),
                        time(r, "last_reconciled_at")));
    }

    /** The row the source sent, as the feed kept it in the desired state. */
    private static Map<String, Object> source(String desired) {
        if (desired == null) {
            return Map.of();
        }
        try {
            JsonNode node = JSON.readTree(desired);
            if (node.isTextual()) {
                node = JSON.readTree(node.asText());
            }
            JsonNode src = node.path("source");
            return src.isObject() ? JSON.convertValue(src, new TypeReference<Map<String, Object>>() {
            }) : Map.of();
        } catch (JsonProcessingException e) {
            return Map.of();
        }
    }

    private List<BoardRow> open(String tenantCode, String q, UUID tripId) {
        return query(pool.get(), OPEN, Tuple.of(tenantCode, q, tripId)).stream().map(PgBoardStore::row).toList();
    }

    private FinishedPage finished(String tenantCode, String q, OffsetDateTime from, OffsetDateTime to, int perLane,
            UUID tripId) {
        Map<String, Integer> counts = new HashMap<>();
        List<BoardRow> rows = query(pool.get(), FINISHED, Tuple.tuple().addString(tenantCode).addString(q)
                .addOffsetDateTime(from).addOffsetDateTime(to).addInteger(perLane).addUUID(tripId))
                .stream().map(r -> {
                    counts.put(r.getString("board_lane"), Math.toIntExact(r.getLong("lane_count")));
                    return row(r);
                }).toList();
        return new FinishedPage(rows, counts);
    }

    private static BoardRow row(Row r) {
        Map<String, String> milestones = Pg.json(r, "milestones", new TypeReference<Map<String, String>>() {
        });
        String[] alerts = r.getArrayOfStrings("alerts");
        String[] codes = r.getArrayOfStrings("codes");
        return new BoardRow(text(r.getUUID("trip_id")), r.getString("status"), time(r, "planned_start"),
                time(r, "planned_arrival"), time(r, "departed_at"), time(r, "arrived_at"), time(r, "actual_end"),
                r.getString("current_stage"), r.getString("last_stage"), milestones,
                alerts == null ? null : new HashSet<>(Arrays.asList(alerts)),
                codes == null ? null : Arrays.asList(codes), r.getString("label"), r.getString("origin"),
                r.getString("destination"), r.getString("truck"), r.getString("trailer"), r.getString("driver"),
                r.getString("second_driver"), r.getString("carrier"), r.getString("monitor_key"),
                Boolean.TRUE.equals(r.getBoolean("regularized")), r.getString("cancel_reason"),
                time(r, "updated_at"));
    }
}
