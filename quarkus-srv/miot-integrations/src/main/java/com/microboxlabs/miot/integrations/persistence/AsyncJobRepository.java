package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobLedgerFacets;
import com.microboxlabs.miot.integrations.domain.JobQuery;
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
import java.util.Set;
import java.util.TreeSet;
import java.util.UUID;

@ApplicationScoped
public class AsyncJobRepository {

    private static final String COLUMNS = """
            id, tenant_code, source_instance, executor, job_type, correlation_key,
            chain_key, chain_sequence, dedupe_key, payload, state, attempts, max_attempts,
            next_retry_at, locked_by, locked_until, last_error, attempt_history,
            enqueued_by, result, created_at, updated_at""";

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
                SELECT j.id AS job_id
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
            WHERE a.id = r.job_id
            RETURNING %s""".formatted(COLUMNS);

    /**
     * Tenant-agnostic claim for an in-process worker (e.g. the modulith
     * job worker) that has no request/tenant scope. Identical
     * runnability + chain-head + lease semantics to {@link #CLAIM}, minus the
     * {@code tenant_code} filter, so one worker drains the executor's lane
     * across all tenants. Chain scoping stays per-tenant (the NOT EXISTS still
     * joins {@code p.tenant_code = j.tenant_code}).
     */
    private static final String CLAIM_ANY_TENANT = """
            WITH runnable AS (
                SELECT j.id AS job_id
                FROM miot_integrations.async_jobs j
                WHERE j.executor = $1
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
                ORDER BY j.created_at
                LIMIT $2
                FOR UPDATE OF j SKIP LOCKED
            )
            UPDATE miot_integrations.async_jobs a
            SET state = 'RUNNING',
                locked_by = $3,
                locked_until = now() + make_interval(secs => $4::int),
                attempts = a.attempts + 1,
                updated_at = now()
            FROM runnable r
            WHERE a.id = r.job_id
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
                result = COALESCE($8::jsonb, result),
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

    /**
     * Shared predicate of the console listing and its total count, so a page and
     * the "of N" beside it can never disagree. $7 is the free-text needle: a
     * job-id prefix, or a substring of the correlation key, chain key or job
     * type. The caller escapes LIKE wildcards — an operator pasting a raw
     * {@code %} must not turn the needle into "everything".
     *
     * <p>Kept out of {@code String.formatted} on purpose: the LIKE patterns
     * contain {@code %}, which a format call would read as a specifier.
     */
    private static final String LIST_FILTERS = """
            WHERE tenant_code = $1
              AND ($2::varchar IS NULL OR state = $2)
              AND ($3::varchar IS NULL OR correlation_key = $3)
              AND ($4::varchar IS NULL OR job_type = $4)
              AND ($5::varchar IS NULL OR chain_key = $5)
              AND ($6::varchar IS NULL OR executor = $6)
              AND ($7::varchar IS NULL OR (
                       id::text LIKE lower($7) || '%'
                    OR correlation_key ILIKE '%' || $7 || '%'
                    OR chain_key ILIKE '%' || $7 || '%'
                    OR job_type ILIKE '%' || $7 || '%'
              ))""";

    /**
     * The {@code id} tie-break is what makes OFFSET paging sound. {@code
     * created_at} is not unique — it defaults to {@code now()} and jobs enqueued
     * together can land on the same microsecond — and PostgreSQL guarantees no
     * particular order among tied rows, so it may place them differently in the
     * query for one page than in the query for the next: adjacent pages would
     * drop or repeat a job.
     */
    private static final String LIST = "SELECT " + COLUMNS
            + "\nFROM miot_integrations.async_jobs\n"
            + LIST_FILTERS
            + "\nORDER BY created_at DESC, id DESC\nLIMIT $8 OFFSET $9";

    private static final String COUNT = "SELECT count(*)::int AS n\n"
            + "FROM miot_integrations.async_jobs\n"
            + LIST_FILTERS;

