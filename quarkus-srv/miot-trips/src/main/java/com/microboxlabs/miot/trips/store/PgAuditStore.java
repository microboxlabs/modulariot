package com.microboxlabs.miot.trips.store;

import static com.microboxlabs.miot.trips.store.Pg.query;
import static com.microboxlabs.miot.trips.store.Pg.text;
import static com.microboxlabs.miot.trips.store.Pg.time;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.core.db.PgTx;
import com.microboxlabs.miot.trips.domain.AuditEvent;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.List;
import java.util.Map;
import java.util.function.Supplier;

/** {@link AuditStore} on the modulith database, schema {@code miot_trips}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.trips.enabled", stringValue = "true")
public class PgAuditStore implements AuditStore {

    private static final int MAX_LIMIT = 500;

    private static final TypeReference<Map<String, Object>> DETAILS = new TypeReference<>() {
    };

    private static final String COLUMNS =
            "id, tenant_code, actor, action, entity_type, entity_id, trip_id, details, created_at";

    private static final String INSERT = """
            INSERT INTO miot_trips.audit_event
                (tenant_code, actor, action, entity_type, entity_id, trip_id, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7::text::jsonb)
            RETURNING\s""" + COLUMNS;

    private final Supplier<Pool> pool;

    @Inject
    PgAuditStore(Instance<Pool> pool) {
        this(pool::get);
    }

    PgAuditStore(Supplier<Pool> pool) {
        this.pool = pool;
    }

    @Override
    public AuditEvent append(AuditEvent e) {
        Tuple params = Tuple.tuple()
                .addString(e.tenantCode()).addString(e.actor()).addString(e.action())
                .addString(e.entityType()).addString(e.entityId()).addUUID(Pg.parse(e.tripId()))
                .addString(Pg.json(e.details() == null ? Map.of() : e.details()));
        // a failed insert must not abort the operation's transaction: the savepoint confines it
        return PgTx.savepoint(() -> {
            AuditEvent stored = event(query(pool.get(), INSERT, params).iterator().next());
            BoardChannel.touched(pool.get(), e.tenantCode(), e.tripId());
            return stored;
        });
    }

    @Override
    public List<AuditEvent> list(String tenantCode, String entityType, String entityId,
            java.time.OffsetDateTime before, Long beforeId, int limit) {
        int capped = Math.clamp(limit, 1, MAX_LIMIT);
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUMNS)
                .append(" FROM miot_trips.audit_event WHERE tenant_code = $1");
        Tuple params = Tuple.of(tenantCode);
        if (entityType != null) {
            params.addString(entityType);
            sql.append(" AND entity_type = $").append(params.size());
        }
        if (entityId != null) {
            params.addString(entityId);
            sql.append(" AND entity_id = $").append(params.size());
        }
        if (before != null && beforeId != null) {
            params.addOffsetDateTime(before);
            params.addLong(beforeId);
            sql.append(" AND (created_at, id) < ($").append(params.size() - 1)
                    .append(", $").append(params.size()).append(')');
        } else if (before != null) {
            params.addOffsetDateTime(before);
            sql.append(" AND created_at < $").append(params.size());
        }
        params.addInteger(capped);
        sql.append(" ORDER BY created_at DESC, id DESC LIMIT $").append(params.size());
        return query(pool.get(), sql.toString(), params).stream().map(PgAuditStore::event).toList();
    }

    private static AuditEvent event(Row r) {
        return new AuditEvent(
                r.getLong("id"), r.getString("tenant_code"), r.getString("actor"), r.getString("action"),
                r.getString("entity_type"), r.getString("entity_id"), text(r.getUUID("trip_id")),
                Pg.json(r, "details", DETAILS), time(r, "created_at"));
    }
}
