package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseFilter;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseNote;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Locale;
import java.util.Optional;
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

    private static final String CASES = """
            SELECT o.id, o.tenant_code, o.definition_id, o.version, o.asset_id, o.at, o.level, o.trip_id,
                   o.latitude, o.longitude, o.speed_kmh, d.name, d.family,
                   (SELECT c.id FROM miot_symptoms.signal_transitions c
                     WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                       AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id
                     ORDER BY c.id LIMIT 1) AS closed_id,
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
              LEFT JOIN LATERAL (%s) hold ON true
              LEFT JOIN LATERAL (%s) ret ON true
             WHERE o.tenant_code = $1 AND o.kind = 'OPENED' AND o.state = 'ACTIVE'
            """.formatted(HoldSql.active("o"), HoldSql.returned("o"));

    /** The case's level is its latest level change before it closed, else the opening one. */
    private static final String SELECT = """
            SELECT x.*, (SELECT c.at FROM miot_symptoms.signal_transitions c WHERE c.id = x.closed_id) AS closed_at,
                   COALESCE((SELECT l.level FROM miot_symptoms.signal_transitions l
                     WHERE l.tenant_code = x.tenant_code AND l.definition_id = x.definition_id
                       AND l.asset_id = x.asset_id AND l.state = 'ACTIVE' AND l.kind = 'LEVEL_CHANGED' AND l.id > x.id
                       AND (x.closed_id IS NULL OR l.id < x.closed_id)
                     ORDER BY l.id DESC LIMIT 1), x.level) AS current_level
              FROM (%s) x
            """;

    /**
     * The SLA of the case's level in the version that opened it. A spec may be stored as a JSON string holding
     * the document.
     */
    private static final String WITH_SLA = """
            SELECT y.*, (SELECT jsonb_path_query_first(
                           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END,
                           'lax $.levels[*] ? (@.icu == $l && @.applies == true && @.response.operator == true)'
                             '.response.slaMinutes ? (@ > 0)',
                           jsonb_build_object('l', y.current_level))::numeric::int
                      FROM miot_symptoms.symptom_version v
                     WHERE v.definition_id = y.definition_id AND v.tenant_code = y.tenant_code
                       AND v.version = y.version AND v.status = 'PUBLISHED') AS sla_minutes
              FROM (%s) y
            """;

    private static final String OPEN = WITH_SLA.formatted(SELECT.formatted(CASES)
            + " WHERE x.closed_id IS NULL ORDER BY x.at DESC LIMIT 200") + " ORDER BY y.at DESC";
    private static final String OPEN_FOR_ASSET = WITH_SLA.formatted(SELECT.formatted(CASES
            + " AND o.asset_id = $2") + " WHERE x.closed_id IS NULL");
    /**
     * {@link CaseFilter}: $2 trip, $3 vehicle id, $4 symptom name, $5 from, $6 to, $7 level, $8 treated only, $9
     * ignored only. Without dates and $9, the open cases no hold covers.
     */
    private static final String MATCHING = "SELECT * FROM (" + WITH_SLA.formatted(SELECT.formatted(CASES + """
               AND ($2::text IS NULL OR o.trip_id = $2)
               AND ($3::text IS NULL OR o.asset_id ILIKE '%' || $3 || '%')
               AND ($4::text IS NULL OR lower(d.name) = lower($4))
               AND ($6::timestamptz IS NULL OR o.at < $6)
            """) + " WHERE ($5::timestamptz IS NOT NULL OR $6::timestamptz IS NOT NULL OR x.closed_id IS NULL)")
            + ") z WHERE ($7::int IS NULL OR z.current_level = $7)"
            + " AND ($5::timestamptz IS NULL OR z.closed_at IS NULL OR z.closed_at >= $5)"
            + " AND (NOT $8::boolean OR z.treatments > 0)"
            + " AND CASE WHEN $9::boolean THEN z.hold_id IS NOT NULL AND z.closed_id IS NULL"
            + " WHEN $5::timestamptz IS NULL AND $6::timestamptz IS NULL THEN z.hold_id IS NULL ELSE true END"
            + " ORDER BY z.at DESC LIMIT 200";
    /** The case's live trip: a trips-module trip id is a UUID. */
    private static final String LIVE_TRIP = """
            t.tenant_code = %s.tenant_code AND t.trip_id = CASE
                 WHEN %<s.trip_id ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                 THEN %<s.trip_id::uuid END""";
    /** A RUT or id without dots, dashes or spaces, upper case; the parameter comes normalized the same way. */
    private static final String PLAIN = "upper(regexp_replace(%s, '[^0-9A-Za-z]', '', 'g'))";
    /**
     * {@link #MATCHING} that also filters by the case's live trip: $10 either driver's RUT, $11 the carrier's RUT,
     * $12 the carrier's id, $13 the origin name, $14 the destination name; each normalized as {@link #PLAIN} or
     * trimmed and lower case. A case without a live trip matches none.
     */
    private static final String MATCHING_BY_TRIP = MATCHING.replace("AND ($6::timestamptz IS NULL OR o.at < $6)",
            "AND ($6::timestamptz IS NULL OR o.at < $6)\n" + """
               AND EXISTS (SELECT 1 FROM miot_trips.trip_live t
                    LEFT JOIN miot_fleet.carrier fc ON fc.tenant_code = t.tenant_code AND fc.id::text = t.carrier_id
                   WHERE %s
                     AND ($10::text IS NULL OR %s = $10 OR %s = $10)
                     AND ($11::text IS NULL OR %s = $11 OR t.carrier_id = $12)
                     AND ($13::text IS NULL OR lower(btrim(t.origin_geofence_label)) = $13)
                     AND ($14::text IS NULL OR lower(btrim(t.destination_geofence_label)) = $14))
            """.formatted(LIVE_TRIP.formatted("o"), PLAIN.formatted("t.driver_id"),
                    PLAIN.formatted("t.second_driver_id"), PLAIN.formatted("fc.rut")));
    /** The open cases no hold covers. */
    private static final String COUNTS = "SELECT y.current_level, y.treatments > 0 AS under_treatment, count(*) AS n"
            + FROM_SUBQUERY + SELECT.formatted(CASES) + " WHERE x.closed_id IS NULL AND x.hold_id IS NULL) y"
            + " GROUP BY 1, 2";
    private static final String TOWER_COUNTS = "SELECT y.current_level, y.treatments > 0 AS under_treatment,"
            + " y.hold_id IS NOT NULL AS ignored, count(*) AS n FROM (" + SELECT.formatted(CASES) + ") y"
            + " WHERE y.closed_id IS NULL GROUP BY y.current_level, y.treatments > 0, y.hold_id IS NOT NULL";
    private static final String IGNORED = "SELECT count(*) AS n FROM (" + CASES + ") x"
            + " WHERE x.closed_id IS NULL AND x.hold_id IS NOT NULL";
    private static final String LEVELS = "SELECT y.asset_id, y.name, y.current_level"
            + FROM_SUBQUERY + SELECT.formatted(CASES) + " WHERE x.closed_id IS NULL AND x.hold_id IS NULL) y"
            + " ORDER BY y.asset_id, y.at DESC";
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
                       AND l.asset_id = w.asset_id AND l.state = 'ACTIVE'
                       AND (l.id = w.id OR (l.kind = 'LEVEL_CHANGED' AND l.id > w.id
                            AND (w.closed_id IS NULL OR l.id < w.closed_id)))
                     ORDER BY l.id DESC LIMIT 1) AS level_context,
                   (SELECT json_agg(json_build_object('at', l.at, 'level', l.level) ORDER BY l.id)::text
                      FROM miot_symptoms.signal_transitions l
                     WHERE l.tenant_code = w.tenant_code AND l.definition_id = w.definition_id
                       AND l.asset_id = w.asset_id AND l.state = 'ACTIVE'
                       AND (l.id = w.id OR (l.kind = 'LEVEL_CHANGED' AND l.id > w.id
                            AND (w.closed_id IS NULL OR l.id < w.closed_id)))) AS level_steps,
                   (SELECT jsonb_path_query_first(
                           CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END,
                           'lax $.levels[*] ? (@.icu == $l).when', jsonb_build_object('l', w.current_level)) #>> '{}'
                      FROM miot_symptoms.symptom_version v
                     WHERE v.definition_id = w.definition_id AND v.tenant_code = w.tenant_code
                       AND v.version = w.version
                     LIMIT 1) AS level_rule
              FROM (%s) w
            """.formatted(WITH_SLA.formatted(SELECT.formatted(CASES + " AND o.id = $2")));
    /** Enrich only the returned page, without changing counts or looking up each trip separately. */
    private static final String WITH_TRIP_CODE = """
            SELECT c.*, t.mandate_codes::text AS trip_mandate_codes, t.driver_name AS trip_driver,
                   t.carrier_name AS trip_carrier, t.origin_geofence_label AS trip_origin,
                   t.destination_geofence_label AS trip_destination
              FROM (%%s) c
              LEFT JOIN miot_trips.trip_live t ON %s
             ORDER BY c.at DESC
            """.formatted(LIVE_TRIP.formatted("c"));
    private static final String WITHOUT_TRIP = "SELECT c.*, NULL::text AS trip_mandate_codes,"
            + " NULL::text AS trip_driver, NULL::text AS trip_carrier, NULL::text AS trip_origin,"
            + " NULL::text AS trip_destination FROM (%s) c ORDER BY c.at DESC";
    private static final String OPENED = CASES + " AND o.at >= $2 AND o.at < $3";
    private static final String OPENED_COUNTS = "SELECT y.definition_id, y.current_level, count(*) AS n"
            + FROM_SUBQUERY + SELECT.formatted(OPENED) + ") y GROUP BY 1, 2";
    /** When the case reached its current level: its latest level change before it closed, else its opening. */
    private static final String LEVEL_SINCE = """
            SELECT z.*, COALESCE((SELECT l.at FROM miot_symptoms.signal_transitions l
                     WHERE l.tenant_code = z.tenant_code AND l.definition_id = z.definition_id
                       AND l.asset_id = z.asset_id AND l.state = 'ACTIVE' AND l.kind = 'LEVEL_CHANGED' AND l.id > z.id
                       AND (z.closed_id IS NULL OR l.id < z.closed_id)
                     ORDER BY l.id DESC LIMIT 1), z.at) AS level_since
              FROM (%s) z
            """;
    private static final String OPENED_PAGE = WITH_SLA.formatted(LEVEL_SINCE.formatted(
            SELECT.formatted(OPENED + " AND o.id > $4") + " ORDER BY x.id LIMIT $5")) + " ORDER BY y.id";

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

    /** Locks the case's OPENED row, so overlapping closes of one case run one after the other. */
    private static final String LOCK = """
            SELECT id FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND id = $2 AND kind = 'OPENED'
               FOR UPDATE
            """;

    /** Closes the case unless a CLOSED row already follows its OPENED row; returns the row it wrote. */
    private static final String CLOSE = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh, closed_by)
            SELECT o.tenant_code, o.definition_id, o.version, o.state, 'CLOSED', o.asset_id, $3, o.level, o.level,
                   o.measure, o.trip_id, o.latitude, o.longitude, o.speed_kmh, $4
              FROM miot_symptoms.signal_transitions o
             WHERE o.tenant_code = $1 AND o.id = $2 AND o.kind = 'OPENED'
               AND NOT EXISTS (
                   SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                      AND c.asset_id = o.asset_id AND c.state = o.state AND c.kind = 'CLOSED' AND c.id > o.id)
            RETURNING id
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
            return PgIds.query(pool.get(), WITHOUT_TRIP.formatted(query), args);
        }
    }

    @Override
    public List<EngineCase> open(String tenantCode) {
        List<EngineCase> out = new ArrayList<>();
        cases(OPEN, Tuple.of(tenantCode)).forEach(r -> out.add(engineCase(r)));
        return out;
    }

    @Override
    public List<EngineCase> list(String tenantCode, CaseFilter f) {
        List<EngineCase> out = new ArrayList<>();
        Tuple args = Tuple.tuple().addString(tenantCode).addString(f.tripId())
                .addString(f.assetId()).addString(f.symptomName())
                .addOffsetDateTime(f.from() == null ? null : utc(f.from()))
                .addOffsetDateTime(f.to() == null ? null : utc(f.to())).addInteger(f.level())
                .addBoolean(f.underTreatmentOnly()).addBoolean(f.ignoredOnly());
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
            PgIds.query(pool.get(), WITH_TRIP_CODE.formatted(MATCHING_BY_TRIP), args)
                    .forEach(r -> out.add(engineCase(r)));
        } catch (PgException e) {
            // Without the trips or fleet tables no case has a live trip to match.
            if (!"42P01".equals(e.getSqlState())) {
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
                r.getInteger("current_level"), r.getBoolean("under_treatment"), r.getLong("n"))));
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
                active.add(new OpenCount(r.getInteger("current_level"), r.getBoolean("under_treatment"),
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
                r.getString("asset_id"), r.getString("name"), r.getInteger("current_level"))));
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
                steps(json(r.getString("level_steps")))).withClosing(json(r.getString("closing_context"))));
    }

    @Override
    public List<LevelCount> openedCounts(String tenantCode, Instant from, Instant to) {
        List<LevelCount> out = new ArrayList<>();
        PgIds.query(pool.get(), OPENED_COUNTS, Tuple.of(tenantCode, utc(from), utc(to))).forEach(r -> out.add(
                new LevelCount(r.getUUID("definition_id"), r.getInteger("current_level"), r.getLong("n"))));
        return out;
    }

    @Override
    public List<DueCase> openedPage(String tenantCode, Instant from, Instant to, long afterId, int limit) {
        List<DueCase> out = new ArrayList<>();
        PgIds.query(pool.get(), OPENED_PAGE, Tuple.of(tenantCode, utc(from), utc(to), afterId, limit))
                .forEach(r -> out.add(new DueCase(r.getLong("id"), r.getUUID("definition_id"),
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
            at = recordedAt;
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
        return pool.get().withTransaction(conn -> conn.preparedQuery(LOCK).execute(Tuple.of(tenantCode, caseId))
                .flatMap(locked -> conn.preparedQuery(CLOSE)
                        .execute(Tuple.of(tenantCode, caseId, at.atOffset(ZoneOffset.UTC), actor)))
                .map(rows -> rows.iterator().hasNext()))
                .await().atMost(QUERY_TIMEOUT);
    }

    private static EngineCase engineCase(Row r) {
        OffsetDateTime closed = r.getOffsetDateTime("closed_at");
        return new EngineCase(r.getLong("id"), r.getUUID("definition_id"), r.getString("version"),
                r.getString("name"), r.getString("family"), r.getString("asset_id"),
                r.getOffsetDateTime("at").toInstant(), r.getInteger("current_level"), r.getString("trip_id"),
                r.getDouble("latitude"), r.getDouble("longitude"), r.getDouble("speed_kmh"),
                closed == null ? null : closed.toInstant(), r.getLong("treatments"), r.getInteger("sla_minutes"),
                r.getLong("recurrence"), tripCode(r.getString("trip_mandate_codes"))).withTrip(trip(r))
                .withHold(hold(r), instant(r.getOffsetDateTime("returned_at")));
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
                r.getString("trip_origin"), r.getString("trip_destination"));
        return t.driver() == null && t.carrier() == null && t.origin() == null && t.destination() == null ? null : t;
    }

    static List<EngineCase.LevelStep> steps(JsonNode steps) {
        List<EngineCase.LevelStep> out = new ArrayList<>();
        if (steps == null || !steps.isArray()) {
            return out;
        }
        for (JsonNode step : steps) {
            try {
                out.add(new EngineCase.LevelStep(OffsetDateTime.parse(step.path("at").asText()).toInstant(),
                        step.path("level").asInt()));
            } catch (java.time.format.DateTimeParseException e) {
                LOG.debug("Engine case level step without a valid time", e);
            }
        }
        return out;
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
