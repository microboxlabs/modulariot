package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
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

    /** State changes and sweeps wait for in-flight writes; vehicles still evaluate concurrently. */
    private static final String LOCK_DEFINITION = """
            SELECT id, state FROM miot_symptoms.symptom_definition
             WHERE tenant_code = $1 AND id = $2 FOR SHARE
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
                 trip_id, latitude, longitude, speed_kmh, context)
            SELECT $1::varchar, $2::uuid, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::timestamptz,
                   $8::integer, $9::integer, $10::double precision,
                   $11::varchar, $12::double precision, $13::double precision, $14::double precision, $15::jsonb
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

    /**
     * Writes the changes in one transaction, so a failed insert leaves none of them and the replayed signal
     * records and publishes them all.
     */
    @Override
    public List<Recorded> append(String tenantCode, List<Transition> transitions, Place place,
            Map<String, Object> context) {
        if (transitions.isEmpty()) {
            return List.of();
        }
        JsonObject json = context == null ? null : new JsonObject(context);
        return pool.get().withTransaction(conn -> {
            Uni<Void> locks = Uni.createFrom().voidItem();
            // Stable lock order also covers batches spanning more than one definition or vehicle.
            for (Transition t : transitions.stream().sorted(Comparator
                    .comparing((Transition t) -> t.definitionId().toString()).thenComparing(Transition::assetId))
                    .toList()) {
                locks = locks.flatMap(ignored -> conn.preparedQuery(LOCK_DEFINITION)
                        .execute(Tuple.of(tenantCode, t.definitionId())))
                        .invoke(rows -> checkCatalogState(t, rows))
                        .flatMap(ignored -> conn.preparedQuery(LOCK_CASES)
                                .execute(Tuple.of(tenantCode, t.definitionId(), t.assetId())))
                        .replaceWithVoid();
            }
            Uni<List<Recorded>> chain = locks.map(ignored -> new ArrayList<>());
            for (Transition t : transitions) {
                JsonObject own = t.detail() == null ? json : new JsonObject(t.detail());
                if (json != null && json.containsKey(EVENT_ID) && t.detail() != null) {
                    own.put(EVENT_ID, json.getString(EVENT_ID));
                }
                chain = chain.flatMap(recorded -> conn.preparedQuery(INSERT).execute(params(tenantCode, t, place, own))
                        .map(rows -> addRecorded(recorded, rows, t)));
            }
            return chain;
        }).await().atMost(QUERY_TIMEOUT);
    }

    /** A cached catalog must retry without saving a phantom episode; a replay duplicate still returns normally. */
    private static void checkCatalogState(Transition t, RowSet<Row> definitions) {
        boolean stateChangeClose = t.kind() == Transition.Kind.CLOSED && t.detail() != null
                && Transition.STATE_CHANGE_REASON.equals(t.detail().get("reason"));
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
                .addValue(t.measure()).addValue(place.tripId()).addValue(place.latitude())
                .addValue(place.longitude()).addValue(place.speedKmh()).addValue(context);
    }
}
