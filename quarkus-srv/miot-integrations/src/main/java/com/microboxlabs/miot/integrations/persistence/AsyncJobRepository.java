package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import io.vertx.mutiny.sqlclient.Pool;
import io.vertx.mutiny.sqlclient.Row;
import io.vertx.mutiny.sqlclient.RowSet;
import io.vertx.mutiny.sqlclient.Tuple;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@ApplicationScoped
public class AsyncJobRepository {

    private static final String COLUMNS = """
            id, tenant_code, source_instance, executor, job_type, correlation_key,
            chain_key, chain_sequence, dedupe_key, payload, state, attempts, max_attempts,
            next_retry_at, locked_by, locked_until, last_error, attempt_history,
            enqueued_by, created_at, updated_at""";

    private static final String INSERT = """
            INSERT INTO miot_integrations.async_jobs (
                tenant_code, source_instance, executor, job_type, correlation_key,
                chain_key, chain_sequence, dedupe_key, payload, max_attempts, enqueued_by
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT (tenant_code, dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
            RETURNING %s""".formatted(COLUMNS);

    /**
     * Claims runnable jobs for an executor with a lease. A job is runnable when it
     * is PENDING and due, or RUNNING with an expired lease (crashed worker), has
     * attempts left, and is the head of its chain (no earlier sequence unfinished).
     * Attempts increment at claim time so crashed attempts still count toward
     * max_attempts (poison-pill protection).
     */
    private static final String CLAIM = """
            WITH runnable AS (
                SELECT j.id
                FROM miot_integrations.async_jobs j
                WHERE j.tenant_code = $1
                  AND j.executor = $2
                  AND j.attempts < j.max_attempts
                  AND (
                      (j.state = 'PENDING' AND (j.next_retry_at IS NULL OR j.next_retry_at <= now()))
                      OR (j.state = 'RUNNING' AND j.locked_until IS NOT NULL AND j.locked_until < now())
                  )
                  AND NOT EXISTS (
                      SELECT 1
                      FROM miot_integrations.async_jobs p
                      WHERE j.chain_key IS NOT NULL
                        AND p.tenant_code = j.tenant_code
                        AND p.chain_key = j.chain_key
                        AND p.chain_sequence < j.chain_sequence
                        AND p.state NOT IN ('SUCCEEDED', 'CANCELLED')
                  )
                  AND ($5::varchar IS NULL OR j.chain_key = $5)
                ORDER BY j.created_at
                LIMIT $3
                FOR UPDATE OF j SKIP LOCKED
            )
            UPDATE miot_integrations.async_jobs a
            SET state = 'RUNNING',
                locked_by = $4,
                locked_until = now() + make_interval(secs => $6::int),
                attempts = a.attempts + 1,
                updated_at = now()
            FROM runnable r
            WHERE a.id = r.id
            RETURNING %s""".formatted(COLUMNS);

    /**
     * Compare-and-set on the active lease: the update only lands when the row is
     * still RUNNING, held by the reporting worker, and on the attempt the worker
     * claimed. A stale report (lease expired and the job was reclaimed — possibly
     * by the same workerId via fast path + poller overlap) matches zero rows.
     */
    private static final String REPORT = """
            UPDATE miot_integrations.async_jobs
            SET state = $2,
                next_retry_at = $3,
                last_error = $4,
                attempt_history = attempt_history || $5::jsonb,
                locked_by = NULL,
                locked_until = NULL,
                updated_at = now()
            WHERE id = $1
              AND state = 'RUNNING'
              AND locked_by = $6
              AND attempts = $7
            RETURNING %s""".formatted(COLUMNS);

    private static final String RETRY = """
            UPDATE miot_integrations.async_jobs
            SET state = 'PENDING',
                attempts = 0,
                next_retry_at = NULL,
                locked_by = NULL,
                locked_until = NULL,
                attempt_history = attempt_history || $2::jsonb,
                enqueued_by = 'manual',
                updated_at = now()
            WHERE id = $1 AND state IN ('FAILED', 'CANCELLED', 'PENDING')
            RETURNING %s""".formatted(COLUMNS);

    private static final String FIND_BY_ID = """
            SELECT %s
            FROM miot_integrations.async_jobs
            WHERE id = $1 AND tenant_code = $2""".formatted(COLUMNS);

