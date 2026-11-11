package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseFilter;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.evaluator.OperatorClose;
import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/**
 * The evaluator's cases, from {@code miot_symptoms.signal_transitions}: an ACTIVE OPENED row is a case, open
 * until a CLOSED row for the same symptom and vehicle written after it (by id: signal and close times come
 * from different clocks).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgEngineCases implements EngineCaseStore {

    private static final Logger LOG = Logger.getLogger(PgEngineCases.class);
    private static final ObjectMapper JSON = new ObjectMapper().enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);
    private static final String FROM_SUBQUERY = " FROM (";
    private static final String ASSET_ID = "asset_id";
    private static final String TRIP_ID = "trip_id";
    private static final String LEVEL = "level";
    private static final String DEFINITION_ID = "definition_id";
    private static final String MEASURE = "measure";
    private static final String SPEED_KMH = "speed_kmh";
    private static final String UNDER_TREATMENT = "under_treatment";
    private static final String UNDEFINED_TABLE = "42P01";

    private static final String CASES = """
            SELECT o.id, o.tenant_code, o.definition_id, o.version, o.state, o.asset_id, o.at, o.level, o.trip_id,
                   o.latitude, o.longitude, o.speed_kmh, o.operator_required, d.name, d.family,
                   closed.id AS closed_id, closed.at AS closed_at,
                   (SELECT count(*) FROM miot_symptoms.treatment t
                     WHERE t.tenant_code = o.tenant_code AND t.symptom_id = -o.id AND t.status = 'OPEN') AS treatments,
                   CASE WHEN o.trip_id IS NOT NULL THEN
                     (SELECT count(*) FROM miot_symptoms.signal_transitions r
                       WHERE r.tenant_code = o.tenant_code AND r.definition_id = o.definition_id
                         AND r.trip_id = o.trip_id AND r.state = o.state AND r.kind = 'OPENED' AND r.id < o.id)
                   END AS recurrence,
                   hold.hold_id, hold.hold_at, hold.hold_until, hold.hold_trip_end, hold.hold_scope, hold.hold_by,
                   ret.returned_at
              FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.symptom_definition d ON d.id = o.definition_id AND d.tenant_code = o.tenant_code
              LEFT JOIN LATERAL (SELECT c.id, c.at FROM miot_symptoms.signal_transitions c
                     WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                       AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id
                     ORDER BY c.id LIMIT 1) closed ON true
              LEFT JOIN LATERAL (%s) hold ON true
              LEFT JOIN LATERAL (%s) ret ON true
             WHERE o.tenant_code = $1 AND o.kind = 'OPENED' AND o.state = 'ACTIVE'
            """.formatted(HoldSql.active("o"), HoldSql.returned("o", "closed.at"));

    /**
     * {@link #CASES} of both states: what the case page, its treatments, hold, resume and close read by id. A TEST
     * case is in no list or count, but an operator can still treat and close it.
     */
    private static final String TREATABLE_CASES = CASES.replace("o.state = 'ACTIVE'", "o.state IN ('ACTIVE', 'TEST')");

    /**
     * The case's level is its latest level change before it closed, else the opening one; {@code level_at} is when
     * it reached that level, {@code level_operator} what that row decided about operators (null on older rows).
     * A recorded decision uses that transition's version; older rows retain their opening-version fallback.
     */
    private static final String SELECT = """
            SELECT x.*,
                   COALESCE(lv.level, x.level) AS current_level, COALESCE(lv.at, x.at) AS level_at,
                   CASE WHEN lv.level IS NULL THEN x.operator_required ELSE lv.operator_required END AS level_operator,
                   CASE WHEN lv.operator_required IS NULL THEN x.version ELSE lv.version END AS level_version
              FROM (%s) x
              LEFT JOIN LATERAL (SELECT l.level, l.at, l.version, l.operator_required FROM miot_symptoms.signal_transitions l
                     WHERE l.tenant_code = x.tenant_code AND l.definition_id = x.definition_id
                       AND l.asset_id = x.asset_id AND l.state = x.state AND l.kind = 'LEVEL_CHANGED' AND l.id > x.id
                       AND (x.closed_id IS NULL OR l.id < x.closed_id)
                     ORDER BY l.id DESC LIMIT 1) lv ON true
            """;

    /**
     * The SLA from the version that decided the operator requirement at this level; none without an operator.
     * Older rows retain their opening-version fallback. A spec may be a JSON string holding the document.
     */
    private static final String WITH_SLA = """
            SELECT y.*, CASE WHEN y.level_operator IS FALSE THEN NULL ELSE (SELECT jsonb_path_query_first(
                           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END,
                           'lax $.levels[*] ? (@.icu == $l && @.applies == true && @.response.operator == true)'
                             '.response.slaMinutes ? (@ > 0)',
                           jsonb_build_object('l', y.current_level))::numeric::int
                      FROM miot_symptoms.symptom_version v
                     WHERE v.definition_id = y.definition_id AND v.tenant_code = y.tenant_code
                       AND v.version = y.level_version AND v.status = 'PUBLISHED') END AS sla_minutes,
                   %s AS needs_operator
              FROM (%s) y
            """.formatted(needsOperator("y"), "%s");

    /**
     * Whether the case's current level asks for an operator: what the row that set the level decided
     * ({@code level_operator}); for an older row, {@code response.operator} for that level in the published version
     * the case runs on. False without that version or level, or without a response.
     */
    private static String needsOperator(String alias) {
        return """
                COALESCE(%1$s.level_operator, (SELECT jsonb_path_exists(
                           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END,
                           'lax $.levels[*] ? (@.icu == $l && @.response.operator == true)',
                           jsonb_build_object('l', %1$s.current_level))
                      FROM miot_symptoms.symptom_version v
                     WHERE v.definition_id = %1$s.definition_id AND v.tenant_code = %1$s.tenant_code
                       AND v.version = %1$s.level_version AND v.status = 'PUBLISHED'), false)""".formatted(alias);
    }

    private static final String OPEN = WITH_SLA.formatted(SELECT.formatted(CASES)
            + " WHERE x.closed_id IS NULL ORDER BY x.at DESC LIMIT 200") + " ORDER BY y.at DESC";
    private static final String OPEN_FOR_ASSET = WITH_SLA.formatted(SELECT.formatted(CASES
            + " AND o.asset_id = $2") + " WHERE x.closed_id IS NULL");
    /**
     * With $10 (the inbox), by criticality: highest level first, then the SLA that runs out soonest (overdue
     * first, a level without SLA last), then the oldest arrival at the level, then the case id. As
     * {@code EngineCaseService.INBOX_ORDER}, so the 200 kept are the most critical.
     */
    private static final String INBOX_ORDER = """
            CASE WHEN $10::boolean THEN z.current_level END DESC NULLS LAST,
            CASE WHEN $10::boolean AND z.sla_minutes > 0 THEN GREATEST(z.level_at, COALESCE(z.returned_at, z.level_at))
                 + make_interval(mins => z.sla_minutes) END ASC NULLS LAST,
            CASE WHEN $10::boolean THEN z.level_at END ASC,
            CASE WHEN $10::boolean THEN z.id END ASC""";
    /**
     * {@link CaseFilter}: $2 trip, $3 vehicle id, $4 symptom name, $5 from, $6 to, $7 level, $8 treated only, $9
     * ignored only, $10 operator only. Without dates and $9, the open cases no hold covers.
     */
    private static final String MATCHING_ROWS = "SELECT * FROM (" + WITH_SLA.formatted(SELECT.formatted(CASES + """
               AND ($2::text IS NULL OR o.trip_id = $2)
               AND ($3::text IS NULL OR o.asset_id ILIKE '%' || $3 || '%')
               AND ($4::text IS NULL OR lower(d.name) = lower($4))
               AND ($6::timestamptz IS NULL OR o.at < $6)
            """) + " WHERE ($5::timestamptz IS NOT NULL OR $6::timestamptz IS NOT NULL OR x.closed_id IS NULL)")
            + ") z WHERE ($7::int IS NULL OR z.current_level = $7)"
            + " AND ($5::timestamptz IS NULL OR z.closed_at IS NULL OR z.closed_at >= $5)"
            + " AND (NOT $8::boolean OR z.treatments > 0)"
            + " AND (NOT $10::boolean OR z.needs_operator)"
            + " AND CASE WHEN $9::boolean THEN z.hold_id IS NOT NULL AND z.closed_id IS NULL"
            + " WHEN $5::timestamptz IS NULL AND $6::timestamptz IS NULL THEN z.hold_id IS NULL ELSE true END";
    private static final String MATCHING = MATCHING_ROWS + " ORDER BY " + INBOX_ORDER + ", z.at DESC LIMIT 200";
    /** The case's trip id as a UUID; null for a legacy trip id, which the trips module does not know. */
    private static final String TRIP_UUID = """
            CASE WHEN %1$s.trip_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 THEN %1$s.trip_id::uuid END""";
    /** The case's live trip: a trips-module trip id is a UUID. */
    private static final String LIVE_TRIP = "t.tenant_code = %1$s.tenant_code AND t.trip_id = " + TRIP_UUID;
    /** A RUT or id without dots, dashes or spaces, upper case; the parameter comes normalized the same way. */
    private static final String PLAIN = "upper(regexp_replace(%s, '[^0-9A-Za-z]', '', 'g'))";
    /**
     * What {@link #MATCHING_BY_TRIP} adds to {@link #MATCHING}, the case's live trip: $11 either driver's RUT, $12 the carrier's RUT,
     * $13 the carrier's id, $14 the origin name, $15 the destination name; each normalized as {@link #PLAIN} or
     * trimmed and lower case. A case without a live trip matches none.
     */
    private static final String BY_TRIP = """
               AND EXISTS (SELECT 1 FROM miot_trips.trip_live t
                    LEFT JOIN miot_fleet.carrier fc ON fc.tenant_code = t.tenant_code AND fc.id::text = t.carrier_id
                   WHERE %s
                     AND ($11::text IS NULL OR %s = $11 OR %s = $11)
                     AND ($12::text IS NULL OR %s = $12 OR t.carrier_id = $13)
                     AND ($14::text IS NULL OR lower(btrim(t.origin_geofence_label)) = $14)
                     AND ($15::text IS NULL OR lower(btrim(t.destination_geofence_label)) = $15))
            """.formatted(LIVE_TRIP.formatted("o"), PLAIN.formatted("t.driver_id"),
                    PLAIN.formatted("t.second_driver_id"), PLAIN.formatted("fc.rut"));
    private static final String MATCHING_BY_TRIP = byTrip(MATCHING);
    /** The rows {@link #MATCHING} or {@link #MATCHING_BY_TRIP} keep, without the limit, counted as {@link #COUNTS}. */
    private static final String MATCHING_COUNTS = "SELECT m.current_level, m.treatments > 0 AS under_treatment,"
            + " count(*) AS n FROM (%s) m GROUP BY 1, 2";
    /**
     * The vehicles on a trips-module trip now: departed (its confirmed departure, else its first transit or stop)
     * and not ended, as the signal's {@code trip.active}. $2 trip, $3 part of the vehicle id, $4 either driver's
     * RUT, $5 the carrier's RUT, $6 the carrier's id, $7 the origin name, $8 the destination name, normalized as in
     * {@link #MATCHING_BY_TRIP}.
     */
    private static final String ON_TRIP = """
            SELECT count(DISTINCT tl.asset_id) AS n
              FROM miot_trips.trip_live tl
              LEFT JOIN miot_fleet.carrier fc ON fc.tenant_code = tl.tenant_code AND fc.id::text = tl.carrier_id
             WHERE tl.tenant_code = $1 AND tl.asset_id IS NOT NULL AND tl.end_time IS NULL
               AND coalesce((SELECT m.confirmed_at FROM miot_trips.trip_milestone m
                              WHERE m.tenant_code = tl.tenant_code AND m.trip_id = tl.trip_id
                                AND m.milestone = 'departure' AND m.status = 'confirmed'),
                            (SELECT min(s.actual_start) FROM miot_trips.stage s
                              WHERE s.tenant_code = tl.tenant_code AND s.subject_type = 'trip'
                                AND s.subject_id = tl.trip_id AND s.stage_type IN ('transit', 'stop')
                                AND s.version_of IS NULL AND s.is_active)) <= now()
               AND ($2::text IS NULL OR tl.trip_id::text = $2)
               AND ($3::text IS NULL OR tl.asset_id ILIKE '%%' || $3 || '%%')
               AND ($4::text IS NULL OR %s = $4 OR %s = $4)
               AND ($5::text IS NULL OR %s = $5 OR tl.carrier_id = $6)
               AND ($7::text IS NULL OR lower(btrim(tl.origin_geofence_label)) = $7)
               AND ($8::text IS NULL OR lower(btrim(tl.destination_geofence_label)) = $8)
            """.formatted(PLAIN.formatted("tl.driver_id"), PLAIN.formatted("tl.second_driver_id"),
                    PLAIN.formatted("fc.rut"));

    /** {@code query} that also filters by the case's live trip, as {@link #MATCHING_BY_TRIP}. */
    private static String byTrip(String query) {
        return query.replace("AND ($6::timestamptz IS NULL OR o.at < $6)",
                "AND ($6::timestamptz IS NULL OR o.at < $6)\n" + BY_TRIP);
    }

    /** The open cases no hold covers. */
    private static final String COUNTS = "SELECT y.current_level, y.treatments > 0 AS under_treatment, count(*) AS n"
            + FROM_SUBQUERY + SELECT.formatted(CASES) + " WHERE x.closed_id IS NULL AND x.hold_id IS NULL) y"
            + " GROUP BY 1, 2";
    /** The tower inbox's counts: open cases whose current level asks for an operator. */
    private static final String TOWER_COUNTS = "SELECT y.current_level, y.treatments > 0 AS under_treatment,"
            + " y.hold_id IS NOT NULL AS ignored, count(*) AS n FROM (" + SELECT.formatted(CASES) + ") y"
            + " WHERE y.closed_id IS NULL AND " + needsOperator("y") + " GROUP BY y.current_level, y.treatments > 0, y.hold_id IS NOT NULL";
    private static final String IGNORED = "SELECT count(*) AS n FROM (" + CASES + ") x"
            + " WHERE x.closed_id IS NULL AND x.hold_id IS NOT NULL";
    private static final String LEVELS = """
            SELECT y.asset_id, y.name, y.current_level, l.at AS speed_at, l.speed_kmh, l.measure,
                   (l.context -> 'speed_limit')::text AS speed_context,
                   CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END
                       #>> '{measure,expression}' AS measure_expression
              FROM (%s WHERE x.closed_id IS NULL AND x.hold_id IS NULL) y
              JOIN LATERAL (SELECT t.* FROM miot_symptoms.signal_transitions t
                     WHERE t.tenant_code = y.tenant_code AND t.definition_id = y.definition_id
                       AND t.asset_id = y.asset_id AND t.state = y.state
                       AND (t.id = y.id OR (t.kind = 'LEVEL_CHANGED' AND t.id > y.id))
                     ORDER BY t.id DESC LIMIT 1) l ON true
              LEFT JOIN miot_symptoms.symptom_version v ON v.definition_id = l.definition_id
                   AND v.tenant_code = l.tenant_code AND v.version = l.version
             ORDER BY y.asset_id, y.at DESC
            """.formatted(SELECT.formatted(CASES));
    /**
     * One case with why it is at its level: the context of the row that set the level (its latest level change
     * before it closed, else its opening), that level's rule in the version that opened it, and the level of each
     * of those rows.
     */
    private static final String ONE = """
            SELECT w.*,
                   (SELECT o.context::text FROM miot_symptoms.signal_transitions o
                     WHERE o.tenant_code = w.tenant_code AND o.id = w.id) AS opening_context,
                   (SELECT c.context::text FROM miot_symptoms.signal_transitions c
                     WHERE c.tenant_code = w.tenant_code AND c.id = w.closed_id) AS closing_context,
                   (SELECT l.context::text FROM miot_symptoms.signal_transitions l
                     WHERE l.tenant_code = w.tenant_code AND l.definition_id = w.definition_id
                       AND l.asset_id = w.asset_id AND l.state = w.state
                       AND (l.id = w.id OR (l.kind = 'LEVEL_CHANGED' AND l.id > w.id
                            AND (w.closed_id IS NULL OR l.id < w.closed_id)))
                     ORDER BY l.id DESC LIMIT 1) AS level_context,
                   (SELECT json_agg(json_build_object('at', l.at, 'level', l.level, 'speed_kmh', l.speed_kmh,
                           'measure', l.measure, 'speed_limit', l.context -> 'speed_limit',
                           'measure_expression', CASE jsonb_typeof(v.spec)
                               WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END
                               #>> '{measure,expression}') ORDER BY l.id)::text
                      FROM miot_symptoms.signal_transitions l
                      LEFT JOIN miot_symptoms.symptom_version v ON v.definition_id = l.definition_id
                           AND v.tenant_code = l.tenant_code AND v.version = l.version
                     WHERE l.tenant_code = w.tenant_code AND l.definition_id = w.definition_id
                       AND l.asset_id = w.asset_id AND l.state = w.state
                       AND (l.id = w.id OR (l.kind = 'LEVEL_CHANGED' AND l.id > w.id
                            AND (w.closed_id IS NULL OR l.id < w.closed_id)))) AS level_steps,
                   (SELECT jsonb_path_query_first(
                           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END,
                           'lax $.levels[*] ? (@.icu == $l).when', jsonb_build_object('l', w.current_level)) #>> '{}'
                      FROM miot_symptoms.symptom_version v
                     WHERE v.definition_id = w.definition_id AND v.tenant_code = w.tenant_code
                       AND v.version = w.version
                     LIMIT 1) AS level_rule,
                   (SELECT jsonb_build_object('definitionId', w.definition_id, 'name', w.name,
                           'version', w.level_version, 'state', w.state, 'level', response.level)::text
                      FROM miot_symptoms.symptom_version v
                      CROSS JOIN LATERAL jsonb_path_query(
                           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END,
                           'lax $.levels[*] ? (@.icu == $l && @.applies == true)',
                           jsonb_build_object('l', w.current_level)) AS response(level)
                     WHERE v.definition_id = w.definition_id AND v.tenant_code = w.tenant_code
                       AND v.version = w.level_version AND v.status = 'PUBLISHED'
                     LIMIT 1) AS level_response
              FROM (%s) w
            """.formatted(WITH_SLA.formatted(SELECT.formatted(TREATABLE_CASES + " AND o.id = $2")));
    private static final String LIVE_TRIP_COLUMNS = """
            SELECT c.*, t.mandate_codes::text AS trip_mandate_codes, t.driver_name AS trip_driver,
                   t.carrier_name AS trip_carrier, t.origin_geofence_label AS trip_origin,
                   t.destination_geofence_label AS trip_destination, t.asset_id AS trip_asset,
            """;
    /**
     * Enrich only the returned page, without changing counts or looking up each trip separately. A trip without a
     * {@code trip_live} row (it ended) takes its code from its first current mandate, else from its feed service.
     */
    private static final String WITH_TRIP_CODE = LIVE_TRIP_COLUMNS + """
                   CASE WHEN t.trip_id IS NULL AND u.id IS NOT NULL THEN COALESCE(
                       (SELECT NULLIF(btrim(m.external_code), '') FROM miot_trips.trip_mandate tm
                          JOIN miot_trips.mandate m ON m.id = tm.mandate_id AND m.tenant_code = tm.tenant_code
                         WHERE tm.trip_id = u.id AND tm.tenant_code = c.tenant_code
                           AND tm.version_of IS NULL AND tm.is_active
                         ORDER BY tm.seq LIMIT 1),
                       (SELECT f.external_code FROM miot_trips.feed_service f
                         WHERE f.tenant_code = c.tenant_code AND f.trip_id = u.id
                         ORDER BY f.updated_at DESC LIMIT 1)) END AS trip_code_fallback
              FROM (%%s) c
              CROSS JOIN LATERAL (SELECT %s AS id) u
              LEFT JOIN miot_trips.trip_live t ON t.tenant_code = c.tenant_code AND t.trip_id = u.id
             ORDER BY c.at DESC
            """.formatted(TRIP_UUID.formatted("c"));
    /** Older trips deployments still supply their live-trip fields and support the same trip filters. */
    private static final String WITH_LIVE_TRIP = LIVE_TRIP_COLUMNS
            + " NULL::text AS trip_code_fallback FROM (%s) c LEFT JOIN miot_trips.trip_live t ON "
            + LIVE_TRIP.formatted("c") + " ORDER BY c.at DESC";
    private static final String WITHOUT_TRIP = "SELECT c.*, NULL::text AS trip_mandate_codes,"
            + " NULL::text AS trip_code_fallback,"
            + " NULL::text AS trip_driver, NULL::text AS trip_carrier, NULL::text AS trip_origin,"
            + " NULL::text AS trip_destination, NULL::text AS trip_asset FROM (%s) c ORDER BY c.at DESC";
    private static final String OPENED = CASES + " AND o.at >= $2 AND o.at < $3";
    private static final String OPENED_COUNTS = "SELECT y.definition_id, y.current_level, count(*) AS n,"
            + " count(*) FILTER (WHERE NOT "
            + needsOperator("y") + ") AS without_operator"
            + FROM_SUBQUERY + SELECT.formatted(OPENED) + ") y GROUP BY 1, 2";
    /** When the case reached its current level: its latest level change before it closed, else its opening. */
    private static final String LEVEL_SINCE = """
            SELECT z.*, COALESCE((SELECT l.at FROM miot_symptoms.signal_transitions l
                     WHERE l.tenant_code = z.tenant_code AND l.definition_id = z.definition_id
                       AND l.asset_id = z.asset_id AND l.state = z.state AND l.kind = 'LEVEL_CHANGED' AND l.id > z.id
                       AND (z.closed_id IS NULL OR l.id < z.closed_id)
                     ORDER BY l.id DESC LIMIT 1), z.at) AS level_since
              FROM (%s) z
            """;
    private static final String OPENED_PAGE = WITH_SLA.formatted(LEVEL_SINCE.formatted(
            SELECT.formatted(OPENED + " AND o.id > $4") + " ORDER BY x.id LIMIT $5")) + " ORDER BY y.id";

    /** $2 itself, as cases store a trip id. */
    private static final String TRIP_AS_GIVEN = "SELECT $2::text AS trip_id";
    /** $2 as a trip id, or the service code of a trips-module trip: its feed service's or a current mandate's. */
    private static final String TRIP_BY_CODE = TRIP_AS_GIVEN + """

            UNION SELECT f.trip_id::text FROM miot_trips.feed_service f
             WHERE f.tenant_code = $1 AND f.external_code = $2 AND f.trip_id IS NOT NULL
            UNION SELECT tm.trip_id::text FROM miot_trips.mandate m
              JOIN miot_trips.trip_mandate tm ON tm.mandate_id = m.id AND tm.tenant_code = m.tenant_code
             WHERE m.tenant_code = $1 AND m.external_code = $2 AND m.version_of IS NULL AND m.is_active
               AND tm.version_of IS NULL AND tm.is_active""";
    /**
     * The ACTIVE symptoms and those with a case on the trip ids of {@code %s}, each with its cases there: how
     * many, how many are open, the highest level any reached (its opening or a later change before it closed),
     * and the trip id of the latest.
     */
    private static final String TRIP_SYMPTOMS = """
            WITH trips AS (%s),
            trip_cases AS (
                SELECT o.definition_id, o.trip_id, o.at, closed.id IS NULL AS open,
                       GREATEST(o.level, COALESCE((SELECT max(l.level) FROM miot_symptoms.signal_transitions l
                           WHERE l.tenant_code = o.tenant_code AND l.definition_id = o.definition_id
                             AND l.asset_id = o.asset_id AND l.state = o.state AND l.kind = 'LEVEL_CHANGED'
                             AND l.id > o.id AND (closed.id IS NULL OR l.id < closed.id)), o.level)) AS max_level
                  FROM miot_symptoms.signal_transitions o
                  LEFT JOIN LATERAL (SELECT c.id FROM miot_symptoms.signal_transitions c
                         WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                           AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id
                         ORDER BY c.id LIMIT 1) closed ON true
                 WHERE o.tenant_code = $1 AND o.kind = 'OPENED' AND o.state = 'ACTIVE'
                   AND o.trip_id IN (SELECT trip_id FROM trips)),
            per_symptom AS (
                SELECT definition_id, count(*) AS n, count(*) FILTER (WHERE open) AS open_n,
                       max(max_level) AS max_level, min(at) AS first_at, max(at) AS last_at,
                       (array_agg(trip_id ORDER BY at DESC))[1] AS trip_id
                  FROM trip_cases GROUP BY definition_id)
            SELECT d.id, d.symptom_key, d.name, d.family, d.icon, COALESCE(p.n, 0) AS n,
                   COALESCE(p.open_n, 0) AS open_n, COALESCE(p.max_level, 0) AS max_level, p.trip_id,
                   p.first_at, p.last_at
              FROM miot_symptoms.symptom_definition d
              LEFT JOIN per_symptom p ON p.definition_id = d.id
             WHERE d.tenant_code = $1 AND (d.state = 'ACTIVE' OR p.n > 0)
             ORDER BY lower(d.name), d.id
            """;

    private static final String FIRST = """
            SELECT min(at) AS at FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND kind = 'OPENED' AND state = 'ACTIVE'
            """;

    private static final String PREVIOUS = """
            SELECT max(at) AS at FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND asset_id = $2 AND kind = 'OPENED' AND state = 'ACTIVE' AND id < $3
               AND at > $4 AND at < $5
            """;

    /** The case's NOTED rows: after its OPENED row and before the CLOSED row that ends it. */
    private static final String NOTES = """
            SELECT n.at, n.context::text AS context
              FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.signal_transitions n
                ON n.tenant_code = o.tenant_code AND n.definition_id = o.definition_id AND n.asset_id = o.asset_id
               AND n.state = o.state AND n.kind = 'NOTED' AND n.id > o.id
             WHERE o.tenant_code = $1 AND o.id = $2 AND o.kind = 'OPENED'
               AND NOT EXISTS (
                   SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED'
                      AND c.id > o.id AND c.id < n.id)
             ORDER BY n.id
             LIMIT $3
            """;

    private static final String HOLD_HISTORY = """
            SELECT history.* FROM miot_symptoms.signal_transitions o
              JOIN LATERAL (%s) history ON true
             WHERE o.tenant_code = $1 AND o.id = $2 AND o.kind = 'OPENED' AND o.state IN ('ACTIVE', 'TEST')
             ORDER BY history.hold_at, history.hold_id
            """.formatted(HoldSql.history("o"));

    /** Locks the case's OPENED row, so overlapping closes of one case run one after the other. */
    private static final String LOCK = """
            SELECT id FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND id = $2 AND kind = 'OPENED' FOR UPDATE
            """;
    private static final String LOCK_DEFINITION = """
            SELECT d.id FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.symptom_definition d ON d.tenant_code = o.tenant_code AND d.id = o.definition_id
             WHERE o.tenant_code = $1 AND o.id = $2 AND o.kind = 'OPENED'
               FOR SHARE OF d
            """;

    private static final String CLOSE_LEVEL = """
            SELECT o.trip_id, COALESCE((
                SELECT l.level FROM miot_symptoms.signal_transitions l
                 WHERE l.tenant_code = o.tenant_code AND l.definition_id = o.definition_id
                   AND l.asset_id = o.asset_id AND l.state = o.state AND l.kind = 'LEVEL_CHANGED' AND l.id > o.id
                 ORDER BY l.id DESC LIMIT 1), o.level) AS level
              FROM miot_symptoms.signal_transitions o
             WHERE o.tenant_code = $1 AND o.id = $2 AND o.kind = 'OPENED'
               AND NOT EXISTS (SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id)
            """;

    /** Closes the case unless a CLOSED row already follows its OPENED row; returns the row it wrote. */
    private static final String CLOSE = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh, closed_by, context)
            SELECT o.tenant_code, o.definition_id, o.version, o.state, 'CLOSED', o.asset_id, $3, o.level, o.level,
                   o.measure, o.trip_id, o.latitude, o.longitude, o.speed_kmh, $4, $5::jsonb
              FROM miot_symptoms.signal_transitions o
             WHERE o.tenant_code = $1 AND o.id = $2 AND o.kind = 'OPENED'
               AND NOT EXISTS (
                   SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id)
            RETURNING id
            """;

    /** The startup sweep reads every organization's cases. */
    private static final java.time.Duration SWEEP_TIMEOUT = java.time.Duration.ofMinutes(2);
    /** Serializes sweeps across replicas. Definition locks also coordinate evaluator, operator and state writes. */
    private static final String SWEEP_LOCK = "SELECT pg_advisory_xact_lock(hashtext('miot_symptoms.close_stale_cases'))";
    private static final String SWEEP_DEFINITIONS = """
            SELECT id FROM miot_symptoms.symptom_definition
             WHERE ($1::varchar IS NULL OR tenant_code = $1) AND ($2::uuid IS NULL OR id = $2)
             ORDER BY id FOR UPDATE
            """;

    private static final String TRIP_DEFINITIONS = """
            SELECT id FROM miot_symptoms.symptom_definition
             WHERE tenant_code = $1 AND ($2::uuid[] IS NULL OR id = ANY($2::uuid[]))
             ORDER BY id FOR SHARE
            """;

    private static final String TRIP_ASSET_LOCK = """
            SELECT asset_id FROM miot_trips.trip_live WHERE tenant_code = $1 AND trip_id = $2 FOR SHARE
            """;

    /**
     * Closes every open case whose state is no longer its symptom's ($1 tenant and $2 symptom, each null for any;
     * $3 the time, $4 the reason). OFF differs from both states, so turning a symptom off closes all its cases.
     */
    private static final String CLOSE_STALE = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh, context)
            SELECT DISTINCT ON (o.tenant_code, o.definition_id, o.asset_id, o.state)
                   o.tenant_code, o.definition_id, o.version, o.state, 'CLOSED', o.asset_id, $3,
                   COALESCE(lv.level, o.level), COALESCE(lv.level, o.level),
                   o.measure, o.trip_id, o.latitude, o.longitude, o.speed_kmh,
                   jsonb_build_object('reason', $4::text, 'from', o.state, 'to', d.state)
              FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.symptom_definition d ON d.id = o.definition_id AND d.tenant_code = o.tenant_code
              LEFT JOIN LATERAL (
                  SELECT l.level FROM miot_symptoms.signal_transitions l
                   WHERE l.tenant_code = o.tenant_code AND l.definition_id = o.definition_id
                     AND l.asset_id = o.asset_id AND l.state = o.state AND l.kind = 'LEVEL_CHANGED' AND l.id > o.id
                   ORDER BY l.id DESC LIMIT 1) lv ON true
             WHERE o.kind = 'OPENED' AND o.state <> d.state
               AND ($1::varchar IS NULL OR o.tenant_code = $1)
               AND ($2::uuid IS NULL OR o.definition_id = $2)
               AND NOT EXISTS (
                   SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id)
             ORDER BY o.tenant_code, o.definition_id, o.asset_id, o.state, o.id DESC
            RETURNING tenant_code, definition_id, version, state, asset_id, level, trip_id, latitude, longitude,
                      speed_kmh, (SELECT max(o.id) FROM miot_symptoms.signal_transitions o
                                   WHERE o.tenant_code = signal_transitions.tenant_code
                                     AND o.definition_id = signal_transitions.definition_id
                                     AND o.asset_id = signal_transitions.asset_id
                                     AND o.state = signal_transitions.state AND o.kind = 'OPENED') AS case_id,
                      (SELECT o.at FROM miot_symptoms.signal_transitions o
                        WHERE o.tenant_code = signal_transitions.tenant_code
                          AND o.definition_id = signal_transitions.definition_id
                          AND o.asset_id = signal_transitions.asset_id
                          AND o.state = signal_transitions.state AND o.kind = 'OPENED'
                        ORDER BY o.id DESC LIMIT 1) AS opened_at
            """;

    /** Locks the trip's OPENED rows, so an operator's close of one of them and this close run one after the other. */
    private static final String LOCK_TRIP = """
            SELECT o.*, o.id AS case_id, o.at AS opened_at FROM miot_symptoms.signal_transitions o
             WHERE o.tenant_code = $1 AND o.trip_id = $2 AND o.kind = 'OPENED'
               AND ($4::varchar IS NOT NULL OR COALESCE(o.context ->> 'after_trip_end', '') <> 'open_and_keep')
               AND ($3::uuid[] IS NULL OR o.definition_id = ANY($3::uuid[]))
               AND ($4::varchar IS NULL OR upper(o.asset_id) <> upper($4))
               AND NOT EXISTS (SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id)
             ORDER BY o.definition_id, o.asset_id, o.id FOR UPDATE
            """;

    /** Whether the trip has an open case on another vehicle than $4, read without locks before closing them. */
    private static final String OTHER_VEHICLE_OPEN = LOCK_TRIP.replace("FOR UPDATE", "LIMIT 1");

    /**
     * Closes each open case of the trip ($1 tenant, $2 trip) of the symptoms $3, at its current level, with
     * {@code closed_by} and the context's {@code reason} $5, at $4. The row keeps the
     * case's trip, its maximum and latest context from episode snapshots $6, falling back to recorded evidence.
     * A non-null $7 leaves that vehicle's cases open (the trip moved to it).
     */
    private static final String CLOSE_TRIP = """
            WITH closed AS (
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh, closed_by, context)
            SELECT DISTINCT ON (o.definition_id, o.asset_id, o.state)
                   o.tenant_code, o.definition_id, o.version, o.state, 'CLOSED', o.asset_id, $4,
                   COALESCE(lv.level, o.level), COALESCE(lv.level, o.level),
                   GREATEST(o.measure, lv.measure, snapshot.measure), o.trip_id, o.latitude, o.longitude, o.speed_kmh, $5::text,
                   COALESCE(snapshot.context, lv.context, o.context, '{}'::jsonb)
                       || jsonb_build_object('reason', $5::text, 'trip_id', o.trip_id)
              FROM miot_symptoms.signal_transitions o
              LEFT JOIN jsonb_to_recordset($6::jsonb)
                   AS snapshot(case_id bigint, measure double precision, context jsonb) ON snapshot.case_id = o.id
              LEFT JOIN LATERAL (
                  SELECT (array_agg(l.level ORDER BY l.id DESC))[1] AS level, max(l.measure) AS measure,
                         (array_agg(l.context ORDER BY l.id DESC)
                             FILTER (WHERE l.context IS NOT NULL))[1] AS context
                    FROM miot_symptoms.signal_transitions l
                   WHERE l.tenant_code = o.tenant_code AND l.definition_id = o.definition_id
                     AND l.asset_id = o.asset_id AND l.state = o.state AND l.kind = 'LEVEL_CHANGED' AND l.id > o.id
                   ) lv ON true
             WHERE o.tenant_code = $1 AND o.trip_id = $2 AND o.kind = 'OPENED' AND o.state IN ('ACTIVE', 'TEST')
               AND ($5::text <> 'trip_ended' OR COALESCE(o.context ->> 'after_trip_end', '') <> 'open_and_keep')
               AND ($3::uuid[] IS NULL OR o.definition_id = ANY($3::uuid[]))
               AND ($7::varchar IS NULL OR upper(o.asset_id) <> upper($7))
               AND NOT EXISTS (
                   SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id)
             ORDER BY o.definition_id, o.asset_id, o.state, o.id DESC
            RETURNING id, tenant_code, definition_id, version, state, asset_id, level, trip_id, latitude, longitude,
                      speed_kmh, (SELECT max(o.id) FROM miot_symptoms.signal_transitions o
                                   WHERE o.tenant_code = signal_transitions.tenant_code
                                     AND o.definition_id = signal_transitions.definition_id
                                     AND o.asset_id = signal_transitions.asset_id
                                     AND o.state = signal_transitions.state AND o.kind = 'OPENED') AS case_id,
                      (SELECT o.at FROM miot_symptoms.signal_transitions o
                        WHERE o.tenant_code = signal_transitions.tenant_code
                          AND o.definition_id = signal_transitions.definition_id
                          AND o.asset_id = signal_transitions.asset_id
                          AND o.state = signal_transitions.state AND o.kind = 'OPENED'
                        ORDER BY o.id DESC LIMIT 1) AS opened_at
            ), queued AS (
                INSERT INTO miot_symptoms.trip_end_effects (opened_id, closed_id)
                SELECT case_id, id FROM closed
                RETURNING opened_id
            )
            SELECT closed.* FROM closed JOIN queued ON queued.opened_id = closed.case_id
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgEngineCases(Instance<Pool> pool) {
        this(pool::get);
    }

    PgEngineCases(Supplier<Pool> pool) {
        this.pool = pool;
    }

    /** Trip details are optional, including when the trips module is unavailable. */
    private Iterable<Row> cases(String query, Tuple args) {
        try {
            return PgIds.query(pool.get(), WITH_TRIP_CODE.formatted(query), args);
        } catch (RuntimeException e) {
            LOG.debug("Engine case trip codes unavailable", e);
        }
        try {
            return PgIds.query(pool.get(), WITH_LIVE_TRIP.formatted(query), args);
        } catch (RuntimeException e) {
            LOG.debug("Engine case live trips unavailable", e);
            return PgIds.query(pool.get(), WITHOUT_TRIP.formatted(query), args);
        }
    }

    @Override
    public List<EngineCase> open(String tenantCode) {
        List<EngineCase> out = new ArrayList<>();
        cases(OPEN, Tuple.of(tenantCode)).forEach(r -> out.add(engineCase(r)));
        return out;
    }

    private static Tuple matching(String tenantCode, CaseFilter f) {
        return Tuple.tuple().addString(tenantCode).addString(f.tripId())
                .addString(f.assetId()).addString(f.symptomName())
                .addOffsetDateTime(f.from() == null ? null : utc(f.from()))
                .addOffsetDateTime(f.to() == null ? null : utc(f.to())).addInteger(f.level())
                .addBoolean(f.underTreatmentOnly()).addBoolean(f.ignoredOnly()).addBoolean(f.operatorOnly());
    }

    @Override
    public List<OpenCount> matchingCounts(String tenantCode, CaseFilter f) {
        List<OpenCount> out = new ArrayList<>();
        Tuple args = matching(tenantCode, f);
        String rows = MATCHING_ROWS;
        if (f.byTrip()) {
            String driver = plain(f.driverId());
            String carrier = plain(f.carrierId());
            if ("".equals(driver) || "".equals(carrier)) {
                return out;
            }
            args.addString(driver).addString(carrier).addString(f.carrierId() == null ? null : f.carrierId().trim())
                    .addString(lower(f.origin())).addString(lower(f.destination()));
            rows = byTrip(MATCHING_ROWS);
        }
        try {
            PgIds.query(pool.get(), MATCHING_COUNTS.formatted(rows), args).forEach(r -> out.add(new OpenCount(
                    r.getInteger("current_level"), r.getBoolean(UNDER_TREATMENT), r.getLong("n"))));
        } catch (PgException e) {
            // Without the trips or fleet tables no case has a live trip to match.
            if (!f.byTrip() || !UNDEFINED_TABLE.equals(e.getSqlState())) {
                throw e;
            }
            LOG.debug("Engine cases not counted by trip: trips unavailable", e);
        }
        return out;
    }

    @Override
    public long vehiclesOnTrip(String tenantCode, CaseFilter f) {
        String driver = plain(f.driverId());
        String carrier = plain(f.carrierId());
        if ("".equals(driver) || "".equals(carrier)) {
            return 0;
        }
        Tuple args = Tuple.tuple().addString(tenantCode).addString(f.tripId()).addString(f.assetId())
                .addString(driver).addString(carrier).addString(f.carrierId() == null ? null : f.carrierId().trim())
                .addString(lower(f.origin())).addString(lower(f.destination()));
        try {
            var rows = PgIds.query(pool.get(), ON_TRIP, args).iterator();
            return rows.hasNext() ? rows.next().getLong("n") : 0;
        } catch (PgException e) {
            if (!UNDEFINED_TABLE.equals(e.getSqlState())) {
                throw e;
            }
            LOG.debug("Vehicles on a trip not counted: trips unavailable", e);
            return 0;
        }
    }

    @Override
    public List<EngineCase> list(String tenantCode, CaseFilter f) {
        List<EngineCase> out = new ArrayList<>();
        Tuple args = matching(tenantCode, f);
        if (!f.byTrip()) {
            cases(MATCHING, args).forEach(r -> out.add(engineCase(r)));
            return out;
        }
        String driver = plain(f.driverId());
        String carrier = plain(f.carrierId());
        if ("".equals(driver) || "".equals(carrier)) {
            return out;
        }
        args.addString(driver).addString(carrier).addString(f.carrierId() == null ? null : f.carrierId().trim())
                .addString(lower(f.origin())).addString(lower(f.destination()));
        try {
            cases(MATCHING_BY_TRIP, args).forEach(r -> out.add(engineCase(r)));
        } catch (PgException e) {
            // Without the trips or fleet tables no case has a live trip to match.
            if (!UNDEFINED_TABLE.equals(e.getSqlState())) {
                throw e;
            }
            LOG.debug("Engine cases not filtered by trip: trips unavailable", e);
        }
        return out;
    }

    static String plain(String value) {
        return value == null ? null : value.replaceAll("[^0-9A-Za-z]", "").toUpperCase(Locale.ROOT);
    }

    private static String lower(String value) {
        return value == null ? null : value.strip().toLowerCase(Locale.ROOT);
    }

    @Override
    public List<OpenCount> openCounts(String tenantCode) {
        List<OpenCount> out = new ArrayList<>();
        PgIds.query(pool.get(), COUNTS, Tuple.of(tenantCode)).forEach(r -> out.add(new OpenCount(
                r.getInteger("current_level"), r.getBoolean(UNDER_TREATMENT), r.getLong("n"))));
        return out;
    }

    @Override
    public TowerCounts towerCounts(String tenantCode) {
        List<OpenCount> active = new ArrayList<>();
        long ignored = 0;
        for (Row r : PgIds.query(pool.get(), TOWER_COUNTS, Tuple.of(tenantCode))) {
            if (Boolean.TRUE.equals(r.getBoolean("ignored"))) {
                ignored += r.getLong("n");
            } else {
                active.add(new OpenCount(r.getInteger("current_level"), r.getBoolean(UNDER_TREATMENT),
                        r.getLong("n")));
            }
        }
        return new TowerCounts(active, ignored);
    }

    @Override
    public long ignoredCount(String tenantCode) {
        var rows = PgIds.query(pool.get(), IGNORED, Tuple.of(tenantCode)).iterator();
        return rows.hasNext() ? rows.next().getLong("n") : 0;
    }

    @Override
    public List<EngineCase> openForAsset(String tenantCode, String assetId) {
        List<EngineCase> out = new ArrayList<>();
        cases(OPEN_FOR_ASSET, Tuple.of(tenantCode, assetId)).forEach(r -> out.add(engineCase(r)));
        return out;
    }

    @Override
    public List<OpenLevel> openLevels(String tenantCode) {
        List<OpenLevel> out = new ArrayList<>();
        PgIds.query(pool.get(), LEVELS, Tuple.of(tenantCode)).forEach(r -> out.add(new OpenLevel(
                r.getString(ASSET_ID), r.getString("name"), r.getInteger("current_level"),
                speedStep(instant(r.getOffsetDateTime("speed_at")), r.getInteger("current_level"),
                        r.getString("measure_expression"), r.getDouble(SPEED_KMH),
                        json(r.getString("speed_context")), r.getDouble(MEASURE)))));
        return out;
    }

    @Override
    public List<TripSymptom> tripSymptoms(String tenantCode, String trip) {
        Tuple args = Tuple.of(tenantCode, trip);
        RowSet<Row> rows;
        try {
            rows = PgIds.query(pool.get(), TRIP_SYMPTOMS.formatted(TRIP_BY_CODE), args);
        } catch (PgException e) {
            // Without the trips tables a case's trip id is the only way to find the trip.
            if (!UNDEFINED_TABLE.equals(e.getSqlState())) {
                throw e;
            }
            LOG.debug("Trip codes not resolved: trips unavailable", e);
            rows = PgIds.query(pool.get(), TRIP_SYMPTOMS.formatted(TRIP_AS_GIVEN), args);
        }
        List<TripSymptom> out = new ArrayList<>();
        rows.forEach(r -> out.add(new TripSymptom(r.getUUID("id"), r.getString("symptom_key"), r.getString("name"),
                r.getString("family"), r.getString("icon"), r.getLong("n"), r.getLong("open_n"),
                r.getInteger("max_level"), r.getString(TRIP_ID), instant(r.getOffsetDateTime("first_at")),
                instant(r.getOffsetDateTime("last_at")))));
        return out;
    }

    @Override
    public Optional<EngineCase> find(String tenantCode, long caseId) {
        var rows = cases(ONE, Tuple.of(tenantCode, caseId)).iterator();
        if (!rows.hasNext()) {
            return Optional.empty();
        }
        Row r = rows.next();
        return Optional.of(engineCase(r).withLevel(json(r.getString("opening_context")),
                json(r.getString("level_context")), r.getString("level_rule"),
                steps(json(r.getString("level_steps"))))
                .withClosing(json(r.getString("closing_context")))
                .withLevelResponse(json(r.getString("level_response"))));
    }

    @Override
    public List<LevelCount> openedCounts(String tenantCode, Instant from, Instant to) {
        List<LevelCount> out = new ArrayList<>();
        PgIds.query(pool.get(), OPENED_COUNTS, Tuple.of(tenantCode, utc(from), utc(to))).forEach(r -> out.add(
                new LevelCount(r.getUUID(DEFINITION_ID), r.getInteger("current_level"), r.getLong("n"),
                        r.getLong("without_operator"))));
        return out;
    }

    @Override
    public List<DueCase> openedPage(String tenantCode, Instant from, Instant to, long afterId, int limit) {
        List<DueCase> out = new ArrayList<>();
        PgIds.query(pool.get(), OPENED_PAGE, Tuple.of(tenantCode, utc(from), utc(to), afterId, limit))
                .forEach(r -> out.add(new DueCase(r.getLong("id"), r.getUUID(DEFINITION_ID),
                        r.getOffsetDateTime("level_since").toInstant(), r.getInteger("sla_minutes"))));
        return out;
    }

    @Override
    public Optional<Instant> firstOpening(String tenantCode) {
        var rows = PgIds.query(pool.get(), FIRST, Tuple.of(tenantCode)).iterator();
        OffsetDateTime at = rows.hasNext() ? rows.next().getOffsetDateTime("at") : null;
        return Optional.ofNullable(at).map(OffsetDateTime::toInstant);
    }

    private static OffsetDateTime utc(Instant at) {
        return at.atOffset(ZoneOffset.UTC);
    }

    @Override
    public List<CaseNote> notes(String tenantCode, long caseId) {
        List<CaseNote> out = new ArrayList<>();
        PgIds.query(pool.get(), NOTES, Tuple.of(tenantCode, caseId, MAX_NOTES)).forEach(r -> out.add(
                note(r.getOffsetDateTime("at").toInstant(), json(r.getString("context")))));
        out.sort(Comparator.comparing(CaseNote::at));
        return out;
    }

    @Override
    public List<EngineCase.Ignored> holds(String tenantCode, EngineCase engineCase, Instant until) {
        List<EngineCase.Ignored> out = new ArrayList<>();
        PgIds.query(pool.get(), HOLD_HISTORY, Tuple.of(tenantCode, engineCase.id(), utc(until)))
                .forEach(r -> out.add(hold(r)));
        return out;
    }

    /** A note from its row's time and context ({@code {"note": {...}}}); the frame's time when the event has none. */
    static CaseNote note(Instant recordedAt, JsonNode context) {
        JsonNode n = context == null ? null : context.path("note");
        if (n == null || !n.isObject()) {
            return new CaseNote(recordedAt, null, null, recordedAt);
        }
        Instant at = recordedAt;
        try {
            if (n.hasNonNull("at")) {
                at = OffsetDateTime.parse(n.get("at").asText()).toInstant();
            }
        } catch (java.time.format.DateTimeParseException e) {
            // Keep the frame time when the provider sent an invalid event time.
        }
        return new CaseNote(recordedAt, textOrNull(n, "event_type"), textOrNull(n, "description"), at);
    }

    private static String textOrNull(JsonNode n, String field) {
        String v = n.path(field).asText(null);
        return v == null || v.isBlank() ? null : v;
    }

    @Override
    public Optional<Instant> previousOpening(String tenantCode, String assetId, long caseId, Instant after,
            Instant before) {
        var rows = PgIds.query(pool.get(), PREVIOUS, Tuple.of(tenantCode, assetId, caseId,
                after.atOffset(ZoneOffset.UTC), before.atOffset(ZoneOffset.UTC))).iterator();
        OffsetDateTime at = rows.hasNext() ? rows.next().getOffsetDateTime("at") : null;
        return Optional.ofNullable(at).map(OffsetDateTime::toInstant);
    }

    /**
     * Records that an operator closed the case at {@code at}. The lock and the insert share a transaction, and
     * the insert reads after the lock, so a close that waited sees the one before it and writes nothing.
     */
    @Override
    public boolean close(String tenantCode, long caseId, String actor, Instant at) {
        return close(tenantCode, caseId, actor, at, null);
    }

    /** The row's context records how the operator closed the case, so a restart keeps the reopen block. */
    @Override
    public boolean close(String tenantCode, long caseId, String actor, Instant at,
            OperatorClose how) {
        return close(tenantCode, caseId, actor, at, how, ignored -> { });
    }

    @Override
    public boolean close(String tenantCode, long caseId, String actor, Instant at,
            OperatorClose how,
            Consumer<OperatorClose> beforeClose) {
        return pool.get().withTransaction(conn -> conn.preparedQuery(LOCK_DEFINITION)
                .execute(Tuple.of(tenantCode, caseId))
                .flatMap(locked -> conn.preparedQuery(LOCK).execute(Tuple.of(tenantCode, caseId)))
                .flatMap(locked -> conn.preparedQuery(CLOSE_LEVEL).execute(Tuple.of(tenantCode, caseId)))
                .flatMap(rows -> closeLocked(conn, tenantCode, caseId, actor, at, how, beforeClose, rows)))
                .await().atMost(QUERY_TIMEOUT);
    }

    @SuppressWarnings("java:S107") // Close inputs and the already-locked case snapshot.
    private static Uni<Boolean> closeLocked(SqlConnection conn,
            String tenant, long caseId, String actor, Instant at,
            OperatorClose how,
            Consumer<OperatorClose> beforeClose,
            RowSet<Row> rows) {
        var iterator = rows.iterator();
        if (!iterator.hasNext()) return Uni.createFrom().item(false);
        Row row = iterator.next();
        var current = how == null ? null : new OperatorClose(
                row.getString(TRIP_ID), at, row.getInteger(LEVEL), how.invalidated());
        JsonObject context = current == null ? null : new JsonObject(current.context());
        // The Redis and duty collaborators block; keep their work off the SQL connection's event loop.
        return Uni.createFrom().item(() -> {
            beforeClose.accept(current);
            return true;
        }).runSubscriptionOn(Infrastructure.getDefaultExecutor())
                .flatMap(ignored -> conn.preparedQuery(CLOSE)
                        .execute(Tuple.of(tenant, caseId, at.atOffset(ZoneOffset.UTC), actor, context)))
                .map(written -> written.iterator().hasNext());
    }

    @Override
    public List<StaleCase> closeStale(String tenantCode, UUID definitionId, Instant at, String reason) {
        return pool.get().withTransaction(conn -> conn.query(SWEEP_LOCK).execute()
                .flatMap(locked -> conn.preparedQuery(SWEEP_DEFINITIONS).execute(Tuple.of(tenantCode, definitionId)))
                .flatMap(locked -> conn.preparedQuery(CLOSE_STALE)
                        .execute(Tuple.of(tenantCode, definitionId, at.atOffset(ZoneOffset.UTC), reason)))
                .map(PgEngineCases::staleCases))
                .await().atMost(tenantCode == null ? SWEEP_TIMEOUT : QUERY_TIMEOUT);
    }

    @Override
    public List<StaleCase> closeTrip(String tenantCode, String tripId, List<UUID> definitionIds, Instant at,
            String reason) {
        return closeTrip(tenantCode, tripId, definitionIds, at, reason, c -> null);
    }

    @Override
    public List<StaleCase> closeTrip(String tenantCode, String tripId, List<UUID> definitionIds, Instant at,
            String reason, Function<StaleCase, ClosingFrame> frames) {
        return closeTrip(tenantCode, tripId, definitionIds, at, reason, null, frames);
    }

    @Override
    public List<StaleCase> closeTrip(String tenantCode, String tripId, List<UUID> definitionIds, Instant at,
            String reason, String keepAsset, Function<StaleCase, ClosingFrame> frames) {
        if (definitionIds != null && definitionIds.isEmpty()) {
            return List.of();
        }
        UUID[] ids = definitionIds == null ? null : definitionIds.toArray(UUID[]::new);
        // Every trip_live change asks; most trips have no case on another vehicle.
        if (keepAsset != null && !pool.get().preparedQuery(OTHER_VEHICLE_OPEN)
                .execute(Tuple.of(tenantCode, tripId, ids, keepAsset)).await().atMost(QUERY_TIMEOUT).iterator()
                .hasNext()) {
            return List.of();
        }
        return pool.get().withTransaction(conn -> PgTripState.lock(conn, tenantCode, tripId)
                .flatMap(window -> TripEnds.REASON.equals(reason)
                        ? PgTripState.remember(conn, tenantCode, tripId, at, window)
                        : Uni.createFrom().voidItem())
                .flatMap(locked -> lockTripAsset(conn, tenantCode, tripId, keepAsset))
                .flatMap(locked -> conn.preparedQuery(TRIP_DEFINITIONS).execute(Tuple.of(tenantCode, ids)))
                .flatMap(locked -> conn.preparedQuery(LOCK_TRIP).execute(Tuple.of(tenantCode, tripId, ids, keepAsset)))
                .emitOn(Infrastructure.getDefaultWorkerPool())
                .map(locked -> closingFrames(locked, frames))
                .flatMap(snapshots -> conn.preparedQuery(CLOSE_TRIP)
                        .execute(Tuple.from(new Object[] {tenantCode, tripId, ids, at.atOffset(ZoneOffset.UTC), reason,
                                snapshots, keepAsset})))
                .map(PgEngineCases::staleCases))
                .await().atMost(QUERY_TIMEOUT);
    }

    /** A delayed truck-change notice must never close the truck the trip moved back to. */
    private static Uni<Void> lockTripAsset(SqlConnection conn, String tenant, String tripId, String keepAsset) {
        if (keepAsset == null) {
            return Uni.createFrom().voidItem();
        }
        return conn.preparedQuery(TRIP_ASSET_LOCK).execute(Tuple.of(tenant, TripEnds.uuid(tripId)))
                .invoke(rows -> {
                    var iterator = rows.iterator();
                    if (!iterator.hasNext() || !keepAsset.equalsIgnoreCase(iterator.next().getString(ASSET_ID))) {
                        throw new IllegalStateException("Trip truck changed again; retry with a fresh trip state");
                    }
                }).replaceWithVoid();
    }

    private static JsonArray closingFrames(Iterable<Row> rows, Function<StaleCase, ClosingFrame> frames) {
        JsonArray snapshots = new JsonArray();
        for (Row row : rows) {
            ClosingFrame frame = frames.apply(staleCase(row));
            if (frame != null) {
                snapshots.add(new JsonObject().put("case_id", row.getLong("id"))
                        .put(MEASURE, frame.maxMeasure()).put("context", frame.context()));
            }
        }
        return snapshots;
    }

    private static List<StaleCase> staleCases(Iterable<Row> rows) {
        List<StaleCase> out = new ArrayList<>();
        rows.forEach(r -> out.add(staleCase(r)));
        return out;
    }

    /** The case identity shared by closure queries and the durable trip-end effects queue. */
    public static StaleCase staleCase(Row r) {
        return new StaleCase(r.getString("tenant_code"), r.getLong("case_id"),
                r.getUUID(DEFINITION_ID), r.getString("version"), "TEST".equals(r.getString("state")),
                r.getString(ASSET_ID), r.getInteger(LEVEL), r.getString(TRIP_ID), r.getDouble("latitude"),
                r.getDouble("longitude"), r.getDouble(SPEED_KMH), r.getOffsetDateTime("opened_at").toInstant());
    }

    private static EngineCase engineCase(Row r) {
        OffsetDateTime closed = r.getOffsetDateTime("closed_at");
        return new EngineCase(r.getLong("id"), r.getUUID(DEFINITION_ID), r.getString("version"),
                r.getString("name"), r.getString("family"), r.getString(ASSET_ID),
                r.getOffsetDateTime("at").toInstant(), r.getInteger("current_level"), r.getString(TRIP_ID),
                r.getDouble("latitude"), r.getDouble("longitude"), r.getDouble(SPEED_KMH),
                closed == null ? null : closed.toInstant(), r.getLong("treatments"), r.getInteger("sla_minutes"),
                r.getLong("recurrence"), tripCode(r.getString("trip_mandate_codes"), r.getString("trip_code_fallback"))).withTrip(trip(r))
                .withHold(hold(r), instant(r.getOffsetDateTime("returned_at")))
                .withLevelAt(instant(r.getOffsetDateTime("level_at")))
                .withTest("TEST".equals(r.getString("state")));
    }

    private static EngineCase.Ignored hold(Row r) {
        String id = r.getString("hold_id");
        if (id == null) {
            return null;
        }
        return new EngineCase.Ignored(id, instant(r.getOffsetDateTime("hold_at")),
                instant(r.getOffsetDateTime("hold_until")), Boolean.TRUE.equals(r.getBoolean("hold_trip_end")),
                r.getString("hold_scope"), r.getString("hold_by"));
    }

    private static Instant instant(OffsetDateTime at) {
        return at == null ? null : at.toInstant();
    }

    /** The live trip's names, or null when the case has no live trip or it has none of them. */
    private static EngineCase.TripDetails trip(Row r) {
        EngineCase.TripDetails t = new EngineCase.TripDetails(r.getString("trip_driver"), r.getString("trip_carrier"),
                r.getString("trip_origin"), r.getString("trip_destination"), r.getString("trip_asset"));
        return t.driver() == null && t.carrier() == null && t.origin() == null && t.destination() == null
                && t.assetId() == null ? null : t;
    }

    /**
     * Each step uses its transition version's measure. Without a recognized speed measure it carries no speed
     * evidence, even when another step of the same case used a speed template.
     */
    static List<EngineCase.LevelStep> steps(JsonNode steps) {
        List<EngineCase.LevelStep> out = new ArrayList<>();
        if (steps == null || !steps.isArray()) {
            return out;
        }
        for (JsonNode step : steps) {
            try {
                Instant at = OffsetDateTime.parse(step.path("at").asText()).toInstant();
                int level = step.path(LEVEL).asInt();
                String expression = step.path("measure_expression").asText(null);
                Double speed = number(step.path(SPEED_KMH));
                out.add(speedStep(at, level, expression, speed, step.get("speed_limit"),
                        number(step.path(MEASURE))));
            } catch (java.time.format.DateTimeParseException e) {
                LOG.debug("Engine case level step without a valid time", e);
            }
        }
        return out;
    }

    private static Double number(JsonNode n) {
        return n != null && n.isNumber() ? n.asDouble() : null;
    }

    private static EngineCase.LevelStep speedStep(Instant at, int level, String expression, Double speed,
            JsonNode kept, Double measure) {
        String source = EngineCase.SpeedLimit.source(expression);
        if (source == null || speed == null) {
            return new EngineCase.LevelStep(at, level);
        }
        double ruleSpeed = EngineCase.SpeedLimit.ruleSpeed(expression, speed);
        return new EngineCase.LevelStep(at, level, ruleSpeed,
                EngineCase.SpeedLimit.of(source, kept, ruleSpeed, measure));
    }

    private static JsonNode json(String text) {
        if (text == null || text.isBlank()) {
            return null;
        }
        try {
            return JSON.readTree(text);
        } catch (JsonProcessingException e) {
            LOG.debug("Engine case level context is not valid JSON", e);
            return null;
        }
    }

    /** The live trip's first mandate code, else the code of the ended trip. */
    static String tripCode(String mandates, String fallback) {
        String code = tripCode(mandates);
        if (code != null) {
            return code;
        }
        return fallback == null || fallback.isBlank() ? null : fallback.strip();
    }

    /** Decode each trip independently so a malformed projection never hides another trip's code. */
    static String tripCode(String mandates) {
        if (mandates == null || mandates.isBlank()) {
            return null;
        }
        try {
            JsonNode codes = JSON.readTree(mandates);
            if (codes != null && codes.isTextual()) {
                codes = JSON.readTree(codes.textValue());
            }
            String code = codes == null ? "" : codes.path(0).path("code").asText("").strip();
            return code.isEmpty() ? null : code;
        } catch (JsonProcessingException e) {
            LOG.debug("Engine case trip code is not valid JSON", e);
            return null;
        }
    }
}
