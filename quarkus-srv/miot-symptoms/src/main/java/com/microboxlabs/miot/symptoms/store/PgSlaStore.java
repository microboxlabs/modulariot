package com.microboxlabs.miot.symptoms.store;

import com.microboxlabs.miot.symptoms.cases.EngineCase;
import com.microboxlabs.miot.symptoms.cases.SlaStore;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.function.Supplier;

/**
 * The SLA timer's reads over {@code miot_symptoms.signal_transitions} and its marks in
 * {@code miot_symptoms.sla_expiry}. A level has an SLA when its version's response has {@code operator} and
 * {@code slaMinutes}. A case is attended at its level when a treatment on it is open, or was opened at or after
 * the case reached the level.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgSlaStore implements SlaStore {

    private static final String DUE = """
            WITH open_case AS (
                SELECT o.id, o.tenant_code, o.definition_id, o.version, o.asset_id, o.at, o.trip_id,
                       o.latitude, o.longitude, o.speed_kmh,
                       COALESCE(l.level, o.level) AS current_level, COALESCE(l.at, o.at) AS level_since
                  FROM miot_symptoms.signal_transitions o
                  LEFT JOIN LATERAL (
                      SELECT c.level, c.at FROM miot_symptoms.signal_transitions c
                       WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                         AND c.asset_id = o.asset_id AND c.state = 'ACTIVE' AND c.kind = 'LEVEL_CHANGED'
                         AND c.id > o.id
                       ORDER BY c.id DESC LIMIT 1) l ON true
                 WHERE o.kind = 'OPENED' AND o.state = 'ACTIVE' AND o.at > $1
                   AND NOT EXISTS (
                       SELECT 1 FROM miot_symptoms.signal_transitions c
                        WHERE c.tenant_code = o.tenant_code AND c.definition_id = o.definition_id
                          AND c.asset_id = o.asset_id AND c.state = 'ACTIVE' AND c.kind = 'CLOSED'
                          AND c.id > o.id)),
            with_sla AS (
                SELECT x.*, (SELECT (lv->'response'->>'slaMinutes')::integer
                               FROM miot_symptoms.symptom_version v, jsonb_array_elements(v.spec->'levels') lv
                              WHERE v.tenant_code = x.tenant_code AND v.definition_id = x.definition_id
                                AND v.version = x.version AND v.status = 'PUBLISHED'
                                AND (lv->>'icu')::integer = x.current_level
                                AND (lv->'response'->>'operator')::boolean
                              LIMIT 1) AS sla_minutes
                  FROM open_case x)
            SELECT y.* FROM with_sla y
             WHERE y.sla_minutes > 0
               AND y.level_since + make_interval(mins => y.sla_minutes) <= $2
               AND NOT EXISTS (
                     SELECT 1 FROM miot_symptoms.sla_expiry e
                      WHERE e.tenant_code = y.tenant_code AND e.case_id = y.id AND e.level = y.current_level)
               AND NOT EXISTS (
                     SELECT 1 FROM miot_symptoms.treatment t
                      WHERE t.tenant_code = y.tenant_code AND t.symptom_id = -y.id
                        AND (t.status = 'OPEN' OR t.opened_at >= y.level_since))
             ORDER BY y.level_since
             LIMIT $3
            """;

    private static final String MARK = """
            INSERT INTO miot_symptoms.sla_expiry (tenant_code, case_id, level, sla_minutes, expired_at)
            VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT DO NOTHING
            RETURNING case_id
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgSlaStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgSlaStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<Due> due(Instant openedAfter, Instant now, int limit) {
        List<Due> out = new ArrayList<>();
        PgIds.query(pool.get(), DUE, Tuple.of(openedAfter.atOffset(ZoneOffset.UTC), now.atOffset(ZoneOffset.UTC),
                limit)).forEach(r -> out.add(due(r)));
        return out;
    }

    @Override
    public boolean markExpired(String tenantCode, long caseId, int level, int slaMinutes, Instant at) {
        return PgIds.query(pool.get(), MARK, Tuple.of(tenantCode, caseId, level, slaMinutes,
                at.atOffset(ZoneOffset.UTC))).iterator().hasNext();
    }

    private static Due due(Row r) {
        EngineCase c = new EngineCase(r.getLong("id"), r.getUUID("definition_id"), r.getString("version"), null,
                null, r.getString("asset_id"), r.getOffsetDateTime("at").toInstant(), r.getInteger("current_level"),
                r.getString("trip_id"), r.getDouble("latitude"), r.getDouble("longitude"), r.getDouble("speed_kmh"),
                null, 0, r.getInteger("sla_minutes"), null);
        return new Due(r.getString("tenant_code"), c, r.getOffsetDateTime("level_since").toInstant(),
                r.getInteger("sla_minutes"));
    }
}
