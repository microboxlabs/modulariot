package com.microboxlabs.miot.symptoms.persistence;

import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toJson;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.toMap;
import static com.microboxlabs.miot.symptoms.persistence.RowMappers.uuid;

import com.microboxlabs.miot.symptoms.domain.AuditEvent;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;

/** Append-only writer and reader for {@code miot_symptoms.audit_events}. */
@ApplicationScoped
public class AuditEventRepository {

    private static final String COLUMNS =
            "id, tenant_code, actor, action, entity_type, entity_id, symptom_id, details, created_at";

    private static final String INSERT = """
            INSERT INTO miot_symptoms.audit_events (tenant_code, actor, action, entity_type, entity_id, symptom_id, details)
            VALUES ($1, $2, $3, $4, $5, $6, $7)
            RETURNING %s""".formatted(COLUMNS);

    private static final String LIST = """
            SELECT %s FROM miot_symptoms.audit_events
            WHERE tenant_code = $1
              AND ($2::text IS NULL OR entity_type = $2)
              AND ($3::text IS NULL OR entity_id = $3)
              AND ($4::bigint IS NULL OR symptom_id = $4)
              AND ($5::timestamptz IS NULL OR created_at < $5)
            ORDER BY created_at DESC
            LIMIT $6""".formatted(COLUMNS);

    private final Instance<Pool> clientInstance;

    protected AuditEventRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    public AuditEvent insert(AuditEvent e) {
        Tuple params = Tuple.tuple()
                .addString(e.tenantCode())
                .addString(e.actor())
                .addString(e.action())
                .addString(e.entityType())
                .addString(e.entityId())
                .addLong(e.symptomId())
                .addJsonObject(toJson(e.details()));
        RowSet<Row> rows = client().preparedQuery(INSERT).execute(params).await().indefinitely();
        return rows.iterator().hasNext() ? map(rows.iterator().next()) : null;
    }

    public List<AuditEvent> list(
            String tenantCode, String entityType, String entityId, Long symptomId, OffsetDateTime before, int limit) {
        Tuple params = Tuple.tuple()
                .addString(tenantCode)
                .addString(entityType)
                .addString(entityId)
                .addLong(symptomId)
                .addOffsetDateTime(before)
                .addInteger(limit);
        RowSet<Row> rows = client().preparedQuery(LIST).execute(params).await().indefinitely();
        List<AuditEvent> out = new ArrayList<>();
        rows.forEach(row -> out.add(map(row)));
        return out;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private AuditEvent map(Row row) {
        return new AuditEvent(
                uuid(row, "id"),
                row.getString("tenant_code"),
                row.getString("actor"),
                row.getString("action"),
                row.getString("entity_type"),
                row.getString("entity_id"),
                row.getLong("symptom_id"),
                toMap(row.getJsonObject("details")),
                row.getOffsetDateTime("created_at"));
    }
}
