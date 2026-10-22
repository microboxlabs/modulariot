package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.EngineCaseStore;
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
 * until a CLOSED row for the same symptom and vehicle at or after it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgEngineCases implements EngineCaseStore {

    private static final String SELECT = """
            SELECT o.id, o.definition_id, o.version, o.asset_id, o.at, o.level, o.trip_id, o.latitude, o.longitude,
                   o.speed_kmh, d.name, d.family,
                   (SELECT c.at FROM miot_symptoms.signal_transitions c
                     WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                       AND c.asset_id = o.asset_id AND c.kind = 'CLOSED' AND c.at >= o.at
                     ORDER BY c.at LIMIT 1) AS closed_at,
                   (SELECT count(*) FROM miot_symptoms.treatment t
                     WHERE t.tenant_code = o.tenant_code AND t.symptom_id = -o.id) AS treatments
              FROM miot_symptoms.signal_transitions o
              JOIN miot_symptoms.symptom_definition d ON d.id = o.definition_id AND d.tenant_code = o.tenant_code
             WHERE o.tenant_code = $1 AND o.kind = 'OPENED' AND o.state = 'ACTIVE'
            """;

    private static final String OPEN = "SELECT * FROM (" + SELECT
            + ") x WHERE closed_at IS NULL ORDER BY at DESC LIMIT 200";
    private static final String ONE = SELECT + " AND o.id = $2";

    private static final String CLOSE = """
            INSERT INTO miot_symptoms.signal_transitions
                (tenant_code, definition_id, version, state, kind, asset_id, at, level, previous_level, measure,
                 trip_id, latitude, longitude, speed_kmh, closed_by)
            SELECT tenant_code, definition_id, version, state, 'CLOSED', asset_id, $3, level, level, measure,
                   trip_id, latitude, longitude, speed_kmh, $4
              FROM miot_symptoms.signal_transitions WHERE tenant_code = $1 AND id = $2 AND kind = 'OPENED'
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
    public Optional<EngineCase> find(String tenantCode, long caseId) {
        var rows = PgIds.query(pool.get(), ONE, Tuple.of(tenantCode, caseId)).iterator();
        return rows.hasNext() ? Optional.of(engineCase(rows.next())) : Optional.empty();
    }

    /** Records that an operator closed the case at {@code at}. */
    @Override
    public void close(String tenantCode, long caseId, String actor, Instant at) {
        PgIds.query(pool.get(), CLOSE, Tuple.of(tenantCode, caseId, at.atOffset(ZoneOffset.UTC), actor));
    }

    private static EngineCase engineCase(Row r) {
        OffsetDateTime closed = r.getOffsetDateTime("closed_at");
        return new EngineCase(r.getLong("id"), r.getUUID("definition_id"), r.getString("version"),
                r.getString("name"), r.getString("family"), r.getString("asset_id"),
                r.getOffsetDateTime("at").toInstant(), r.getInteger("level"), r.getString("trip_id"),
                r.getDouble("latitude"), r.getDouble("longitude"), r.getDouble("speed_kmh"),
                closed == null ? null : closed.toInstant(), r.getLong("treatments"));
    }
}
