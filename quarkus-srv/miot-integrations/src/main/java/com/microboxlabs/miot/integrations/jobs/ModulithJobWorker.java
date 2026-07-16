package com.microboxlabs.miot.integrations.jobs;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import jakarta.inject.Inject;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Runs modulith-lane async jobs ({@code executor=modulith}) off ECM, dispatching
 * each to the {@link ModulithJobHandler} registered for its {@code job_type}.
 * Handlers are discovered via CDI ({@code Instance<ModulithJobHandler>}) and
 * indexed once at construction — adding a job type is a new handler bean, not a
 * change here.
 *
 * <p>Dispatch is two-pronged, both funneling through the same lease-and-CAS
 * guarded ledger claim so they are safe to overlap:
 * <ul>
 *   <li><b>Fast path</b> ({@link #onEnqueued}): the async-jobs REST resource
 *       kicks a drain the moment {@code /enqueue} lands a handled modulith-lane
 *       job (~ms, no poll wait).</li>
 *   <li><b>Reconciler</b> ({@link #drainScheduled}): a periodic sweep for a lost
 *       kick, a restart mid-flight, or a due backoff retry — and the sole driver
 *       in a topology where nothing kicks.</li>
 * </ul>
 *
 * <p>Off by default ({@code miot.integrations.modulith-worker.enabled}). Per-handler
 * readiness (e.g. a downstream base URL) is the handler's own concern via
 * {@link ModulithJobHandler#isReady()}.
 */
@ApplicationScoped
public class ModulithJobWorker {

    private static final Logger LOG = Logger.getLogger(ModulithJobWorker.class);
    private static final String OUTCOME_FAILED = "FAILED";

    private final AsyncJobService jobService;
    private final Map<String, ModulithJobHandler> handlers;
    private final boolean enabled;
    private final int claimLimit;
    private final int leaseSeconds;
    private final String workerId;

    @Inject
    ModulithJobWorker(
            AsyncJobService jobService,
            Instance<ModulithJobHandler> handlers,
            @ConfigProperty(name = "miot.integrations.modulith-worker.enabled", defaultValue = "false")
                    boolean enabled,
            @ConfigProperty(name = "miot.integrations.modulith-worker.claim-limit", defaultValue = "20")
                    int claimLimit,
            @ConfigProperty(name = "miot.integrations.modulith-worker.lease-seconds", defaultValue = "120")
                    int leaseSeconds) {
        this(jobService, index(handlers), enabled, claimLimit, leaseSeconds);
    }

    /** Test seam: hand the resolved handler map directly. */
    ModulithJobWorker(AsyncJobService jobService, Map<String, ModulithJobHandler> handlers,
                      boolean enabled, int claimLimit, int leaseSeconds) {
        this.jobService = jobService;
        this.handlers = handlers;
        this.enabled = enabled;
        this.claimLimit = claimLimit;
        this.leaseSeconds = leaseSeconds;
        this.workerId = "modulith-worker-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /** Index handlers by job type; a duplicate is a wiring bug, so fail fast at startup. */
    private static Map<String, ModulithJobHandler> index(Instance<ModulithJobHandler> handlers) {
        Map<String, ModulithJobHandler> map = new HashMap<>();
        for (ModulithJobHandler handler : handlers) {
            ModulithJobHandler previous = map.put(handler.jobType(), handler);
            if (previous != null) {
                throw new IllegalStateException("Two ModulithJobHandler beans claim job type '"
                        + handler.jobType() + "': " + previous.getClass().getName() + " and "
                        + handler.getClass().getName());
            }
        }
        return map;
    }

    @Scheduled(
            every = "${miot.integrations.modulith-worker.claim-every:30s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void drainScheduled() {
        drain();
    }

    /**
     * Fast path: if this enqueue batch created a modulith-lane job we have a
     * handler for, kick a drain on the worker pool (off the request thread).
     * Never throws — the reconciler is the backstop if the kick is dropped.
     */
    public void onEnqueued(EnqueueJobsResponse response) {
        if (enabled && hasHandledLaneJob(response)) {
            Infrastructure.getDefaultWorkerPool().execute(this::drain);
        }
    }

    boolean hasHandledLaneJob(EnqueueJobsResponse response) {
        if (response == null || response.created() == null) {
            return false;
        }
        return response.created().stream().anyMatch(job ->
                ModulithJobHandler.EXECUTOR.equals(job.executor()) && handlers.containsKey(job.jobType()));
    }

    /**
     * Claims and runs modulith-lane jobs one at a time until the lane is drained
     * or the batch budget is spent. One-at-a-time so a slow handler cannot expire
     * the leases of jobs claimed alongside it.
     */
    void drain() {
        if (!enabled || !anyHandlerReady()) {
            return;
        }
        int remaining = Math.max(claimLimit, 1);
        while (remaining-- > 0) {
            List<AsyncJob> batch;
            try {
                batch = jobService.claimForExecutor(ModulithJobHandler.EXECUTOR, workerId, 1, leaseSeconds);
            } catch (Exception e) {
                LOG.error("modulith-worker claim failed — reconciler will retry", e);
                return;
            }
            if (batch.isEmpty()) {
                return;
            }
            executeAndReport(batch.get(0));
        }
    }

    private boolean anyHandlerReady() {
        boolean ready = handlers.values().stream().anyMatch(ModulithJobHandler::isReady);
        if (!ready) {
            LOG.warn("modulith-worker enabled but no handler is ready (downstream config missing) — skipping");
        }
        return ready;
    }

    private void executeAndReport(AsyncJob job) {
        String outcome;
        String detail;
        boolean retryable = true;
        ModulithJobHandler handler = handlers.get(job.jobType());
        try {
            if (handler == null) {
                // Shouldn't happen (ECM only stamps job types we handle) — park it
                // rather than churn: a retry won't conjure a handler.
                outcome = OUTCOME_FAILED;
                detail = "No modulith handler registered for job type " + job.jobType();
                retryable = false;
                LOG.errorf("modulith-worker: %s (job %s)", detail, job.id());
            } else if (!handler.isReady()) {
                outcome = OUTCOME_FAILED;
                detail = "Handler for " + job.jobType() + " is not configured";
                LOG.warnf("modulith-worker: %s — job %s will retry after backoff", detail, job.id());
            } else {
                JobOutcome result = handler.handle(job.payload());
                outcome = result.outcome();
                detail = result.detail();
            }
        } catch (Exception e) {
            outcome = OUTCOME_FAILED;
            detail = e.getMessage();
            LOG.warnf("modulith job %s (%s, service %s) failed: %s",
                    job.id(), job.jobType(), job.correlationKey(), e.getMessage());
        }
        report(job, outcome, detail, retryable);
    }

    private void report(AsyncJob job, String outcome, String detail, boolean retryable) {
        try {
            // Echo the claimed attempt number: the ledger CAS rejects this report
            // if the lease expired and the job was reclaimed meanwhile.
            jobService.report(job.tenantCode(), job.id(),
                    new ReportJobRequest(workerId, outcome, detail, retryable, job.attempts()));
        } catch (Exception e) {
            // The lease expires and the job becomes claimable again; the re-run is
            // safe because handlers are idempotent.
            LOG.errorf("Failed to report modulith job %s outcome %s — lease will expire and it re-runs: %s",
                    job.id(), outcome, e.getMessage());
        }
    }
}
