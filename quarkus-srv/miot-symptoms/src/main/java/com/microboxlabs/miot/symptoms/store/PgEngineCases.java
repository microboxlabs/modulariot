package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore.CaseFilter;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;

/**
 * The evaluator's cases, from {@code miot_symptoms.signal_transitions}: an ACTIVE OPENED row is a case, open
 * until a CLOSED row for the same symptom and vehicle written after it (by id: signal and close times come
 * from different clocks).
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgEngineCases implements EngineCaseStore {

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
                   END AS recurrence
              FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.symptom_definition d ON d.id = o.definition_id AND d.tenant_code = o.tenant_code
             WHERE o.tenant_code = $1 AND o.kind = 'OPENED' AND o.state = 'ACTIVE'
            """;

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
    /** {@link CaseFilter}: $2 trip, $3 part of the vehicle id, $4 symptom name, $5 from, $6 to, $7 level. */
    private static final String MATCHING = "SELECT * FROM (" + WITH_SLA.formatted(SELECT.formatted(CASES + """
               AND ($2::text IS NULL OR o.trip_id = $2)
               AND ($3::text IS NULL OR o.asset_id ILIKE '%' || $3 || '%')
               AND ($4::text IS NULL OR lower(d.name) = lower($4))
               AND ($6::timestamptz IS NULL OR o.at < $6)
            """) + " WHERE ($5::timestamptz IS NOT NULL OR $6::timestamptz IS NOT NULL OR x.closed_id IS NULL)")
            + ") z WHERE ($7::int IS NULL OR z.current_level = $7)"
            + " AND ($5::timestamptz IS NULL OR z.closed_at IS NULL OR z.closed_at >= $5) ORDER BY z.at DESC LIMIT 200";
    private static final String COUNTS = "SELECT y.current_level, y.treatments > 0 AS under_treatment, count(*) AS n"
            + " FROM (" + SELECT.formatted(CASES) + " WHERE x.closed_id IS NULL) y GROUP BY 1, 2";
    private static final String ONE = WITH_SLA.formatted(SELECT.formatted(CASES + " AND o.id = $2"));
    private static final String OPENED = CASES + " AND o.at >= $2 AND o.at < $3";
    private static final String OPENED_COUNTS = "SELECT y.definition_id, y.current_level, count(*) AS n"
            + " FROM (" + SELECT.formatted(OPENED) + ") y GROUP BY 1, 2";
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

    @Override
    public List<EngineCase> open(String tenantCode) {
        List<EngineCase> out = new ArrayList<>();
        PgIds.query(pool.get(), OPEN, Tuple.of(tenantCode)).forEach(r -> out.add(engineCase(r)));
        return out;
    }

    @Override
    public List<EngineCase> list(String tenantCode, CaseFilter f) {
        List<EngineCase> out = new ArrayList<>();
        PgIds.query(pool.get(), MATCHING, Tuple.tuple().addString(tenantCode).addString(f.tripId())
                .addString(f.assetId()).addString(f.symptomName())
                .addOffsetDateTime(f.from() == null ? null : utc(f.from()))
                .addOffsetDateTime(f.to() == null ? null : utc(f.to())).addInteger(f.level()))
                .forEach(r -> out.add(engineCase(r)));
        return out;
    }

    @Override
    public List<OpenCount> openCounts(String tenantCode) {
        List<OpenCount> out = new ArrayList<>();
        PgIds.query(pool.get(), COUNTS, Tuple.of(tenantCode)).forEach(r -> out.add(new OpenCount(
                r.getInteger("current_level"), r.getBoolean("under_treatment"), r.getLong("n"))));
        return out;
    }

    @Override
    public Optional<EngineCase> find(String tenantCode, long caseId) {
        var rows = PgIds.query(pool.get(), ONE, Tuple.of(tenantCode, caseId)).iterator();
        return rows.hasNext() ? Optional.of(engineCase(rows.next())) : Optional.empty();
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
                r.getLong("recurrence"));
    }
}
