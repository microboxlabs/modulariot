package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.evaluator.Transition;
import com.microboxlabs.miot.symptoms.evaluator.TransitionLog;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.ZoneOffset;
import java.util.List;
import java.util.function.Supplier;

/**
 * The evaluator's case changes, in {@code miot_symptoms.signal_transitions}. A replayed signal
 * yields the same change at the same time, which is skipped: one per symptom, vehicle and signal.
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
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgTransitionLog(Instance<Pool> pool) {
        this(pool::get);
    }

    PgTransitionLog(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public void append(String tenantCode, List<Transition> transitions, Place place) {
        for (Transition t : transitions) {
            PgIds.query(pool.get(), INSERT, Tuple.tuple().addValue(tenantCode).addValue(t.definitionId())
                    .addValue(t.version()).addValue(t.state().name()).addValue(t.kind().name())
                    .addValue(t.assetId()).addValue(t.at().atOffset(ZoneOffset.UTC)).addValue(t.level())
                    .addValue(t.previousLevel()).addValue(t.measure()).addValue(place.tripId())
                    .addValue(place.latitude()).addValue(place.longitude()).addValue(place.speedKmh()));
        }
    }
}
