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

/** The evaluator's case changes, in {@code miot_symptoms.signal_transitions}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgTransitionLog implements TransitionLog {

    private static final String INSERT = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
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
    public void record(String tenantCode, List<Transition> transitions, Place place) {
        for (Transition t : transitions) {
            PgIds.query(pool.get(), INSERT, Tuple.tuple().addValue(tenantCode).addValue(t.definitionId())
                    .addValue(t.version()).addValue(t.state().name()).addValue(t.kind().name())
                    .addValue(t.assetId()).addValue(t.at().atOffset(ZoneOffset.UTC)).addValue(t.level())
                    .addValue(t.previousLevel()).addValue(t.measure()).addValue(place.tripId())
                    .addValue(place.latitude()).addValue(place.longitude()).addValue(place.speedKmh()));
        }
    }
}
