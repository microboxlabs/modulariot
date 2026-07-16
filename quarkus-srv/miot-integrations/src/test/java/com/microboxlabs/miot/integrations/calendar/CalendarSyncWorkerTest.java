package com.microboxlabs.miot.integrations.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/**
 * Dispatch gating ({@link CalendarSyncWorker#hasModulithCalendarJob}) and the
 * claim → execute → report drain loop, including outcome mapping and the
 * attempt echo used by the ledger's lease CAS. Uses hand-rolled fakes (no
 * Mockito on this module).
 */
class CalendarSyncWorkerTest {

    private static AsyncJob job(String id, String executor, String jobType, int attempts) {
        return new AsyncJob(
                id, "tenantA", "ecm-coordinador", executor, jobType, "1658427",
                null, 0, "dk-" + id, Map.of(), JobState.RUNNING, attempts, 5,
                null, "worker", null, null, List.of(), "listener", null, null);
    }

    // --- hasModulithCalendarJob (dispatch gate) ------------------------------

    @Test
    void detectsModulithLaneCalendarJob() {
        var response = new EnqueueJobsResponse(
                List.of(job("j1", CalendarSyncFeature.EXECUTOR, CalendarSyncFeature.JOB_TYPE, 0)), 0);
        assertTrue(CalendarSyncWorker.hasModulithCalendarJob(response));
    }

    @Test
    void ignoresEcmLaneOtherTypesAndEmpty() {
        assertFalse(CalendarSyncWorker.hasModulithCalendarJob(
                new EnqueueJobsResponse(List.of(job("j1", "ecm", CalendarSyncFeature.JOB_TYPE, 0)), 0)));
        assertFalse(CalendarSyncWorker.hasModulithCalendarJob(
                new EnqueueJobsResponse(List.of(job("j1", CalendarSyncFeature.EXECUTOR, "whatsapp_pod_notify", 0)), 0)));
        assertFalse(CalendarSyncWorker.hasModulithCalendarJob(new EnqueueJobsResponse(List.of(), 0)));
        assertFalse(CalendarSyncWorker.hasModulithCalendarJob(null));
    }

    // --- drain loop ----------------------------------------------------------

    @Test
    void drainClaimsExecutesReportsUntilEmpty() {
        var service = new RecordingService();
        // one claimable job, then the lane is empty
        service.claimResults.add(List.of(job("job-1", CalendarSyncFeature.EXECUTOR, CalendarSyncFeature.JOB_TYPE, 3)));
        service.claimResults.add(List.of());
        var worker = new CalendarSyncWorker(service, new StubExecutor(), new StubClient(true), true, 20, 120);

        worker.drain();

        assertEquals(1, service.reports.size());
        ReportJobRequest report = service.reports.get(0);
        assertEquals("SUCCEEDED", report.outcome());
        assertEquals(3, report.attempts(), "echoes the claimed attempt number for the lease CAS");
    }

    @Test
    void drainReportsFailedWhenExecutorThrows() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", CalendarSyncFeature.EXECUTOR, CalendarSyncFeature.JOB_TYPE, 1)));
        service.claimResults.add(List.of());
        var executor = new StubExecutor();
        executor.throwWith = new CalendarBookingsHttpException(500, "boom");
        var worker = new CalendarSyncWorker(service, executor, new StubClient(true), true, 20, 120);

        worker.drain();

        assertEquals("FAILED", service.reports.get(0).outcome());
    }

    @Test
    void disabledWorkerNeverClaims() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", CalendarSyncFeature.EXECUTOR, CalendarSyncFeature.JOB_TYPE, 1)));
        new CalendarSyncWorker(service, new StubExecutor(), new StubClient(true), false, 20, 120).drain();
        assertEquals(0, service.claimCalls);
    }

    @Test
    void unconfiguredCalendarClientSkips() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", CalendarSyncFeature.EXECUTOR, CalendarSyncFeature.JOB_TYPE, 1)));
        new CalendarSyncWorker(service, new StubExecutor(), new StubClient(false), true, 20, 120).drain();
        assertEquals(0, service.claimCalls, "no base URL configured → worker stays idle");
    }

    // --- fakes ---------------------------------------------------------------

    private static final class RecordingService extends AsyncJobService {
        final Deque<List<AsyncJob>> claimResults = new ArrayDeque<>();
        final List<ReportJobRequest> reports = new ArrayList<>();
        int claimCalls;

        RecordingService() {
            super(new NoopRepository(), 60, 3600);
        }

        @Override
        public List<AsyncJob> claimForExecutor(String executor, String workerId, int limit, int leaseSeconds) {
            claimCalls++;
            return claimResults.isEmpty() ? List.of() : claimResults.poll();
        }

        @Override
        public AsyncJob report(String tenantCode, String jobId, ReportJobRequest request) {
            reports.add(request);
            return null;
        }
    }

    private static final class NoopRepository extends AsyncJobRepository {
        NoopRepository() {
            super(null);
        }
    }

    private static final class StubExecutor extends CalendarSyncExecutor {
        RuntimeException throwWith;

        StubExecutor() {
            super(new StubClient(true));
        }

        @Override
        public Result execute(Map<String, Object> payload) {
            if (throwWith != null) {
                throw throwWith;
            }
            return new Result("SUCCEEDED", "ok");
        }
    }

    private static final class StubClient extends CalendarBookingsClient {
        private final boolean configured;

        StubClient(boolean configured) {
            this.configured = configured;
        }

        @Override
        public boolean isConfigured() {
            return configured;
        }
    }
}
