package com.microboxlabs.miot.integrations.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.events.JobEventEmitter;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Generic dispatch: the worker routes each claimed job to the
 * {@link ModulithJobHandler} registered for its {@code job_type}, with no
 * per-type branching. Covers the kick gate, outcome mapping, unknown-type
 * parking, and readiness gating. Hand-rolled fakes (no Mockito on this module).
 */
class ModulithJobWorkerTest {

    private static final String CALENDAR = "calendar_sync";

    private static AsyncJob job(String id, String executor, String jobType, int attempts) {
        return new AsyncJob(
                id, "tenantA", "ecm-coordinador", executor, jobType, "1658427",
                null, 0, "dk-" + id, Map.of(), JobState.RUNNING, attempts, 5,
                null, "worker", null, null, List.of(), "listener", null, null, null);
    }

    private static ModulithJobWorker worker(AsyncJobService service, boolean enabled, ModulithJobHandler... handlers) {
        var map = new java.util.HashMap<String, ModulithJobHandler>();
        for (ModulithJobHandler h : handlers) {
            map.put(h.jobType(), h);
        }
        return new ModulithJobWorker(service, map, enabled, 20, 120);
    }

    // --- hasHandledLaneJob (kick gate) ---------------------------------------

    @Test
    void detectsHandledModulithLaneJob() {
        var w = worker(new RecordingService(), true, new FakeHandler(CALENDAR));
        var response = new EnqueueJobsResponse(List.of(job("j1", ModulithJobHandler.EXECUTOR, CALENDAR, 0)), 0);
        assertTrue(w.hasHandledLaneJob(response));
    }

    @Test
    void ignoresEcmLaneUnknownTypeAndEmpty() {
        var w = worker(new RecordingService(), true, new FakeHandler(CALENDAR));
        assertFalse(w.hasHandledLaneJob(
                new EnqueueJobsResponse(List.of(job("j1", "ecm", CALENDAR, 0)), 0)));
        assertFalse(w.hasHandledLaneJob(
                new EnqueueJobsResponse(List.of(job("j1", ModulithJobHandler.EXECUTOR, "no_handler", 0)), 0)));
        assertFalse(w.hasHandledLaneJob(new EnqueueJobsResponse(List.of(), 0)));
        assertFalse(w.hasHandledLaneJob(null));
    }

    // --- drain dispatch ------------------------------------------------------

