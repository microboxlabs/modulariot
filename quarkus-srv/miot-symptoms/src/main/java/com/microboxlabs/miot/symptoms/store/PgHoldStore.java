package com.microboxlabs.miot.symptoms.store;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.symptoms.cases.HoldStore;
import com.microboxlabs.miot.symptoms.cases.IgnoreHold;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import io.vertx.pgclient.PgException;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.function.Supplier;
import org.jboss.logging.Logger;

/** The open holds ({@link HoldSql}) in {@code miot_symptoms.treatment}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgHoldStore implements HoldStore {

    private static final Logger LOG = Logger.getLogger(PgHoldStore.class);
    private static final ObjectMapper JSON = new ObjectMapper();

    private static final String SELECT = """
            SELECT t.id::text AS id, t.tenant_code, h.id AS case_id, h.asset_id, h.definition_id, h.trip_id,
                   a.performed_at, a.performed_by, a.duration_seconds, a.details::text AS details,
                   EXISTS (SELECT 1 FROM miot_symptoms.signal_transitions c
                            WHERE c.tenant_code = h.tenant_code AND c.definition_id = h.definition_id
                              AND c.asset_id = h.asset_id AND c.state = h.state AND c.kind = 'CLOSED'
                              AND c.id > h.id) AS case_closed
            """ + HoldSql.HOLDS + " AND t.status = 'OPEN'";
    private static final String BY_TENANT = SELECT + " AND t.tenant_code = $1";
    private static final String ALL = SELECT + " ORDER BY a.performed_at LIMIT $1";
    private static final String ONE = SELECT + " AND t.tenant_code = $1 AND t.id = $2::uuid";
    private static final String TRIP = """
            SELECT 1 FROM miot_trips.trip_live WHERE tenant_code = $1 AND trip_id::text = $2 AND asset_id = $3
            """;

    private final Supplier<Pool> pool;

    @Inject
    PgHoldStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgHoldStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public List<IgnoreHold> open(String tenantCode) {
        return holds(BY_TENANT, Tuple.of(tenantCode));
    }

    @Override
    public List<IgnoreHold> open(int limit) {
        return holds(ALL, Tuple.of(limit));
    }

    @Override
    public Optional<IgnoreHold> find(String tenantCode, String treatmentId) {
        if (PgIds.parse(treatmentId) == null) {
            return Optional.empty();
        }
        return holds(ONE, Tuple.of(tenantCode, treatmentId)).stream().findFirst();
    }

    @Override
    public Optional<Boolean> tripLive(String tenantCode, String tripId, String assetId) {
        try {
            return Optional.of(PgIds.query(pool.get(), TRIP, Tuple.of(tenantCode, tripId, assetId)).iterator()
                    .hasNext());
        } catch (PgException e) {
            if ("42P01".equals(e.getSqlState()) || "3F000".equals(e.getSqlState())) {
                LOG.debug("Trip state unknown: trips unavailable", e);
                return Optional.empty();
            }
            throw e;
        }
    }

    private List<IgnoreHold> holds(String sql, Tuple args) {
        List<IgnoreHold> out = new ArrayList<>();
        PgIds.query(pool.get(), sql, args).forEach(r -> out.add(hold(r)));
        return out;
    }

    private static IgnoreHold hold(Row r) {
        JsonNode details = details(r.getString("details"));
        return new IgnoreHold(r.getString("id"), r.getString("tenant_code"), r.getLong("case_id"),
                r.getString("asset_id"), r.getUUID("definition_id"), r.getString("trip_id"),
                scope(details.path("scope").asText(null)), r.getOffsetDateTime("performed_at").toInstant(),
                r.getString("performed_by"), r.getInteger("duration_seconds"),
                details.path("until_trip_end").asBoolean(false), r.getBoolean("case_closed"));
    }

    /** A stored scope this version does not know holds the case only. */
    private static IgnoreHold.Scope scope(String value) {
        try {
            return IgnoreHold.Scope.parse(value);
        } catch (IllegalArgumentException e) {
            return IgnoreHold.Scope.CASE;
        }
    }

    private static JsonNode details(String text) {
        try {
            return text == null ? JSON.createObjectNode() : JSON.readTree(text);
        } catch (JsonProcessingException e) {
            return JSON.createObjectNode();
        }
    }
}
