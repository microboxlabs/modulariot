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

    /** The delivery lane state is shared by card and badge projections. */
    private static final String DELIVERY_STATE = """
            CASE WHEN EXISTS (SELECT 1 FROM miot_trips.trip_mandate tm
                               WHERE tm.trip_id = t.id AND tm.version_of IS NULL AND tm.is_active)
              THEN ARRAY(SELECT coalesce((SELECT max(array_position(ARRAY['delivered', 'accepted', 'settled'],
                                                                    ds.step::text))
                                            FROM miot_trips.delivery_mandate dm
                                            JOIN miot_trips.delivery_step ds
                                              ON ds.delivery_id = dm.delivery_id AND ds.status = 'confirmed'
                                           WHERE dm.trip_id = t.id AND dm.mandate_id = tm.mandate_id), 0)
                           FROM miot_trips.trip_mandate tm
                          WHERE tm.trip_id = t.id AND tm.version_of IS NULL AND tm.is_active)
              ELSE ARRAY(SELECT coalesce((SELECT max(array_position(ARRAY['delivered', 'accepted', 'settled'],
                                                                    ds.step::text))
                                            FROM miot_trips.delivery_step ds
                                           WHERE ds.delivery_id = dl.id AND ds.status = 'confirmed'), 0)
                           FROM miot_trips.delivery dl WHERE dl.trip_id = t.id)
            END AS delivery_levels,
            EXISTS (SELECT 1 FROM miot_trips.delivery dl WHERE dl.trip_id = t.id) AS has_delivery,
            EXISTS (SELECT 1 FROM miot_trips.delivery dl
                      JOIN miot_trips.delivery_step ds ON ds.delivery_id = dl.id AND ds.status = 'pending'
                     WHERE dl.trip_id = t.id) AS delivery_pending""";

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
                   ORDER BY tm.seq) AS codes,
            """ + DELIVERY_STATE;

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

    /** The badge poll reads lane inputs only, without the card's resources, codes and timestamps. */
    private static final String COUNT_OPEN = """
            SELECT t.status, t.planned_start, l.estimated_arrival_time AS planned_arrival,
                   l.asset_id AS truck, l.driver_name AS driver,
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
                   ARRAY(SELECT DISTINCT a->>'value' FROM miot_trips.trip_transition x,
                         jsonb_array_elements(x.actions) a
                         WHERE x.trip_id = t.id AND a->>'type' = 'alert'
                           AND a->>'value' IN ('presentation_overdue', 'departure_overdue',
                                              'arrival_overdue', 'closure_overdue')) AS alerts,
            """ + DELIVERY_STATE + "\n" + """
            FROM miot_trips.trip_live l
            JOIN miot_trips.trip t ON t.id = l.trip_id AND t.tenant_code = l.tenant_code
            WHERE l.tenant_code = $1""";

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

    private static final String DETAILS = """
            SELECT
              (SELECT jsonb_agg(jsonb_build_object('code', m.external_code, 'orderType', m.order_type,
                                                   'orderRef', m.order_ref) ORDER BY tm.seq)::text
                 FROM miot_trips.trip_mandate tm
                 JOIN miot_trips.mandate m ON m.id = tm.mandate_id AND m.version_of IS NULL
                WHERE tm.trip_id = t.id AND tm.version_of IS NULL AND tm.is_active) AS orders,
              (SELECT jsonb_agg(jsonb_build_object('name', x.full_name, 'rut', x.rut, 'phone', x.phone,
                                'validations', (
                       SELECT coalesce(jsonb_agg(jsonb_build_object('type', ra.attribute_type,
                                  'key', ra.attribute_key, 'value', ra.attribute_value,
                                  'source', ra.source_system,
                                  'validUntil', to_char(ra.valid_until AT TIME ZONE 'UTC',
                                                        'YYYY-MM-DD"T"HH24:MI:SS"Z"'))
                                  ORDER BY ra.attribute_type, ra.attribute_key), '[]'::jsonb)
                         FROM miot_fleet.resource_attribute ra
                        WHERE ra.tenant_code = t.tenant_code AND ra.resource_type = 'driver'
                          AND ra.resource_id = x.id AND ra.version_of IS NULL AND ra.is_active
                          AND (ra.valid_from IS NULL OR ra.valid_from <= now())
                          AND (ra.valid_until IS NULL OR ra.valid_until >= now())))
                                ORDER BY x.n)::text
                 FROM (SELECT dr.id, dr.full_name, dr.rut, coalesce(dr.mobile_phone, dr.phone) AS phone,
                              row_number() OVER (ORDER BY (a.valid_to IS NULL) DESC, a.valid_from,
                                                          a.created_at) AS n
                         FROM miot_trips.trip_resource_assignment a
                         JOIN miot_fleet.driver dr
                           ON dr.id = a.resource_id AND dr.tenant_code = a.tenant_code AND dr.version_of IS NULL
                        WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'driver'
                          AND a.version_of IS NULL AND a.is_active) x
                WHERE x.n <= 2) AS drivers,
              o.type AS origin_type, d.type AS destination_type,
              c.legal_name AS carrier_name, c.rut AS carrier_rut, c.external_id AS carrier_code,
              ld.units AS load_units, ld.weight AS load_weight, ld.volume AS load_volume,
              coalesce(tr.max_weight, v.max_weight) AS weight_capacity, v.volume AS volume_capacity,
              lt.on_time, lt.late, lt.lead_open, lt.without_sla
            FROM miot_trips.trip t
            LEFT JOIN miot_trips.location o
                   ON o.id = t.origin_id AND o.tenant_code = t.tenant_code AND o.version_of IS NULL
            LEFT JOIN miot_trips.location d
                   ON d.id = t.destination_id AND d.tenant_code = t.tenant_code AND d.version_of IS NULL
            LEFT JOIN LATERAL (
                SELECT a.resource_id FROM miot_trips.trip_resource_assignment a
                 WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'truck'
                   AND a.version_of IS NULL AND a.is_active
                 ORDER BY (a.valid_to IS NULL) DESC, a.valid_to DESC NULLS LAST, a.valid_from DESC, a.id
                 LIMIT 1) ta ON true
            LEFT JOIN miot_fleet.truck v
                   ON v.id = ta.resource_id AND v.tenant_code = t.tenant_code AND v.version_of IS NULL
            LEFT JOIN miot_fleet.carrier c
                   ON c.id = v.carrier_id AND c.tenant_code = v.tenant_code AND c.version_of IS NULL
            LEFT JOIN LATERAL (
                SELECT a.resource_id FROM miot_trips.trip_resource_assignment a
                 WHERE a.tenant_code = t.tenant_code AND a.trip_id = t.id AND a.resource_type = 'trailer'
                   AND a.version_of IS NULL AND a.is_active
                 ORDER BY (a.valid_to IS NULL) DESC, a.valid_to DESC NULLS LAST, a.valid_from DESC, a.id
                 LIMIT 1) tra ON true
            LEFT JOIN miot_fleet.trailer tr
                   ON tr.id = tra.resource_id AND tr.tenant_code = t.tenant_code AND tr.version_of IS NULL
            CROSS JOIN LATERAL (
                SELECT count(*)::int AS units, sum(cu.weight_kg) AS weight, sum(cu.volume_m3) AS volume
                  FROM miot_trips.trip_cargo tc
                  JOIN miot_trips.cargo_unit cu
                    ON cu.id = tc.cargo_id AND cu.version_of IS NULL AND cu.is_active
                 WHERE tc.trip_id = t.id AND tc.version_of IS NULL AND tc.is_active) ld
            CROSS JOIN LATERAL (
                SELECT count(*) FILTER (WHERE x.delivered_at <= x.due)::int AS on_time,
                       count(*) FILTER (WHERE x.delivered_at > x.due)::int AS late,
                       count(*) FILTER (WHERE x.due IS NOT NULL AND x.delivered_at IS NULL)::int AS lead_open,
                       count(*) FILTER (WHERE x.due IS NULL)::int AS without_sla
                  FROM (SELECT coalesce((SELECT ms.confirmed_at FROM miot_trips.trip_milestone ms
                                          WHERE ms.trip_id = t.id AND ms.milestone = 'departure'
                                            AND ms.status = 'confirmed'),
                                        t.actual_start, t.planned_start)
                               + make_interval(mins => m.sla_minutes) AS due,
                               (SELECT min(ds.confirmed_at) FROM miot_trips.delivery_mandate dm
                                  JOIN miot_trips.delivery_step ds
                                    ON ds.delivery_id = dm.delivery_id AND ds.step = 'delivered'
                                   AND ds.status = 'confirmed'
                                 WHERE dm.trip_id = t.id AND dm.mandate_id = m.id) AS delivered_at
                          FROM miot_trips.trip_mandate tm
                          JOIN miot_trips.mandate m ON m.id = tm.mandate_id AND m.version_of IS NULL
                         WHERE tm.trip_id = t.id AND tm.version_of IS NULL AND tm.is_active) x) lt
            WHERE t.tenant_code = $1 AND t.id = $2 AND t.version_of IS NULL""";

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
    public List<BoardRow> openForCounts(String tenantCode) {
        return query(pool.get(), COUNT_OPEN, Tuple.of(tenantCode)).stream().map(PgBoardStore::countRow).toList();
    }

    @Override
    public FinishedPage finished(String tenantCode, String q, OffsetDateTime from, OffsetDateTime to, int perLane) {
        return finished(tenantCode, q, from, to, perLane, null);
    }

    @Override
    public int finishedCount(String tenantCode, OffsetDateTime from, OffsetDateTime to) {
        return query(pool.get(), """
                SELECT count(*)::int AS n FROM miot_trips.trip t
                WHERE t.tenant_code = $1 AND t.version_of IS NULL AND t.is_active
                  AND t.status IN ('completed', 'cancelled')
                  AND coalesce(t.actual_end, t.updated_at) >= $2 AND coalesce(t.actual_end, t.updated_at) < $3""",
                Tuple.of(tenantCode, from, to)).iterator().next().getInteger("n");
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

    @Override
    public Optional<TripDetails> details(String tenantCode, UUID tripId) {
        return query(pool.get(), DETAILS, Tuple.of(tenantCode, tripId)).stream().findFirst()
                .map(r -> new TripDetails(list(r.getString("orders"), new TypeReference<List<Order>>() {
                }), list(r.getString("drivers"), new TypeReference<List<Driver>>() {
                }),
                        r.getString("carrier_name") == null ? null
                                : new Carrier(r.getString("carrier_name"), r.getString("carrier_rut"),
                                        r.getString("carrier_code")),
                        r.getString("origin_type"), r.getString("destination_type"),
                        new Load(r.getInteger("load_units"), r.getBigDecimal("load_weight"),
                                r.getBigDecimal("load_volume"), r.getBigDecimal("weight_capacity"),
                                r.getBigDecimal("volume_capacity")),
                        new LeadTime(r.getInteger("on_time"), r.getInteger("late"), r.getInteger("lead_open"),
                                r.getInteger("without_sla"))));
    }

    private static <T> List<T> list(String json, TypeReference<List<T>> type) {
        try {
            return json == null ? List.of() : JSON.readValue(json, type);
        } catch (JsonProcessingException e) {
            return List.of();
        }
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
                time(r, "updated_at"), deliveries(r));
    }

    private static BoardRow.Deliveries deliveries(Row r) {
        Integer[] levels = r.getArrayOfIntegers("delivery_levels");
        return new BoardRow.Deliveries(levels == null ? List.of() : Arrays.asList(levels),
                Boolean.TRUE.equals(r.getBoolean("has_delivery")),
                Boolean.TRUE.equals(r.getBoolean("delivery_pending")));
    }

    private static BoardRow countRow(Row r) {
        Map<String, String> milestones = Pg.json(r, "milestones", new TypeReference<Map<String, String>>() {
        });
        String[] alerts = r.getArrayOfStrings("alerts");
        return new BoardRow(null, r.getString("status"), time(r, "planned_start"), time(r, "planned_arrival"),
                null, null, null, r.getString("current_stage"), r.getString("last_stage"), milestones,
                alerts == null ? null : new HashSet<>(Arrays.asList(alerts)), null, null, null, null,
                r.getString("truck"), null, r.getString("driver"), null, null, null, false, null, null, deliveries(r));
    }
}
