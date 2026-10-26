package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.trips.domain.MonitorSelector;
import com.microboxlabs.miot.trips.domain.TripMonitor;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

/** {@link MonitorStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgMonitorStore implements MonitorStore {

    private static final String SELECT = "SELECT ";

    private static final String COLUMNS = """
            tenant_code, monitor_key, version, status, name, description, plan, params, rules,
            created_at, created_by, updated_at, updated_by, published_at, published_by""";
    private static final TypeReference<List<TripMonitor.StagePlan>> PLAN = new TypeReference<>() {
    };
    private static final TypeReference<Map<String, Object>> PARAMS = new TypeReference<>() {
    };
    private static final TypeReference<List<TripMonitor.Rule>> RULES = new TypeReference<>() {
    };

    private final Supplier<Pool> pool;

    @Inject
    PgMonitorStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgMonitorStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public void lock(String tenantCode, String monitorKey) {
        lockMonitor(pool.get(), tenantCode, monitorKey);
    }

    static void lockMonitor(Pool pool, String tenantCode, String monitorKey) {
        query(pool, "SELECT pg_advisory_xact_lock(hashtextextended($1, 0))",
                Tuple.of("trips-monitor:" + tenantCode.length() + ":" + tenantCode + ":" + monitorKey));
    }

    @Override
    public List<TripMonitor> all(String tenantCode) {
        return query(pool.get(), SELECT + COLUMNS + " FROM miot_trips.trip_monitor WHERE tenant_code = $1"
                + " ORDER BY monitor_key, version DESC", Tuple.of(tenantCode))
                .stream().map(PgMonitorStore::monitor).toList();
    }

    @Override
    public List<TripMonitor> versions(String tenantCode, String monitorKey) {
        return query(pool.get(), SELECT + COLUMNS + " FROM miot_trips.trip_monitor"
                + " WHERE tenant_code = $1 AND monitor_key = $2 ORDER BY version DESC",
                Tuple.of(tenantCode, monitorKey)).stream().map(PgMonitorStore::monitor).toList();
    }

    @Override
    public Optional<TripMonitor> version(String tenantCode, String monitorKey, int version) {
        return query(pool.get(), SELECT + COLUMNS + " FROM miot_trips.trip_monitor"
                + " WHERE tenant_code = $1 AND monitor_key = $2 AND version = $3",
                Tuple.of(tenantCode, monitorKey, version)).stream().map(PgMonitorStore::monitor).findFirst();
    }

    @Override
    public TripMonitor saveDraft(TripMonitor d) {
        return query(pool.get(), """
                INSERT INTO miot_trips.trip_monitor
                    (tenant_code, monitor_key, version, status, name, description, plan, params, rules,
                     created_by, updated_by)
                SELECT $1::varchar, $2::varchar, COALESCE(MAX(version), 0) + 1, 'draft', $3, $4, $5::text::jsonb, $6::text::jsonb,
                       $7::text::jsonb, $8, $8
                FROM miot_trips.trip_monitor WHERE tenant_code = $1 AND monitor_key = $2
                ON CONFLICT (tenant_code, monitor_key) WHERE status = 'draft' DO UPDATE SET
                    name = EXCLUDED.name, description = EXCLUDED.description, plan = EXCLUDED.plan,
                    params = EXCLUDED.params, rules = EXCLUDED.rules, updated_by = EXCLUDED.updated_by,
                    updated_at = now()
                RETURNING\s""" + COLUMNS,
                Tuple.tuple().addString(d.tenantCode()).addString(d.monitorKey()).addString(d.name())
                        .addString(d.description()).addString(Pg.json(d.plan())).addString(Pg.json(d.params()))
                        .addString(Pg.json(d.rules())).addString(d.updatedBy()))
                .stream().map(PgMonitorStore::monitor).findFirst().orElseThrow();
    }

    @Override
    public Optional<TripMonitor> publish(String tenantCode, String monitorKey, String actor) {
        return query(pool.get(), """
                UPDATE miot_trips.trip_monitor SET status = 'published', published_at = now(), published_by = $3,
                    updated_at = now(), updated_by = $3
                WHERE tenant_code = $1 AND monitor_key = $2 AND status = 'draft'
                RETURNING\s""" + COLUMNS, Tuple.of(tenantCode, monitorKey, actor))
                .stream().map(PgMonitorStore::monitor).findFirst();
    }

    @Override
    public boolean deleteDraft(String tenantCode, String monitorKey) {
        return query(pool.get(), "DELETE FROM miot_trips.trip_monitor"
                + " WHERE tenant_code = $1 AND monitor_key = $2 AND status = 'draft'",
                Tuple.of(tenantCode, monitorKey)).rowCount() > 0;
    }

    @Override
    public List<MonitorSelector> selector(String tenantCode) {
        return query(pool.get(), "SELECT seq, condition, monitor_key FROM miot_trips.trip_monitor_selector"
                + " WHERE tenant_code = $1 ORDER BY seq", Tuple.of(tenantCode)).stream()
                .map(r -> new MonitorSelector(r.getInteger("seq"), r.getString("condition"),
                        r.getString("monitor_key")))
                .toList();
    }

    @Override
    public void saveSelector(String tenantCode, List<MonitorSelector> entries, String actor) {
        query(pool.get(), "DELETE FROM miot_trips.trip_monitor_selector WHERE tenant_code = $1",
                Tuple.of(tenantCode));
        for (MonitorSelector e : entries) {
            query(pool.get(), """
                    INSERT INTO miot_trips.trip_monitor_selector (tenant_code, seq, condition, monitor_key, updated_by)
                    VALUES ($1, $2, $3, $4, $5)""",
                    Tuple.of(tenantCode, e.seq(), e.condition(), e.monitorKey(), actor));
        }
    }

    private static TripMonitor monitor(Row r) {
        return new TripMonitor(r.getString("tenant_code"), r.getString("monitor_key"), r.getInteger("version"),
                r.getString("status"), r.getString("name"), r.getString("description"), Pg.json(r, "plan", PLAN),
                Pg.json(r, "params", PARAMS), Pg.json(r, "rules", RULES), time(r, "created_at"),
                r.getString("created_by"), time(r, "updated_at"), r.getString("updated_by"),
                time(r, "published_at"), r.getString("published_by"));
    }
}