    @Test
    void drainDispatchesByTypeAndReports() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 3)));
        service.claimResults.add(List.of());
        worker(service, true, new FakeHandler(CALENDAR)).drain();

        assertEquals(1, service.reports.size());
        ReportJobRequest report = service.reports.get(0);
        assertEquals("SUCCEEDED", report.outcome());
        assertEquals(3, report.attempts(), "echoes the claimed attempt for the lease CAS");
    }

    @Test
    void drainReportsFailedWhenHandlerThrows() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of());
        var handler = new FakeHandler(CALENDAR);
        handler.throwWith = new RuntimeException("boom");
        worker(service, true, handler).drain();

        assertEquals("FAILED", service.reports.get(0).outcome());
        assertTrue(service.reports.get(0).retryable(), "handler failures back off and retry");
    }

    @Test
    void unknownJobTypeParksNonRetryable() {
        var service = new RecordingService();
        // A ready handler keeps the worker running; the claimed job is for a type
        // no handler owns, so it parks (a retry won't conjure a handler).
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, "mystery", 1)));
        service.claimResults.add(List.of());
        worker(service, true, new FakeHandler(CALENDAR)).drain();

        assertEquals("FAILED", service.reports.get(0).outcome());
        assertFalse(service.reports.get(0).retryable());
    }

    @Test
    void drainParksNonRetryableWhenHandlerSignalsTerminal() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of());
        var handler = new FakeHandler(CALENDAR);
        handler.throwWith = new NonRetryableJobException("slot at full capacity");
        worker(service, true, handler).drain();

        assertEquals("FAILED", service.reports.get(0).outcome());
        assertFalse(service.reports.get(0).retryable(),
                "a terminal failure parks now, no backoff");
    }

    // --- http tracing --------------------------------------------------------

    @Test
    void reportCarriesTheHttpExchangesTheHandlerMade() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of());
        var handler = new FakeHandler(CALENDAR);
        handler.onHandle = () -> JobHttpTrace.record("PATCH", "http://calendar/r/1658427", 409, 12,
                "{\"status\":\"ASSIGNED\"}", "{\"error\":\"regression\"}", null);
        worker(service, true, handler).drain();

        List<Map<String, Object>> exchanges = service.reports.get(0).exchanges();
        assertEquals(1, exchanges.size());
        assertEquals(409, exchanges.get(0).get("status"));
        assertEquals("{\"error\":\"regression\"}", exchanges.get(0).get("responseBody"));
    }

    @Test
    void aFailedAttemptKeepsTheExchangesThatExplainIt() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of());
        var handler = new FakeHandler(CALENDAR);
        handler.onHandle = () -> JobHttpTrace.record("POST", "http://alerce/svc", 500, 30,
                "{}", "ERROR_ACCION: REMOLQUE NO EXISTE", null);
        handler.throwWith = new RuntimeException("boom");
        worker(service, true, handler).drain();

        ReportJobRequest report = service.reports.get(0);
        assertEquals("FAILED", report.outcome());
        assertEquals("ERROR_ACCION: REMOLQUE NO EXISTE", report.exchanges().get(0).get("responseBody"),
                "the downstream's reason survives the failure — that is the point");
    }

    @Test
    void aJobThatMakesNoCallReportsAnEmptyTimeline() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of());
        worker(service, true, new FakeHandler(CALENDAR)).drain();

        assertTrue(service.reports.get(0).exchanges().isEmpty());
    }

    @Test
    void oneJobsExchangesNeverLeakIntoTheNext() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of(job("job-2", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        service.claimResults.add(List.of());
        var handler = new FakeHandler(CALENDAR);
        handler.onHandle = () -> JobHttpTrace.record("GET", "http://calendar/slots", 200, 1, null, "[]", null);
        worker(service, true, handler).drain();

        assertEquals(2, service.reports.size());
        assertEquals(1, service.reports.get(0).exchanges().size());
        assertEquals(1, service.reports.get(1).exchanges().size(), "the window is per attempt, not cumulative");
    }

    // --- gating --------------------------------------------------------------

    @Test
    void disabledWorkerNeverClaims() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        worker(service, false, new FakeHandler(CALENDAR)).drain();
        assertEquals(0, service.claimCalls);
    }

    @Test
    void noReadyHandlerNeverClaims() {
        var service = new RecordingService();
        service.claimResults.add(List.of(job("job-1", ModulithJobHandler.EXECUTOR, CALENDAR, 1)));
        var handler = new FakeHandler(CALENDAR);
        handler.ready = false;
        worker(service, true, handler).drain();
        assertEquals(0, service.claimCalls, "no ready handler → nothing to claim for");
    }

    // --- fakes ---------------------------------------------------------------

    private static final class FakeHandler implements ModulithJobHandler {
        private final String jobType;
        boolean ready = true;
        RuntimeException throwWith;
        /** Stands in for the HTTP calls a real handler makes. */
        Runnable onHandle;

        FakeHandler(String jobType) {
            this.jobType = jobType;
        }

        @Override
        public String jobType() {
            return jobType;
        }

        @Override
        public boolean isReady() {
            return ready;
        }

        @Override
        public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
            if (onHandle != null) {
                onHandle.run();
            }
            if (throwWith != null) {
                throw throwWith;
            }
            return JobOutcome.succeeded("ok");
        }
    }

    private static final class RecordingService extends AsyncJobService {
        final Deque<List<AsyncJob>> claimResults = new ArrayDeque<>();
        final List<ReportJobRequest> reports = new ArrayList<>();
        int claimCalls;

        RecordingService() {
            super(new NoopRepository(), new JobEventEmitter(Optional.empty()), null, 60, 3600);
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
}
