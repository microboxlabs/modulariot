package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.catalog.store.PgJson.QUERY_TIMEOUT;

import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * The evaluator's case changes, in {@code miot_symptoms.signal_transitions}. A replayed signal
 * yields the same change at the same time, which is skipped: one per symptom, vehicle and signal. A change's
 * case is the latest OPENED row of its symptom, vehicle and state.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgTransitionLog implements TransitionLog {

    private static final String INSERT = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh)
            SELECT $1::varchar, $2::uuid, $3::varchar, $4::varchar, $5::varchar, $6::varchar, $7::timestamptz,
                   $8::integer, $9::integer, $10::double precision,
                   $11::varchar, $12::double precision, $13::double precision, $14::double precision
            WHERE NOT EXISTS (
                SELECT 1 FROM miot_symptoms.signal_transitions
                WHERE definition_id = $2::uuid AND at = $7::timestamptz AND asset_id = $6::varchar
                  AND tenant_code = $1::varchar)
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
    public List<Recorded> append(String tenantCode, List<Transition> transitions, Place place) {
        if (transitions.isEmpty()) {
            return List.of();
        }
        return pool.get().withTransaction(conn -> {
            Uni<List<Recorded>> chain = Uni.createFrom().item(new ArrayList<>());
            for (Transition t : transitions) {
                chain = chain.flatMap(recorded -> conn.preparedQuery(INSERT).execute(params(tenantCode, t, place))
                        .map(rows -> {
                            for (Row r : rows) {
                                Long caseId = r.getLong("case_id");
                                if (caseId != null) {
                                    recorded.add(new Recorded(t, caseId));
                                }
                            }
                            return recorded;
                        }));
            }
            return chain;
        }).await().atMost(QUERY_TIMEOUT);
    }

    private static Tuple params(String tenantCode, Transition t, Place place) {
        return Tuple.tuple().addValue(tenantCode).addValue(t.definitionId()).addValue(t.version())
                .addValue(t.state().name()).addValue(t.kind().name()).addValue(t.assetId())
                .addValue(t.at().atOffset(ZoneOffset.UTC)).addValue(t.level()).addValue(t.previousLevel())
                .addValue(t.measure()).addValue(place.tripId()).addValue(place.latitude())
                .addValue(place.longitude()).addValue(place.speedKmh());
    }
}
