package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.ClaimJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
public class AsyncJobService {

    private static final Logger LOG = Logger.getLogger(AsyncJobService.class);

    private static final Set<String> VALID_ENQUEUED_BY = Set.of("listener", "reconciler", "manual");
    private static final Set<String> VALID_OUTCOMES = Set.of("SUCCEEDED", "SKIPPED", "FAILED");

    private static final int DEFAULT_MAX_ATTEMPTS = 5;
    private static final int DEFAULT_CLAIM_LIMIT = 10;
    private static final int DEFAULT_LEASE_SECONDS = 300;
    private static final int MAX_CLAIM_LIMIT = 50;

    private final AsyncJobRepository repository;
    private final int retryBaseSeconds;
    private final int retryMaxSeconds;

    @Inject
    public AsyncJobService(
            AsyncJobRepository repository,
            @ConfigProperty(name = "miot.integrations.jobs.retry-base-seconds", defaultValue = "60") int retryBaseSeconds,
            @ConfigProperty(name = "miot.integrations.jobs.retry-max-seconds", defaultValue = "3600") int retryMaxSeconds) {
        this.repository = repository;
        this.retryBaseSeconds = retryBaseSeconds;
        this.retryMaxSeconds = retryMaxSeconds;
    }

    /**
     * Idempotently enqueues a batch of jobs. Rows whose dedupe key already exists
     * are counted as duplicates and not re-created (the existing row, whatever its
     * state, wins — re-running a SUCCEEDED job requires an explicit manual retry).
     */
    public EnqueueJobsResponse enqueue(String tenantCode, EnqueueJobsRequest request) {
        if (request.sourceInstance() == null || request.sourceInstance().isBlank()) {
            throw new IllegalArgumentException("sourceInstance is required");
        }
        if (request.jobs() == null || request.jobs().isEmpty()) {
            throw new IllegalArgumentException("jobs must not be empty");
        }
        String enqueuedBy = request.enqueuedBy() == null ? "listener" : request.enqueuedBy();
        if (!VALID_ENQUEUED_BY.contains(enqueuedBy)) {
            throw new IllegalArgumentException("enqueuedBy must be one of " + VALID_ENQUEUED_BY);
        }

        List<AsyncJob> created = new ArrayList<>();
        int duplicates = 0;
        for (AsyncJobSpec spec : request.jobs()) {
            if (spec.jobType() == null || spec.jobType().isBlank()) {
                throw new IllegalArgumentException("jobType is required for every job spec");
            }
            AsyncJob row = repository.insert(toJob(tenantCode, request.sourceInstance(), enqueuedBy, spec));
            if (row == null) {
                duplicates++;
            } else {
                created.add(row);
            }
        }
        if (duplicates > 0) {
            LOG.infof("Enqueue for tenant %s: %d created, %d duplicates (by=%s)",
                    tenantCode, created.size(), duplicates, enqueuedBy);
        }
        // Reconciler-created rows mean the fast path missed an enqueue — keep this
        // loud so a backfill spike is visible in logs/metrics.
        if ("reconciler".equals(enqueuedBy) && !created.isEmpty()) {
            LOG.warnf("Reconciler backfilled %d job(s) for tenant %s — fast-path enqueue missed them",
                    created.size(), tenantCode);
        }
        return new EnqueueJobsResponse(created, duplicates);
    }

    public List<AsyncJob> claim(ClaimJobsRequest request) {
        if (request.executor() == null || request.executor().isBlank()) {
            throw new IllegalArgumentException("executor is required");
        }
        if (request.workerId() == null || request.workerId().isBlank()) {
            throw new IllegalArgumentException("workerId is required");
        }
        int limit = request.limit() == null ? DEFAULT_CLAIM_LIMIT : Math.min(request.limit(), MAX_CLAIM_LIMIT);
        int lease = request.leaseSeconds() == null ? DEFAULT_LEASE_SECONDS : request.leaseSeconds();
        return repository.claim(request.executor(), request.workerId(), limit, lease, request.chainKey());
    }