    /**
     * One pass over the tenant's ledger for everything the console's chrome
     * needs: per-state counts and the distinct job types and executor lanes.
     */
    private static final String LEDGER_FACETS = """
            SELECT state, job_type, executor, count(*)::int AS n
            FROM miot_integrations.async_jobs
            WHERE tenant_code = $1
            GROUP BY state, job_type, executor""";

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

    /** Tenant-agnostic lane claim for in-process workers. See {@link #CLAIM_ANY_TENANT}. */
    public List<AsyncJob> claimForExecutor(String executor, String workerId, int limit, int leaseSeconds) {
        Tuple params = Tuple.tuple()
                .addString(executor)
                .addInteger(limit)
                .addString(workerId)
                .addInteger(leaseSeconds);
        return client().preparedQuery(CLAIM_ANY_TENANT)
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
            OffsetDateTime nextRetryAt, String lastError, Map<String, Object> attemptEntry,
            Map<String, Object> result) {
        Tuple params = Tuple.tuple()
                .addUUID(UUID.fromString(jobId))
                .addString(newState.name())
                .addOffsetDateTime(nextRetryAt)
                .addString(lastError)
                .addJsonArray(new JsonArray().add(new JsonObject(attemptEntry)))
                .addString(workerId)
                .addInteger(expectedAttempts)
                // COALESCEd in SQL: a report with no result keeps the previous one.
                .addJsonObject(result == null ? null : new JsonObject(result));
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

    /** One page of the tenant's jobs, newest first. */
    public List<AsyncJob> list(String tenantCode, JobQuery query) {
        Tuple params = filterParams(tenantCode, query)
                .addInteger(query.limit())
                .addInteger(query.offset());
        return client().preparedQuery(LIST)
                .execute(params)
                .await().indefinitely()
                .stream()
                .map(this::mapRow)
                .toList();
    }

    /** Rows matching the same filters as {@link #list}, ignoring the window. */
    public int count(String tenantCode, JobQuery query) {
        return client().preparedQuery(COUNT)
                .execute(filterParams(tenantCode, query))
                .await().indefinitely()
                .stream()
                .findFirst()
                .map(row -> row.getInteger("n"))
                .orElse(0);
    }

    /** Per-state counts plus the distinct job types and lanes of the whole tenant ledger. */
    public JobLedgerFacets facets(String tenantCode) {
        Map<String, Integer> counts = new LinkedHashMap<>();
        Set<String> jobTypes = new TreeSet<>();
        Set<String> executors = new TreeSet<>();
        client().preparedQuery(LEDGER_FACETS)
                .execute(Tuple.of(tenantCode))
                .await().indefinitely()
                .forEach(row -> {
                    counts.merge(row.getString("state"), row.getInteger("n"), Integer::sum);
                    jobTypes.add(row.getString("job_type"));
                    executors.add(row.getString("executor"));
                });
        return new JobLedgerFacets(counts, List.copyOf(jobTypes), List.copyOf(executors));
    }

    private static Tuple filterParams(String tenantCode, JobQuery query) {
        return Tuple.tuple()
                .addString(tenantCode)
                .addString(query.state())
                .addString(query.correlationKey())
                .addString(query.jobType())
                .addString(query.chainKey())
                .addString(query.executor())
                .addString(query.search());
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
                toNullableMap(row.getJsonObject("result")),
                row.getOffsetDateTime("created_at"),
                row.getOffsetDateTime("updated_at"));
    }

    private JsonObject toJson(Map<String, Object> value) {
        return new JsonObject(value == null ? Map.of() : value);
    }

    private Map<String, Object> toMap(JsonObject value) {
        return value == null ? Map.of() : new LinkedHashMap<>(value.getMap());
    }

    /** Unlike {@link #toMap}, absent stays null — "no result" and "empty result" differ. */
    private Map<String, Object> toNullableMap(JsonObject value) {
        return value == null ? null : new LinkedHashMap<>(value.getMap());
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
