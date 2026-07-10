package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.RetransmitDelivery;
import com.microboxlabs.miot.integrations.domain.WebhookDeliveryState;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class RetransmitDeliveryRepository {

    private static final String COLUMNS = """
            id, config_id, asset_id, dedupe_key, destination_url, payload, state, attempts,
            max_attempts, next_retry_at, last_status_code, last_error, locked_by, locked_until,
            created_at, updated_at
            """;

    /** Qualified for RETURNING in UPDATE ... FROM (avoids "column reference id is ambiguous"). */
    private static final String COLUMNS_A = """
            a.id, a.config_id, a.asset_id, a.dedupe_key, a.destination_url, a.payload, a.state, a.attempts,
            a.max_attempts, a.next_retry_at, a.last_status_code, a.last_error, a.locked_by, a.locked_until,
            a.created_at, a.updated_at
            """;

    private static final String INSERT = """
            INSERT INTO miot_integrations.retransmit_deliveries (
                config_id, asset_id, dedupe_key, destination_url, payload, max_attempts
            ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)
            ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
            RETURNING %s
            """.formatted(COLUMNS);
    // Partial unique index idx_retransmit_deliveries_dedupe requires the WHERE clause on ON CONFLICT.

    private static final String CLAIM = """
            WITH runnable AS (
                SELECT d.id
                FROM miot_integrations.retransmit_deliveries d
                WHERE d.attempts < d.max_attempts
                  AND (
                      (d.state = 'PENDING' AND (d.next_retry_at IS NULL OR d.next_retry_at <= now()))
                      OR (d.state = 'RUNNING' AND d.locked_until IS NOT NULL AND d.locked_until < now())
                  )
                ORDER BY d.created_at
                LIMIT $1
                FOR UPDATE OF d SKIP LOCKED
            )
            UPDATE miot_integrations.retransmit_deliveries a
            SET state = 'RUNNING',
                locked_by = $2,
                locked_until = now() + make_interval(secs => $3::int),
                attempts = a.attempts + 1,
                updated_at = now()
            FROM runnable r
            WHERE a.id = r.id
            RETURNING %s
            """.formatted(COLUMNS_A);

    private static final String MARK_SUCCEEDED = """
            UPDATE miot_integrations.retransmit_deliveries
            SET state = 'SUCCEEDED',
                last_status_code = $2,
                last_error = NULL,
                locked_by = NULL,
                locked_until = NULL,
                updated_at = now()
            WHERE id = $1
              AND state = 'RUNNING'
              AND locked_by = $3
            """;

    private static final String MARK_RETRY_OR_DEAD = """
            UPDATE miot_integrations.retransmit_deliveries
            SET state = $2,
                next_retry_at = $3,
                last_status_code = $4,
                last_error = $5,
                locked_by = NULL,
                locked_until = NULL,
                updated_at = now()
            WHERE id = $1
              AND state = 'RUNNING'
              AND locked_by = $6
            """;

    private final Instance<Pool> clientInstance;

    RetransmitDeliveryRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /**
     * Idempotent enqueue. Returns true when a new row was inserted.
     */
    public boolean enqueue(
            String configId,
            String assetId,
            String dedupeKey,
            String destinationUrl,
            Map<String, Object> payload,
            int maxAttempts) {
        JsonObject json = new JsonObject(payload == null ? Map.of() : payload);
        var rows = client().preparedQuery(INSERT)
                .execute(Tuple.of(configId, assetId, dedupeKey, destinationUrl, json, maxAttempts))
                .await().indefinitely();
        return rows.iterator().hasNext();
    }

    public List<RetransmitDelivery> claim(String workerId, int limit, int leaseSeconds) {
        int safeLimit = Math.clamp(limit, 1, 50);
        int safeLease = Math.clamp(leaseSeconds, 10, 3600);
        return client().preparedQuery(CLAIM)
                .execute(Tuple.of(safeLimit, workerId, safeLease))
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    public void markSucceeded(UUID id, String workerId, int statusCode) {
        client().preparedQuery(MARK_SUCCEEDED)
                .execute(Tuple.of(id, statusCode, workerId))
                .await().indefinitely();
    }

    public void markRetryOrDead(
            UUID id,
            String workerId,
            WebhookDeliveryState nextState,
            OffsetDateTime nextRetryAt,
            Integer statusCode,
            String error) {
        client().preparedQuery(MARK_RETRY_OR_DEAD)
                .execute(Tuple.of(
                        id,
                        nextState.name(),
                        nextRetryAt,
                        statusCode,
                        error,
                        workerId))
                .await().indefinitely();
    }

    private RetransmitDelivery mapRow(Row row) {
        return new RetransmitDelivery(
                row.getUUID("id").toString(),
                row.getString("config_id"),
                row.getString("asset_id"),
                row.getString("dedupe_key"),
                row.getString("destination_url"),
                toMap(row.getJsonObject("payload")),
                WebhookDeliveryState.valueOf(row.getString("state")),
                row.getInteger("attempts"),
                row.getInteger("max_attempts"),
                row.getOffsetDateTime("next_retry_at"),
                row.getInteger("last_status_code"),
                row.getString("last_error"),
                row.getString("locked_by"),
                row.getOffsetDateTime("locked_until"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }

    private Pool client() {
        return clientInstance.get();
    }

    private static Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }
}
