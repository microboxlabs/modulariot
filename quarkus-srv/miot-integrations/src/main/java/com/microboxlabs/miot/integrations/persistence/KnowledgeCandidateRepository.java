package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.KnowledgeCandidate;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

/**
 * Reads and writes {@code miot_integrations.knowledge_candidates}, the human-gated
 * staging store. Mirrors {@code InteractionEpisodeRepository} (Vert.x reactive PG,
 * blocking via {@code await().indefinitely()}, JSONB via {@code JsonObject}) but
 * adds a review transition: {@link #updateStatus} moves a row from {@code pending}
 * to {@code approved}/{@code rejected} exactly once (the {@code status = 'pending'}
 * guard makes re-review a no-op). Every read/write is tenant-scoped so one tenant
 * can never see or review another's candidates. The {@code protected} constructor
 * lets unit tests subclass with a null pool.
 */
@ApplicationScoped
public class KnowledgeCandidateRepository {

    private static final String COLUMNS = """
            id, tenant_code, connection, term, kind, scope, confidence, body,
            provenance, status, created_by, reviewed_by, reviewed_at, created_at""";

    private static final String INSERT = """
            INSERT INTO miot_integrations.knowledge_candidates (
                tenant_code, connection, term, kind, scope, confidence, body,
                provenance, created_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
            RETURNING %s""".formatted(COLUMNS);

    private static final String LIST_BY_STATUS = """
            SELECT %s
              FROM miot_integrations.knowledge_candidates
             WHERE tenant_code = $1 AND status = $2
             ORDER BY created_at DESC
             LIMIT $3""".formatted(COLUMNS);

    private static final String UPDATE_STATUS = """
            UPDATE miot_integrations.knowledge_candidates
               SET status = $3, reviewed_by = $4, reviewed_at = now()
             WHERE id = $1 AND tenant_code = $2 AND status = 'pending'
            RETURNING %s""".formatted(COLUMNS);

    private final Instance<Pool> clientInstance;

    protected KnowledgeCandidateRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /** Appends one candidate; returns the persisted row (id + created_at assigned). */
    public KnowledgeCandidate insert(KnowledgeCandidate candidate) {
        Tuple params = Tuple.tuple()
                .addString(candidate.tenantCode())
                .addString(candidate.connection())
                .addString(candidate.term())
                .addString(candidate.kind())
                .addString(candidate.scope())
                .addValue(candidate.confidence())
                .addString(candidate.body())
                .addJsonObject(toJson(candidate.provenance()))
                .addString(candidate.createdBy());
        RowSet<Row> rows = client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    /** Candidates in {@code status} for a tenant, newest first (the review queue). */
    public List<KnowledgeCandidate> listByStatus(String tenantCode, String status, int limit) {
        return client().preparedQuery(LIST_BY_STATUS)
                .execute(Tuple.of(tenantCode, status, limit))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /**
     * Transitions a pending candidate to {@code status} (approved/rejected),
     * stamping the reviewer. Returns the updated row, or {@code null} when the id
     * is unknown, belongs to another tenant, or is already reviewed (the
     * {@code status = 'pending'} guard) — the caller maps null to 404/409.
     */
    public KnowledgeCandidate updateStatus(String tenantCode, String id, String status, String reviewedBy) {
        RowSet<Row> rows = client().preparedQuery(UPDATE_STATUS)
                .execute(Tuple.of(UUID.fromString(id), tenantCode, status, reviewedBy))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    private Pool client() {
        return clientInstance.get();
    }

    private KnowledgeCandidate mapRow(Row row) {
        return new KnowledgeCandidate(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("connection"),
                row.getString("term"),
                row.getString("kind"),
                row.getString("scope"),
                row.getDouble("confidence"),
                row.getString("body"),
                toMap(row.getJsonObject("provenance")),
                row.getString("status"),
                row.getString("created_by"),
                row.getString("reviewed_by"),
                row.getOffsetDateTime("reviewed_at"),
                row.getOffsetDateTime("created_at"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