    /**
     * Records a worker's outcome for a claimed job and computes the next state:
     * SUCCEEDED/SKIPPED close the job; FAILED schedules a backoff retry (job back
     * to PENDING) until attempts are exhausted or the failure is non-retryable,
     * which parks it as FAILED for the babysitter.
     */
    public AsyncJob report(String tenantCode, String jobId, ReportJobRequest request) {
        if (request.outcome() == null || !VALID_OUTCOMES.contains(request.outcome())) {
            throw new IllegalArgumentException("outcome must be one of " + VALID_OUTCOMES);
        }
        AsyncJob job = repository.findByTenantAndId(tenantCode, jobId);
        if (job == null) {
            return null;
        }
        if (job.state() != JobState.RUNNING) {
            throw new IllegalStateException(
                    "Job " + jobId + " is " + job.state() + ", only RUNNING jobs accept reports");
        }

        JobState newState;
        OffsetDateTime nextRetryAt = null;
        boolean failed = "FAILED".equals(request.outcome());
        if (!failed) {
            newState = JobState.SUCCEEDED;
        } else {
            boolean retryable = !Boolean.FALSE.equals(request.retryable());
            if (retryable && job.attempts() < job.maxAttempts()) {
                newState = JobState.PENDING;
                nextRetryAt = OffsetDateTime.now().plusSeconds(backoffSeconds(job.attempts()));
            } else {
                newState = JobState.FAILED;
            }
        }

        Map<String, Object> entry = attemptEntry(request.outcome(), request.detail(), request.workerId());
        AsyncJob updated = repository.report(jobId, newState, nextRetryAt,
                failed ? request.detail() : null, entry);
        if (newState == JobState.FAILED) {
            LOG.errorf("Job %s (%s, correlation=%s) parked as FAILED after %d attempt(s): %s",
                    jobId, job.jobType(), job.correlationKey(), job.attempts(), request.detail());
        }
        return updated;
    }

    /** Manual babysitter action: resets a parked job so workers pick it up again. */
    public AsyncJob retry(String tenantCode, String jobId, String actor) {
        AsyncJob job = repository.findByTenantAndId(tenantCode, jobId);
        if (job == null) {
            return null;
        }
        if (job.state() == JobState.RUNNING || job.state() == JobState.SUCCEEDED) {
            throw new IllegalStateException(
                    "Job " + jobId + " is " + job.state() + " and cannot be manually retried");
        }
        return repository.retry(jobId, attemptEntry("RETRY_REQUESTED", "Manual retry", actor));
    }

    public AsyncJob get(String tenantCode, String jobId) {
        return repository.findByTenantAndId(tenantCode, jobId);
    }

    public List<AsyncJob> list(String tenantCode, String state, String correlationKey, String jobType, int limit) {
        if (state != null) {
            JobState.valueOf(state); // validate
        }
        return repository.list(tenantCode, state, correlationKey, jobType, limit);
    }

    /** Exponential backoff: base * 2^(attempts-1), capped. */
    private long backoffSeconds(int attempts) {
        long delay = (long) (retryBaseSeconds * Math.pow(2, Math.max(0, attempts - 1)));
        return Math.min(delay, retryMaxSeconds);
    }

    private AsyncJob toJob(String tenantCode, String sourceInstance, String enqueuedBy, AsyncJobSpec spec) {
        return new AsyncJob(
                null,
                tenantCode,
                sourceInstance,
                spec.executor() == null ? "ecm" : spec.executor(),
                spec.jobType(),
                spec.correlationKey(),
                spec.chainKey(),
                spec.chainSequence() == null ? 0 : spec.chainSequence(),
                spec.dedupeKey(),
                spec.payload() == null ? Map.of() : spec.payload(),
                JobState.PENDING,
                0,
                spec.maxAttempts() == null ? DEFAULT_MAX_ATTEMPTS : spec.maxAttempts(),
                null, null, null, null,
                List.of(),
                enqueuedBy,
                null, null);
    }

    private Map<String, Object> attemptEntry(String outcome, String detail, String by) {
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("at", OffsetDateTime.now().toString());
        entry.put("outcome", outcome);
        if (detail != null) {
            entry.put("detail", detail);
        }
        if (by != null) {
            entry.put("by", by);
        }
        return entry;
    }
}
