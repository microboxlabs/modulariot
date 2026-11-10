package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.microboxlabs.miot.symptoms.catalog.domain.SymptomSpec.Lifecycle;
import com.microboxlabs.miot.symptoms.evaluator.Episode;
import com.microboxlabs.miot.symptoms.evaluator.OperatorClose;
import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import com.microboxlabs.miot.symptoms.lostsignal.TripEnds;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.SqlConnection;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * The evaluator's case changes, in {@code miot_symptoms.signal_transitions}. A replayed signal
 * yields the same change at the same time, which is skipped: one per symptom, vehicle and signal, and one note
 * ({@code NOTED}) besides. A change's
 * case is the latest OPENED row of its symptom, vehicle and state.
 *
 * <p>A stale catalog retries the batch before its episodes can be saved: an opening must use the symptom's
 * current state, and a state-change closure must close an earlier state. A level change, note or close is
 * skipped unless its case is the vehicle's latest case of that symptom, open and in the same state. So no row
 * is written in a state other than its case's OPENED row, and a case closed after a state change closes once.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgTransitionLog implements TransitionLog {
    private static final String EVENT_ID = "event_id";
    private static final String REASON_KEY = "reason";
    private static final String CHECK_TRIP_ASSET = """
            SELECT asset_id FROM miot_trips.trip_live WHERE tenant_code = $1 AND trip_id = $2 FOR SHARE
            """;

    /** State changes and sweeps wait for in-flight writes; vehicles still evaluate concurrently. */
    private static final String LOCK_DEFINITION = """
            SELECT d.id, d.state,
                   (CASE jsonb_typeof(v.spec) WHEN 'string' THEN (v.spec #>> '{}')::jsonb ELSE v.spec END)
                       #>> '{lifecycle,after_trip_end}' AS after_trip_end
              FROM miot_symptoms.symptom_definition d
              LEFT JOIN miot_symptoms.symptom_version v ON v.definition_id = d.id
                   AND v.tenant_code = d.tenant_code AND v.version = $3
             WHERE d.tenant_code = $1 AND d.id = $2 FOR SHARE OF d
            """;
    /** The operator locks the same OPENED rows before closing a case. */
    private static final String LOCK_CASES = """
            SELECT id FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND definition_id = $2 AND asset_id = $3 AND kind = 'OPENED'
             ORDER BY id FOR UPDATE
            """;

    private static final String INSERT = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh, context, operator_required, closed_by)
            SELECT $1::varchar, $2::uuid, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::timestamptz,
                   $8::integer, $9::integer, $10::double precision,
                   $11::varchar, $12::double precision, $13::double precision, $14::double precision, $15::jsonb,
                   $16::boolean, $17::varchar
            WHERE NOT EXISTS (
                SELECT 1 FROM miot_symptoms.signal_transitions
                WHERE definition_id = $2::uuid AND asset_id = $6::varchar
                  AND tenant_code = $1::varchar AND (kind = 'NOTED') = ($5::varchar = 'NOTED')
                  AND ((context ->> 'event_id' IS NULL AND $15::jsonb ->> 'event_id' IS NULL
                        AND at = $7::timestamptz)
                       OR (context ->> 'event_id' = $15::jsonb ->> 'event_id')))
              AND ($5::varchar <> 'OPENED' OR NOT EXISTS (
                SELECT 1 FROM miot_symptoms.symptom_definition d
                WHERE d.tenant_code = $1::varchar AND d.id = $2::uuid AND d.state <> $4::varchar))
              AND ($5::varchar IN ('OPENED', 'HELD') OR EXISTS (
                SELECT 1 FROM (SELECT o.id, o.state FROM miot_symptoms.signal_transitions o
                                WHERE o.tenant_code = $1::varchar AND o.definition_id = $2::uuid
                                  AND o.asset_id = $6::varchar AND o.kind = 'OPENED'
                                ORDER BY o.id DESC LIMIT 1) latest
                WHERE latest.state = $4::varchar AND NOT EXISTS (
                    SELECT 1 FROM miot_symptoms.signal_transitions c
                    WHERE c.tenant_code = $1::varchar AND c.definition_id = $2::uuid AND c.asset_id = $6::varchar
                      AND c.state = $4::varchar AND c.kind = 'CLOSED' AND c.id > latest.id)))
            ON CONFLICT DO NOTHING
            RETURNING id, CASE WHEN kind = 'OPENED' THEN id ELSE (
                SELECT o.id FROM miot_symptoms.signal_transitions o
                WHERE o.tenant_code = $1::varchar AND o.definition_id = $2::uuid AND o.asset_id = $6::varchar
                  AND o.state = $4::varchar AND o.kind = 'OPENED'
                ORDER BY o.id DESC LIMIT 1) END AS case_id
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgTransitionLog(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTransitionLog(Supplier<Pool> pool) {
        this.pool = pool;
    }

    /** The symptom's newest OPENED or CLOSED row on the vehicle. */
    private static final String LAST_CASE_ROW = """
            SELECT kind, trip_id, at, context FROM miot_symptoms.signal_transitions
             WHERE tenant_code = $1 AND definition_id = $2 AND asset_id = $3 AND kind IN ('OPENED', 'CLOSED')
             ORDER BY id DESC LIMIT 1
            """;

    @Override
    public Optional<OperatorClose> lastOperatorClose(String tenantCode, String assetId, UUID definitionId) {
        var rows = pool.get().preparedQuery(LAST_CASE_ROW).execute(Tuple.of(tenantCode, definitionId, assetId))
                .await().atMost(QUERY_TIMEOUT).iterator();
        if (!rows.hasNext()) {
            return Optional.empty();
        }
        Row row = rows.next();
        JsonObject context = row.getJsonObject("context");
        if (!"CLOSED".equals(row.getString("kind")) || context == null) {
            return Optional.empty();
        }
        return OperatorClose.fromContext(row.getString("trip_id"), row.getOffsetDateTime("at").toInstant(),
                context.getMap());
    }

    @Override
    public Opening opening(String tenantCode, Episode episode) {
        var rows = pool.get().preparedQuery("""
                SELECT o.trip_id, COALESCE(e.context, o.context) AS context
                  FROM miot_symptoms.signal_transitions o
                  LEFT JOIN LATERAL (
                      SELECT l.context FROM miot_symptoms.signal_transitions l
                       WHERE l.tenant_code = o.tenant_code AND l.definition_id = o.definition_id
                         AND l.asset_id = o.asset_id AND l.state = o.state AND l.kind = 'LEVEL_CHANGED'
                         AND l.id > o.id AND l.context IS NOT NULL
                         AND NOT EXISTS (SELECT 1 FROM miot_symptoms.signal_transitions boundary
                              WHERE boundary.tenant_code = o.tenant_code AND boundary.definition_id = o.definition_id
                                AND boundary.asset_id = o.asset_id AND boundary.state = o.state
                                AND boundary.kind IN ('OPENED', 'CLOSED') AND boundary.id > o.id AND boundary.id < l.id)
                       ORDER BY l.id DESC LIMIT 1) e ON true
                 WHERE o.tenant_code = $1 AND o.definition_id = $2 AND o.asset_id = $3 AND o.kind = 'OPENED' AND o.at = $4
                 ORDER BY o.id DESC LIMIT 1
                """).execute(Tuple.of(tenantCode, episode.definitionId(), episode.assetId(),
                        episode.openedAt().atOffset(ZoneOffset.UTC))).await().atMost(QUERY_TIMEOUT);
        var iterator = rows.iterator();
        if (iterator.hasNext()) {
            Row row = iterator.next();
            JsonObject context = row.getJsonObject("context");
            return new Opening(row.getString("trip_id"), context == null ? Map.of() : context.getMap());
        }
        return new Opening(null, Map.of());
    }

    /**
     * Writes the changes in one transaction, so a failed insert leaves none of them and the replayed signal
     * records and publishes them all.
     */
    @Override
    public List<Recorded> append(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        return append(tenantCode, transitions, place, context, false, false, () -> Uni.createFrom().voidItem()).recorded();
    }

    @Override
    public List<Recorded> appendTripCheck(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        return append(tenantCode, transitions, place, context, true, false, () -> Uni.createFrom().voidItem()).recorded();
    }

    @Override
    public Appended appendEvaluated(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        return append(tenantCode, transitions, place, context, false, true, () -> Uni.createFrom().voidItem());
    }

    @Override
    public Appended appendEvaluated(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context, Supplier<Uni<Void>> validation) {
        return append(tenantCode, transitions, place, context, false, true, validation);
    }

    @Override
    public List<Recorded> appendTripCheck(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context, Supplier<Uni<Void>> validation) {
        return append(tenantCode, transitions, place, context, true, false, validation).recorded();
    }

    @Override
    public boolean tripEnded(String tenant, String tripId) {
        return pool.get().withTransaction(conn -> PgTripState.lock(conn, tenant, tripId)
                .map(window -> window.managed() && window.ended())).await().atMost(QUERY_TIMEOUT);
    }

    private Appended append(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context, boolean checkTrip, boolean evaluated, Supplier<Uni<Void>> validation) {
        if (transitions.isEmpty()) return new Appended(List.of(), Set.of());
        boolean opening = transitions.stream().anyMatch(t -> t.kind() == Transition.Kind.OPENED);
        return pool.get().withTransaction(conn -> {
            Uni<PgTripState.Window> trip = checkTrip || (evaluated && opening)
                    ? PgTripState.lock(conn, tenantCode, place.tripId())
                    : Uni.createFrom().item(new PgTripState.Window(false, false, null, null));
            Uni<Void> assetCheck = checkTrip ? lockTripAsset(conn, tenantCode, place, transitions)
                    : Uni.createFrom().voidItem();
            return trip.invoke(window -> {
                if (checkTrip && (!window.managed() || window.ended())) {
                    throw new IllegalStateException("Trip ended; retry the lost-signal check");
                }
            }).flatMap(assetCheck::replaceWith)
                    .flatMap(window -> write(conn, tenantCode, transitions, place, context, window, evaluated, validation));
        }).await().atMost(QUERY_TIMEOUT);
    }

    /** Read the projection after the trip lock so a truck change we waited for is visible. */
    private static Uni<Void> lockTripAsset(SqlConnection conn, String tenant, Place place,
            List<Transition> transitions) {
        return conn.preparedQuery(CHECK_TRIP_ASSET).execute(Tuple.of(tenant, TripEnds.uuid(place.tripId())))
                .invoke(rows -> {
                    for (Row row : rows) {
                        String asset = row.getString("asset_id");
                        if (asset != null && transitions.stream().anyMatch(t -> !asset.equalsIgnoreCase(t.assetId()))) {
                            throw new IllegalStateException("Trip truck changed; retry the lost-signal check");
                        }
                    }
                }).replaceWithVoid();
    }

    @SuppressWarnings("java:S107") // Locked transaction, write policy and snapshot validation.
    private Uni<Appended> write(SqlConnection conn, String tenant, List<Transition> transitions, Place place,
            Map<String, Object> context, PgTripState.Window trip, boolean evaluated, Supplier<Uni<Void>> validation) {
        Map<Transition, String> policies = new HashMap<>();
        Uni<Void> locks = Uni.createFrom().voidItem();
        // Trip, definitions and cases always lock in the same order as trip-end closure.
        for (Transition t : transitions.stream().sorted(Comparator
                .comparing((Transition t) -> t.definitionId().toString()).thenComparing(Transition::assetId)).toList()) {
            locks = locks.flatMap(ignored -> conn.preparedQuery(LOCK_DEFINITION)
                    .execute(Tuple.of(tenant, t.definitionId(), t.version())))
                    .invoke(rows -> {
                        checkCatalogState(t, rows);
                        for (Row row : rows) policies.put(t, row.getString("after_trip_end"));
                    })
                    .flatMap(ignored -> conn.preparedQuery(LOCK_CASES)
                            .execute(Tuple.of(tenant, t.definitionId(), t.assetId())))
                    .replaceWithVoid();
        }
        List<Recorded> recorded = new ArrayList<>();
        Set<UUID> discarded = new HashSet<>();
        Uni<Void> writes = locks.flatMap(ignored -> validation.get());
        for (Transition t : transitions) {
            writes = writes.flatMap(ignored -> persist(conn, tenant, t, place, context, trip,
                    evaluated ? policies.get(t) : null, evaluated, recorded, discarded));
        }
        return writes.replaceWith(() -> new Appended(List.copyOf(recorded), Set.copyOf(discarded)));
    }

    /** Only the spec chooses a policy; Java supplies the authoritative interval and processing-time facts. */
    @SuppressWarnings("java:S107")
    private Uni<Void> persist(SqlConnection conn, String tenant, Transition t, Place place,
            Map<String, Object> context, PgTripState.Window trip, String policy, boolean evaluated,
            List<Recorded> recorded, Set<UUID> discarded) {
        if (!evaluated || !trip.ended() || t.kind() != Transition.Kind.OPENED) {
            return writeOne(conn, tenant, t, place, context, recorded);
        }
        if (!trip.contains(t.at()) || !(Lifecycle.KEEP.equals(policy) || Lifecycle.OPEN_AND_CLOSE.equals(policy))) {
            discarded.add(t.definitionId());
            return Uni.createFrom().voidItem();
        }
        Map<String, Object> evidence = new LinkedHashMap<>();
        if (context != null) evidence.putAll(context);
        if (t.detail() != null) evidence.putAll(t.detail());
        evidence.put("after_trip_end", policy);
        evidence.put("trip_ended_at", trip.end().toString());
        evidence.put("processed_at", Instant.now().toString());
        Transition opening = t.withDetail(evidence);
        int before = recorded.size();
        if (Lifecycle.OPEN_AND_CLOSE.equals(policy)) discarded.add(t.definitionId());
        return writeOne(conn, tenant, opening, place, null, recorded).flatMap(ignored -> {
            if (!Lifecycle.OPEN_AND_CLOSE.equals(policy) || recorded.size() == before) return Uni.createFrom().voidItem();
            return closeLate(conn, tenant, opening, place, recorded);
        });
    }

    /** Open, note and close commit together; a replay never appends another note or close. */
    private Uni<Void> closeLate(SqlConnection conn, String tenant, Transition opening, Place place,
            List<Recorded> recorded) {
        Map<String, Object> noted = new LinkedHashMap<>(opening.detail());
        noted.put("note", Map.of("event_type", TripEnds.REASON,
                "description", "Evento ocurrido durante el viaje y recibido después de su fin",
                "at", opening.at().toString()));
        Transition note = new Transition(Transition.Kind.NOTED, opening.definitionId(), opening.version(),
                opening.state(), opening.assetId(), opening.at(), opening.level(), opening.level(),
                opening.measure(), noted, opening.tripId());
        Map<String, Object> closed = new LinkedHashMap<>(opening.detail());
        closed.remove(EVENT_ID);
        closed.put(REASON_KEY, TripEnds.REASON);
        Instant at = Instant.now();
        if (!at.isAfter(opening.at().plusNanos(1000))) at = opening.at().plusNanos(1000);
        Transition close = new Transition(Transition.Kind.CLOSED, opening.definitionId(), opening.version(),
                opening.state(), opening.assetId(), at, opening.level(), opening.level(), opening.measure(), closed,
                opening.tripId());
        return writeOne(conn, tenant, note, place, null, recorded)
                .flatMap(ignored -> writeOne(conn, tenant, close, place, null, recorded));
    }

    private Uni<Void> writeOne(SqlConnection conn, String tenant, Transition t, Place place,
            Map<String, Object> context, List<Recorded> recorded) {
        Map<String, Object> values = t.detail() == null ? context : t.detail();
        JsonObject own = values == null ? null : new JsonObject(new LinkedHashMap<>(values));
        if (context != null && context.containsKey(EVENT_ID) && own != null) own.put(EVENT_ID, context.get(EVENT_ID));
        return conn.preparedQuery(INSERT).execute(params(tenant, t, place, own))
                .invoke(rows -> addRecorded(recorded, rows, t)).replaceWithVoid();
    }

    /** A cached catalog must retry without saving a phantom episode; a replay duplicate still returns normally. */
    private static void checkCatalogState(Transition t, RowSet<Row> definitions) {
        boolean stateChangeClose = t.kind() == Transition.Kind.CLOSED && t.detail() != null
                && Transition.STATE_CHANGE_REASON.equals(t.detail().get(REASON_KEY));
        for (Row d : definitions) {
            boolean currentState = t.state().name().equals(d.getString("state"));
            if ((t.kind() == Transition.Kind.OPENED && !currentState) || (stateChangeClose && currentState)) {
                throw new IllegalStateException("Symptom state changed; retry with a fresh catalog");
            }
        }
    }

    private static List<Recorded> addRecorded(List<Recorded> recorded, RowSet<Row> rows, Transition transition) {
        for (Row row : rows) {
            Long caseId = row.getLong("case_id");
            if (caseId != null) {
                recorded.add(new Recorded(transition, caseId));
            }
        }
        return recorded;
    }

    private static Tuple params(String tenantCode, Transition t, Place place, JsonObject context) {
        return Tuple.tuple().addValue(tenantCode).addValue(t.definitionId()).addValue(t.version())
                .addValue(t.state().name()).addValue(t.kind().name()).addValue(t.assetId())
                .addValue(t.at().atOffset(ZoneOffset.UTC)).addValue(t.level()).addValue(t.previousLevel())
                .addValue(t.measure()).addValue(place.of(t).tripId()).addValue(place.latitude())
                .addValue(place.longitude()).addValue(place.speedKmh()).addValue(context).addValue(t.operator())
                .addValue(t.kind() == Transition.Kind.CLOSED && t.detail() != null
                        && TripEnds.REASON.equals(t.detail().get(REASON_KEY)) ? TripEnds.REASON : null);
    }
}
