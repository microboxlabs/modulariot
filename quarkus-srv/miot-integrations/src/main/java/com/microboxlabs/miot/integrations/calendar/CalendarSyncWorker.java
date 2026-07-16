package com.microboxlabs.miot.integrations.calendar;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import io.quarkus.scheduler.Scheduled;
import io.smallrye.mutiny.infrastructure.Infrastructure;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.List;
import java.util.UUID;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Runs {@code calendar_sync} jobs off ECM, inside the modulith.
 *
 * <p>Dispatch is two-pronged, both funneling through the same
 * lease-and-CAS-guarded ledger claim so they are safe to overlap:
 * <ul>
 *   <li><b>Fast path</b> ({@link #onEnqueued}): the async-jobs REST resource
 *       calls this right after ECM's {@code /enqueue} lands a modulith-lane job,
 *       so it runs in ~milliseconds instead of waiting for the poll.</li>
 *   <li><b>Reconciler</b> ({@link #drainScheduled}): a periodic sweep that
 *       catches jobs the fast path missed — a lost kick, a modulith restart
 *       mid-flight, or a backoff retry that is now due. This is also the sole
 *       driver in a topology where nothing kicks (no broker, cron-only).</li>
 * </ul>
 *
 * <p>Off by default. Enable ({@code miot.integrations.calendar-sync.worker.enabled})
 * and configure the miot-calendar base URL BEFORE flipping ECM's lane to
 * {@code modulith}, else enqueued jobs sit unclaimed (ECM no longer runs them).
 */
@ApplicationScoped
public class CalendarSyncWorker {

    private static final Logger LOG = Logger.getLogger(CalendarSyncWorker.class);
    private static final String OUTCOME_FAILED = "FAILED";

    private final AsyncJobService jobService;
    private final CalendarSyncExecutor executor;
    private final CalendarBookingsClient bookingsClient;
    private final boolean enabled;
    private final int claimLimit;
    private final int leaseSeconds;
    private final String workerId;

    CalendarSyncWorker(
            AsyncJobService jobService,
            CalendarSyncExecutor executor,
            CalendarBookingsClient bookingsClient,
            @ConfigProperty(name = "miot.integrations.calendar-sync.worker.enabled", defaultValue = "false")
                    boolean enabled,
            @ConfigProperty(name = "miot.integrations.calendar-sync.claim-limit", defaultValue = "20")
                    int claimLimit,
            @ConfigProperty(name = "miot.integrations.calendar-sync.lease-seconds", defaultValue = "120")
                    int leaseSeconds) {
        this.jobService = jobService;
        this.executor = executor;
        this.bookingsClient = bookingsClient;
        this.enabled = enabled;
        this.claimLimit = claimLimit;
        this.leaseSeconds = leaseSeconds;
        this.workerId = "calendar-sync-" + UUID.randomUUID().toString().substring(0, 8);
    }

    /** Reconciler / safety net — see class javadoc. */
    @Scheduled(
            every = "${miot.integrations.calendar-sync.claim-every:30s}",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void drainScheduled() {
        drain();
    }

    /**
     * Fast path: if this enqueue batch created a modulith-lane calendar_sync job,
     * kick a drain on the worker pool (off the request thread). Never throws —
     * the reconciler is the backstop if the kick is dropped.
     */
    public void onEnqueued(EnqueueJobsResponse response) {
        if (!enabled || !hasModulithCalendarJob(response)) {
            return;
        }
        Infrastructure.getDefaultWorkerPool().execute(this::drain);
    }

    static boolean hasModulithCalendarJob(EnqueueJobsResponse response) {
        if (response == null || response.created() == null) {
            return false;
        }
        return response.created().stream().anyMatch(job ->
                CalendarSyncFeature.EXECUTOR.equals(job.executor())
                        && CalendarSyncFeature.JOB_TYPE.equals(job.jobType()));
    }

    /**
     * Claims and runs modulith-lane jobs one at a time until the lane is drained
     * or the batch budget is spent. One-at-a-time so a slow miot-calendar call
     * cannot expire the leases of jobs claimed alongside it.
     */
    void drain() {
        if (!ready()) {
            return;
        }
        int remaining = Math.max(claimLimit, 1);
        while (remaining-- > 0) {
            List<AsyncJob> batch;
            try {
                batch = jobService.claimForExecutor(CalendarSyncFeature.EXECUTOR, workerId, 1, leaseSeconds);
            } catch (Exception e) {
                LOG.error("calendar_sync claim failed — reconciler will retry", e);
                return;
            }
            if (batch.isEmpty()) {
                return;
            }
            executeAndReport(batch.get(0));
        }
    }

    private boolean ready() {
        if (!enabled) {
            return false;
        }
        if (!bookingsClient.isConfigured()) {
            LOG.warn("calendar_sync worker enabled but miot-calendar base-url is not configured — skipping");
            return false;
        }
        return true;
    }

    private void executeAndReport(AsyncJob job) {
        String outcome;
        String detail;
        try {
            CalendarSyncExecutor.Result result = executor.execute(job.payload());
            outcome = result.outcome();
            detail = result.detail();
        } catch (Exception e) {
            outcome = OUTCOME_FAILED;
            detail = e.getMessage();
            LOG.warnf("calendar_sync job %s (service %s) failed: %s",
                    job.id(), job.correlationKey(), e.getMessage());
        }
        try {
            // Echo the claimed attempt number: the ledger CAS rejects this report
            // if the lease expired and the job was reclaimed meanwhile.
            jobService.report(job.tenantCode(), job.id(),
                    new ReportJobRequest(workerId, outcome, detail, true, job.attempts()));
        } catch (Exception e) {
            // The lease expires and the job becomes claimable again; the re-run is
            // safe because miot-calendar pushes are idempotent (forward-only).
            LOG.errorf("Failed to report calendar_sync job %s outcome %s — lease will expire and it re-runs: %s",
                    job.id(), outcome, e.getMessage());
        }
    }
}
