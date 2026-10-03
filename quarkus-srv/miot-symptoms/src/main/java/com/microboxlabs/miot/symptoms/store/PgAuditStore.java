package com.microboxlabs.miot.symptoms.store;

import static com.microboxlabs.miot.symptoms.store.PgIds.query;
import static com.microboxlabs.miot.symptoms.store.PgIds.text;

import com.fasterxml.jackson.core.type.TypeReference;
import com.microboxlabs.miot.symptoms.catalog.store.PgJson;
import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import io.quarkus.arc.properties.IfBuildProperty;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/** {@link AuditStore} on the modulith database, schema {@code miot_symptoms}. */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class PgAuditStore implements AuditStore {

    /** Same cap as the API's {@code limit}. */
    private static final int MAX_LIMIT = 500;

    private static final TypeReference<Map<String, Object>> DETAILS = new TypeReference<>() {
    };

    private static final String COLUMNS =
            "id, tenant_code, actor, action, entity_type, entity_id, symptom_id, details, created_at";

    private static final String INSERT = "INSERT INTO miot_symptoms.audit_event (" + COLUMNS + """
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
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
                .addUUID(UUID.randomUUID()).addString(e.tenantCode()).addString(e.actor()).addString(e.action())
                .addString(e.entityType()).addString(e.entityId()).addLong(e.symptomId())
                .addString(PgJson.write(e.details() == null ? Map.of() : e.details()))
                .addOffsetDateTime(OffsetDateTime.now(ZoneOffset.UTC));
        return events(query(pool.get(), INSERT, params)).get(0);
    }

    @Override
    public List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before,
            String beforeId, int limit) {
        int capped = Math.clamp(limit, 0, MAX_LIMIT);
        StringBuilder sql = new StringBuilder("SELECT ").append(COLUMNS)
                .append(" FROM miot_symptoms.audit_event WHERE tenant_code = $1");
        Tuple params = Tuple.of(tenantCode);
        if (entityType != null) {
            params.addString(entityType);
            sql.append(" AND entity_type = $").append(params.size());
        }
        if (entityId != null) {
            params.addString(entityId);
            sql.append(" AND entity_id = $").append(params.size());
        }
        if (symptomId != null) {
            params.addLong(symptomId);
            sql.append(" AND symptom_id = $").append(params.size());
        }
        UUID cursorId = PgIds.parse(beforeId);
        if (before != null && cursorId != null) {
            params.addOffsetDateTime(before);
            params.addUUID(cursorId);
            sql.append(" AND (created_at, id) < ($").append(params.size() - 1).append(", $").append(params.size())
                    .append(')');
        } else if (before != null) {
            params.addOffsetDateTime(before);
            sql.append(" AND created_at < $").append(params.size());
        }
        params.addInteger(capped);
        sql.append(" ORDER BY created_at DESC, id DESC LIMIT $").append(params.size());
        return events(query(pool.get(), sql.toString(), params));
    }

    private static List<AuditEvent> events(RowSet<Row> rows) {
        return rows.stream().map(PgAuditStore::event).toList();
    }

    private static AuditEvent event(Row r) {
        return new AuditEvent(
                text(r.getUUID("id")), r.getString("tenant_code"), r.getString("actor"), r.getString("action"),
                r.getString("entity_type"), r.getString("entity_id"), r.getLong("symptom_id"),
                PgJson.read(r, "details", DETAILS), PgJson.time(r, "created_at"));
    }
}