    private static final String LIST = """
            SELECT %s
            FROM miot_integrations.async_jobs
            WHERE tenant_code = $1
              AND ($2::varchar IS NULL OR state = $2)
              AND ($3::varchar IS NULL OR correlation_key = $3)
              AND ($4::varchar IS NULL OR job_type = $4)
            ORDER BY created_at DESC
            LIMIT $5""".formatted(COLUMNS);

    private final Instance<Pool> clientInstance;

    protected AsyncJobRepository(Instance<Pool> clientInstance) {
        this.clientInstance = clientInstance;
    }

    /**
     * Inserts a job; returns null when the dedupe key already exists (idempotent
     * enqueue — the existing row wins).
     */
    public AsyncJob insert(AsyncJob job) {
        Tuple params = Tuple.tuple()
                .addString(job.tenantCode())
                .addString(job.sourceInstance())
                .addString(job.executor())
                .addString(job.jobType())
                .addString(job.correlationKey())
                .addString(job.chainKey())
                .addInteger(job.chainSequence())
                .addString(job.dedupeKey())
                .addJsonObject(toJson(job.payload()))
                .addInteger(job.maxAttempts())
                .addString(job.enqueuedBy());
        RowSet<Row> rows = client().preparedQuery(INSERT)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    public List<AsyncJob> claim(String tenantCode, String executor, String workerId,
            int limit, int leaseSeconds, String chainKey) {
        Tuple params = Tuple.tuple()
                .addString(tenantCode)
                .addString(executor)
                .addInteger(limit)
                .addString(workerId)
                .addString(chainKey)
                .addInteger(leaseSeconds);
        return client().preparedQuery(CLAIM)
                .execute(params)
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /**
     * @return the updated job, or null when the lease CAS failed (the job was
     *         reclaimed since this worker's claim — the report is stale)
     */
    public AsyncJob report(String jobId, String workerId, int expectedAttempts, JobState newState,
            OffsetDateTime nextRetryAt, String lastError, Map<String, Object> attemptEntry) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(jobId))
                .addString(newState.name())
                .addOffsetDateTime(nextRetryAt)
                .addString(lastError)
                .addJsonArray(new JsonArray().add(new JsonObject(attemptEntry)))
                .addString(workerId)
                .addInteger(expectedAttempts);
        RowSet<Row> rows = client().preparedQuery(REPORT)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    public AsyncJob retry(String jobId, Map<String, Object> attemptEntry) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(jobId))
                .addJsonArray(new JsonArray().add(new JsonObject(attemptEntry)));
        RowSet<Row> rows = client().preparedQuery(RETRY)
                .execute(params)
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    public AsyncJob findByTenantAndId(String tenantCode, String jobId) {
        RowSet<Row> rows = client().preparedQuery(FIND_BY_ID)
                .execute(Tuple.of(UUID.fromString(jobId), tenantCode))
                .await().indefinitely();
        return rows.iterator().hasNext() ? mapRow(rows.iterator().next()) : null;
    }

    public List<AsyncJob> list(String tenantCode, String state, String correlationKey, String jobType, int limit) {
        Tuple params = Tuple.tuple()
                .addString(tenantCode)
                .addString(state)
                .addString(correlationKey)
                .addString(jobType)
                .addInteger(limit);
        return client().preparedQuery(LIST)
                .execute(params)
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    private Pool client() {
        return clientInstance.get();
    }

    private AsyncJob mapRow(Row row) {
        return new AsyncJob(
                row.getUUID("id").toString(),
                row.getString("tenant_code"),
                row.getString("source_instance"),
                row.getString("executor"),
                row.getString("job_type"),
                row.getString("correlation_key"),
                row.getString("chain_key"),
                row.getInteger("chain_sequence"),
                row.getString("dedupe_key"),
                toMap(row.getJsonObject("payload")),
                JobState.valueOf(row.getString("state")),
                row.getInteger("attempts"),
                row.getInteger("max_attempts"),
                row.getOffsetDateTime("next_retry_at"),
                row.getString("locked_by"),
                row.getOffsetDateTime("locked_until"),
                row.getString("last_error"),
                toHistory(row.getJsonArray("attempt_history")),
                row.getString("enqueued_by"),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }

    private List<Map<String, Object>> toHistory(JsonArray value) {
        if (value == null) {
            return List.of();
        }
        List<Map<String, Object>> entries = new ArrayList<>(value.size());
        for (int i = 0; i < value.size(); i++) {
            entries.add(new LinkedHashMap<>(value.getJsonObject(i).getMap()));
        }
        return entries;
    }
}
