package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.trips.domain.MonitorRun;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link MonitorRunStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgMonitorRunStore implements MonitorRunStore {

    private static final String TRIP_ID = "trip_id";

    private static final String MONITOR_VERSION = "monitor_version";

    private static final String TENANT_CODE = "tenant_code";

    private static final String EPOCH = "epoch";

    private static final String SELECT = "SELECT ";

    private static final String STATE_COLUMNS =
            "trip_id, tenant_code, monitor_key, monitor_version, epoch, bound_at, bound_by";
    private static final String TIMER_COLUMNS =
            "id, tenant_code, trip_id, rule_key, monitor_version, due_at, epoch, fired_at";
    private static final TypeReference<Map<String, Object>> MAP = new TypeReference<>() {
    };
    private static final TypeReference<List<Map<String, Object>>> LIST = new TypeReference<>() {
    };

    private final Supplier<Pool> pool;

    @Inject
    PgMonitorRunStore(Instance<Pool> pool) {
        this(pool::get);
    }

    public PgMonitorRunStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public Optional<MonitorRun.State> state(String tenantCode, UUID tripId) {
        return query(pool.get(), SELECT + STATE_COLUMNS + " FROM miot_trips.trip_monitor_state"
                + " WHERE tenant_code = $1 AND trip_id = $2" + Pg.lock(), Tuple.of(tenantCode, tripId))
                .stream().map(PgMonitorRunStore::state).findFirst();
    }

    @Override
    public MonitorRun.State bind(String tenantCode, UUID tripId, String monitorKey, int monitorVersion,
            String actor) {
        return query(pool.get(), """
                INSERT INTO miot_trips.trip_monitor_state (trip_id, tenant_code, monitor_key, monitor_version, bound_by)
                VALUES ($1, $2, $3, $4, $5)
                ON CONFLICT (trip_id) DO UPDATE SET monitor_key = EXCLUDED.monitor_key,
                    monitor_version = EXCLUDED.monitor_version, epoch = 0, bound_at = now(),
                    bound_by = EXCLUDED.bound_by, updated_at = now()
                RETURNING\s""" + STATE_COLUMNS,
                Tuple.of(tripId, tenantCode, monitorKey, monitorVersion, actor))
                .stream().map(PgMonitorRunStore::state).findFirst().orElseThrow();
    }

    @Override
    public int nextEpoch(String tenantCode, UUID tripId) {
        return query(pool.get(), """
                UPDATE miot_trips.trip_monitor_state SET epoch = epoch + 1, updated_at = now()
                WHERE tenant_code = $1 AND trip_id = $2 RETURNING epoch""", Tuple.of(tenantCode, tripId))
                .stream().map(r -> r.getInteger(EPOCH)).findFirst().orElseThrow();
    }

    @Override
    public void dropPendingTimers(String tenantCode, UUID tripId) {
        query(pool.get(), "DELETE FROM miot_trips.trip_timer WHERE tenant_code = $1 AND trip_id = $2"
                + " AND fired_at IS NULL", Tuple.of(tenantCode, tripId));
    }

    @Override
    public boolean fired(String tenantCode, UUID tripId, String monitorKey, int monitorVersion, String ruleKey,
            OffsetDateTime dueAt) {
        // Transitions already retain the monitor identity, unlike legacy timer rows.
        return query(pool.get(), """
                SELECT 1 FROM miot_trips.trip_transition
                WHERE tenant_code = $1 AND trip_id = $2 AND monitor_key = $3 AND monitor_version = $4
                    AND event->>'on' = 'timer' AND event->>'kind' = $5 AND at = $6::timestamptz LIMIT 1""",
                Tuple.tuple().addString(tenantCode).addUUID(tripId).addString(monitorKey)
                        .addInteger(monitorVersion).addString(ruleKey).addOffsetDateTime(dueAt))
                .iterator().hasNext();
    }

    @Override
    public void retainTimer(long id, int epoch) {
        query(pool.get(), "UPDATE miot_trips.trip_timer SET epoch = $2 WHERE id = $1 AND fired_at IS NULL",
                Tuple.of(id, epoch));
    }

    @Override
    public void dropObsoleteTimers(String tenantCode, UUID tripId, int epoch) {
        query(pool.get(), "DELETE FROM miot_trips.trip_timer WHERE tenant_code = $1 AND trip_id = $2"
                + " AND fired_at IS NULL AND epoch <> $3", Tuple.of(tenantCode, tripId, epoch));
    }

    @Override
    public void schedule(String tenantCode, UUID tripId, String ruleKey, int monitorVersion, OffsetDateTime dueAt,
            int epoch) {
        query(pool.get(), """
                INSERT INTO miot_trips.trip_timer (tenant_code, trip_id, rule_key, monitor_version, due_at, epoch)
                VALUES ($1, $2, $3, $4, $5, $6)""",
                Tuple.tuple().addString(tenantCode).addUUID(tripId).addString(ruleKey).addInteger(monitorVersion)
                        .addOffsetDateTime(dueAt).addInteger(epoch));
    }

    @Override
    public Optional<MonitorRun.Timer> timer(long id) {
        return query(pool.get(), SELECT + TIMER_COLUMNS + " FROM miot_trips.trip_timer WHERE id = $1"
                + Pg.lock(), Tuple.of(id)).stream().map(PgMonitorRunStore::timer).findFirst();
    }

    @Override
    public void markFired(long id) {
        query(pool.get(), "UPDATE miot_trips.trip_timer SET fired_at = now(), claimed_until = NULL WHERE id = $1",
                Tuple.of(id));
    }

    @Override
    public List<MonitorRun.Timer> pendingTimers(String tenantCode, UUID tripId) {
        return query(pool.get(), SELECT + TIMER_COLUMNS + " FROM miot_trips.trip_timer"
                + " WHERE tenant_code = $1 AND trip_id = $2 AND fired_at IS NULL ORDER BY due_at",
                Tuple.of(tenantCode, tripId)).stream().map(PgMonitorRunStore::timer).toList();
    }

    @Override
    public List<MonitorRun.Timer> claimDue(OffsetDateTime now, int claimSeconds, int limit) {
        return query(pool.get(), """
                UPDATE miot_trips.trip_timer SET claimed_until = $1::timestamptz + make_interval(secs => $2)
                WHERE id IN (SELECT id FROM miot_trips.trip_timer
                             WHERE fired_at IS NULL AND due_at <= $1::timestamptz
                               AND (claimed_until IS NULL OR claimed_until < $1::timestamptz)
                             ORDER BY due_at LIMIT $3
                             FOR UPDATE SKIP LOCKED)
                RETURNING\s""" + TIMER_COLUMNS, Tuple.of(now, claimSeconds, limit))
                .stream().map(PgMonitorRunStore::timer).toList();
    }

    @Override
    public boolean alerted(String tenantCode, UUID tripId, String key) {
        return query(pool.get(), """
                SELECT 1 FROM miot_trips.trip_transition WHERE tenant_code = $1 AND trip_id = $2
                    AND actions @> $3::text::jsonb LIMIT 1""",
                Tuple.of(tenantCode, tripId, Pg.json(List.of(Map.of("type", "alert", "value", key)))))
                .iterator().hasNext();
    }

    @Override
    public void recordTransition(MonitorRun.Transition t) {
        query(pool.get(), """
                INSERT INTO miot_trips.trip_transition (tenant_code, trip_id, monitor_key, monitor_version, event,
                    depth, matched, rule_key, from_stage, to_stage, actions, error, at)
                VALUES ($1, $2, $3, $4, $5::text::jsonb, $6, $7, $8, $9, $10, $11::text::jsonb, $12, $13)""",
                Tuple.tuple().addString(t.tenantCode()).addUUID(UUID.fromString(t.tripId()))
                        .addString(t.monitorKey()).addInteger(t.monitorVersion()).addString(Pg.json(t.event()))
                        .addInteger(t.depth()).addArrayOfString(t.matched().toArray(String[]::new))
                        .addString(t.ruleKey()).addString(t.fromStage()).addString(t.toStage())
                        .addString(Pg.json(t.actions())).addString(t.error()).addOffsetDateTime(t.at()));
        BoardChannel.touched(pool.get(), t.tenantCode(), t.tripId());
    }

    @Override
    public List<MonitorRun.Transition> transitions(String tenantCode, UUID tripId, int limit) {
        return query(pool.get(), """
                SELECT id, tenant_code, trip_id, monitor_key, monitor_version, event, depth, matched, rule_key,
                       from_stage, to_stage, actions, error, at, created_at
                FROM miot_trips.trip_transition WHERE tenant_code = $1 AND trip_id = $2
                ORDER BY id DESC LIMIT $3""", Tuple.of(tenantCode, tripId, limit)).stream()
                .map(r -> new MonitorRun.Transition(r.getLong("id"), r.getString(TENANT_CODE),
                        Pg.text(r, TRIP_ID), r.getString("monitor_key"), r.getInteger(MONITOR_VERSION),
                        Pg.json(r, "event", MAP), r.getInteger("depth"), List.of(r.getArrayOfStrings("matched")),
                        r.getString("rule_key"), r.getString("from_stage"), r.getString("to_stage"),
                        Pg.json(r, "actions", LIST), r.getString("error"), time(r, "at"), time(r, "created_at")))
                .toList();
    }

    private static MonitorRun.State state(Row r) {
        return new MonitorRun.State(Pg.text(r, TRIP_ID), r.getString(TENANT_CODE), r.getString("monitor_key"),
                r.getInteger(MONITOR_VERSION), r.getInteger(EPOCH), time(r, "bound_at"), r.getString("bound_by"));
    }

    private static MonitorRun.Timer timer(Row r) {
        return new MonitorRun.Timer(r.getLong("id"), r.getString(TENANT_CODE), Pg.text(r, TRIP_ID),
                r.getString("rule_key"), r.getInteger(MONITOR_VERSION), time(r, "due_at"), r.getInteger(EPOCH),
                time(r, "fired_at"));
    }
}
