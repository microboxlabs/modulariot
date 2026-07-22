package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.ClaimJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.events.JobEventEmitter;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import jakarta.enterprise.event.Event;
import jakarta.enterprise.event.NotificationOptions;
import jakarta.enterprise.util.TypeLiteral;
import java.lang.annotation.Annotation;
import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.CompletionStage;
import org.junit.jupiter.api.Test;

class AsyncJobServiceTest {

    private static final int BASE_SECONDS = 60;
    private static final int MAX_SECONDS = 3600;

    @Test
    void reportFailureSchedulesBackoffRetryWhileAttemptsRemain() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        service.report("tenant-less-id", "job-1", failed());

        assertEquals(JobState.PENDING, repo.reportedState);
        assertNotNull(repo.reportedNextRetryAt);
    }

    @Test
    void backoffDoublesPerAttemptAndIsCapped() throws Exception {
        var service = new AsyncJobService(new FakeRepository(null), noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);
        Method backoff = AsyncJobService.class.getDeclaredMethod("backoffSeconds", int.class);
        backoff.setAccessible(true);

        assertEquals(60L, backoff.invoke(service, 1));   // base * 2^0
        assertEquals(120L, backoff.invoke(service, 2));  // base * 2^1
        assertEquals(3600L, backoff.invoke(service, 10)); // capped at max
    }

    @Test
    void reportFailureParksJobWhenAttemptsExhausted() {
        var repo = new FakeRepository(runningJob(5, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", failed());

        assertEquals(JobState.FAILED, repo.reportedState);
        assertNull(repo.reportedNextRetryAt);
    }

    @Test
    void reportNonRetryableFailureParksImmediately() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("w", "FAILED", "bad config", false, null));

        assertEquals(JobState.FAILED, repo.reportedState);
    }

    @Test
    void reportSkippedClosesJobAsSucceeded() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("w", "SKIPPED", "already delivered", null, null));

        assertEquals(JobState.SUCCEEDED, repo.reportedState);
        assertNull(repo.reportedNextRetryAt);
    }

    @Test
    void reportRejectsJobsThatAreNotRunning() {
        var repo = new FakeRepository(jobInState(JobState.PENDING, 0, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);
        var request = failed();

        assertThrows(IllegalStateException.class,
                () -> service.report("t", "job-1", request));
    }

    @Test
    void retryRejectsSucceededJobs() {
        var repo = new FakeRepository(jobInState(JobState.SUCCEEDED, 1, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        assertThrows(IllegalStateException.class, () -> service.retry("t", "job-1", "actor"));
    }

    @Test
    void enqueueValidatesRequiredFields() {
        var service = new AsyncJobService(new FakeRepository(null), noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);
        var missingSource = new EnqueueJobsRequest(null, "listener", List.of(spec()));
        var emptyJobs = new EnqueueJobsRequest("ecm-1", "listener", List.of());
        var bogusActor = new EnqueueJobsRequest("ecm-1", "bogus", List.of(spec()));

        assertThrows(IllegalArgumentException.class, () -> service.enqueue("t", missingSource));
        assertThrows(IllegalArgumentException.class, () -> service.enqueue("t", emptyJobs));
        assertThrows(IllegalArgumentException.class, () -> service.enqueue("t", bogusActor));
    }

    @Test
    void enqueueCountsDuplicates() {
        var repo = new FakeRepository(null) {
            private int calls = 0;

            @Override
            public AsyncJob insert(AsyncJob job) {
                // first insert wins, second hits the dedupe key
                return ++calls == 1 ? job : null;
            }
        };
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        var response = service.enqueue("t",
                new EnqueueJobsRequest("ecm-1", "reconciler", List.of(spec(), spec())));

        assertEquals(1, response.created().size());
        assertEquals(1, response.duplicates());
    }

    @Test
    void nullRequestBodiesAreRejected() {
        var service = new AsyncJobService(new FakeRepository(null), noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        assertThrows(IllegalArgumentException.class, () -> service.enqueue("t", null));
        assertThrows(IllegalArgumentException.class, () -> service.claim("t", null));
        assertThrows(IllegalArgumentException.class, () -> service.report("t", "job-1", null));
    }

    @Test
    void claimScopesByTenantAndValidatesBounds() {
        var repo = new FakeRepository(null);
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);
        var badLimit = new ClaimJobsRequest("ecm", "w1", 0, null, null);
        var badLease = new ClaimJobsRequest("ecm", "w1", null, 0, null);

        assertThrows(IllegalArgumentException.class, () -> service.claim("t", badLimit));
        assertThrows(IllegalArgumentException.class, () -> service.claim("t", badLease));

        service.claim("tenant-1", new ClaimJobsRequest("ecm", "w1", 5, 60, null));
        assertEquals("tenant-1", repo.claimedTenant);
    }

    @Test
    void staleReportIsRejectedWhenLeaseCasFails() {
        var repo = new FakeRepository(runningJob(1, 5));
        repo.reportStale = true;
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);
        var request = failed();

        assertThrows(IllegalStateException.class, () -> service.report("t", "job-1", request));
    }

    @Test
    void reportEchoesWorkerAndAttemptIntoLeaseCas() {
        var repo = new FakeRepository(runningJob(2, 5));
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("worker-1", "SUCCEEDED", "ok", null, 2));

        assertEquals("worker-1", repo.reportedWorkerId);
        assertEquals(2, repo.reportedExpectedAttempts);
    }

    @Test
    void reportEmitsTransitionEvents() {
        var emitter = new RecordingEmitter();
        var service = new AsyncJobService(new FakeRepository(runningJob(1, 5)), emitter, noParked(), BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", failed());

        assertEquals(List.of("retry_scheduled"), emitter.transitions);
    }

    @Test
    void retryEmitsRetriedEvent() {
        var emitter = new RecordingEmitter();
        var service = new AsyncJobService(new FakeRepository(jobInState(JobState.FAILED, 5, 5)),
                emitter, noParked(), BASE_SECONDS, MAX_SECONDS);

        service.retry("t", "job-1", "operator@test.example");

        assertEquals(List.of("retried"), emitter.transitions);
    }

    @Test
    void enqueueEmitsEnqueuedPerCreatedJobOnly() {
        var repo = new FakeRepository(null) {
            private int calls = 0;

            @Override
            public AsyncJob insert(AsyncJob job) {
                return ++calls == 1 ? job : null; // second insert is a dedupe hit
            }
        };
        var emitter = new RecordingEmitter();
        var service = new AsyncJobService(repo, emitter, noParked(), BASE_SECONDS, MAX_SECONDS);

        service.enqueue("t", new EnqueueJobsRequest("ecm-1", "listener", List.of(spec(), spec())));

        assertEquals(List.of("enqueued"), emitter.transitions);
    }

    @Test
    void countsZeroFillsEveryState() {
        var repo = new FakeRepository(null) {
            @Override
            public Map<String, Integer> countByState(String tenantCode) {
                return Map.of("FAILED", 2);
            }
        };
        var service = new AsyncJobService(repo, noEvents(), noParked(), BASE_SECONDS, MAX_SECONDS);

        Map<String, Integer> counts = service.counts("t");

        assertEquals(2, counts.get("FAILED"));
        assertEquals(0, counts.get("PENDING"));
        assertEquals(JobState.values().length, counts.size());
    }

    @Test
    void reportParkFiresParkedEvent() {
        var parked = new RecordingParkedEvent();
        var service = new AsyncJobService(new FakeRepository(runningJob(5, 5)), noEvents(), parked,
                BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", failed());

        assertEquals(1, parked.fired.size());
        assertEquals("job-1", parked.fired.get(0).job().id());
    }

    @Test
    void reportRetrySchedulingDoesNotFireParkedEvent() {
        var parked = new RecordingParkedEvent();
        var service = new AsyncJobService(new FakeRepository(runningJob(1, 5)), noEvents(), parked,
                BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", failed());

        assertEquals(List.of(), parked.fired);
    }

    @Test
    void parkedObserverFailureDoesNotBreakTheReport() {
        var repo = new FakeRepository(runningJob(5, 5));
        var parked = new RecordingParkedEvent();
        parked.throwOnFire = new IllegalStateException("observer blew up");
        var service = new AsyncJobService(repo, noEvents(), parked, BASE_SECONDS, MAX_SECONDS);

        assertNotNull(service.report("t", "job-1", failed()));
        assertEquals(JobState.FAILED, repo.reportedState);
    }

    // -----------------------------------------------------------------------

    private static JobEventEmitter noEvents() {
        return new JobEventEmitter(Optional.empty());
    }

    private static Event<JobParkedEvent> noParked() {
        return new RecordingParkedEvent();
    }

    /** Captures fired park events instead of dispatching to CDI observers. */
    private static class RecordingParkedEvent implements Event<JobParkedEvent> {
        final List<JobParkedEvent> fired = new ArrayList<>();
        RuntimeException throwOnFire;

        @Override
        public void fire(JobParkedEvent event) {
            if (throwOnFire != null) {
                throw throwOnFire;
            }
            fired.add(event);
        }

        @Override
        public <U extends JobParkedEvent> CompletionStage<U> fireAsync(U event) {
            throw new UnsupportedOperationException();
        }

        @Override
        public <U extends JobParkedEvent> CompletionStage<U> fireAsync(U event, NotificationOptions options) {
            throw new UnsupportedOperationException();
        }

        @Override
        public Event<JobParkedEvent> select(Annotation... qualifiers) {
            throw new UnsupportedOperationException();
        }

        @Override
        public <U extends JobParkedEvent> Event<U> select(Class<U> subtype, Annotation... qualifiers) {
            throw new UnsupportedOperationException();
        }

        @Override
        public <U extends JobParkedEvent> Event<U> select(TypeLiteral<U> subtype, Annotation... qualifiers) {
            throw new UnsupportedOperationException();
        }
    }

    /** Captures transitions instead of POSTing to quarkus-sse. */
    private static class RecordingEmitter extends JobEventEmitter {
        final List<String> transitions = new ArrayList<>();

        RecordingEmitter() {
            super(Optional.empty());
        }

        @Override
        public void emit(AsyncJob job, String transition) {
            if (job != null) {
                transitions.add(transition);
            }
        }
    }

    private static ReportJobRequest failed() {
        return new ReportJobRequest("worker-1", "FAILED", "Alerce 500", null, null);
    }

    private static AsyncJobSpec spec() {
        return new AsyncJobSpec("alerce_arrival", "ecm", "v1", "chain-1", 0, "dk-1", Map.of(), null);
    }

    private static AsyncJob runningJob(int attempts, int maxAttempts) {
        return jobInState(JobState.RUNNING, attempts, maxAttempts);
    }

    private static AsyncJob jobInState(JobState state, int attempts, int maxAttempts) {
        return new AsyncJob("job-1", "t", "ecm-1", "ecm", "alerce_arrival", "v1",
                "chain-1", 0, "dk-1", Map.of(), state, attempts, maxAttempts,
                null, null, null, null, List.of(), "listener", null, null);
    }

    /** Repository stub capturing the state transition computed by the service. */
    private static class FakeRepository extends AsyncJobRepository {

        private final AsyncJob existing;
        JobState reportedState;
        OffsetDateTime reportedNextRetryAt;
        String reportedWorkerId;
        Integer reportedExpectedAttempts;
        String claimedTenant;
        boolean reportStale;

        FakeRepository(AsyncJob existing) {
            super(null);
            this.existing = existing;
        }

        @Override
        public AsyncJob findByTenantAndId(String tenantCode, String jobId) {
            return existing;
        }

        @Override
        public AsyncJob report(String jobId, String workerId, int expectedAttempts, JobState newState,
                OffsetDateTime nextRetryAt, String lastError, Map<String, Object> attemptEntry) {
            this.reportedState = newState;
            this.reportedNextRetryAt = nextRetryAt;
            this.reportedWorkerId = workerId;
            this.reportedExpectedAttempts = expectedAttempts;
            return reportStale ? null : existing;
        }

        @Override
        public List<AsyncJob> claim(String tenantCode, String executor, String workerId,
                int limit, int leaseSeconds, String chainKey) {
            this.claimedTenant = tenantCode;
            return List.of();
        }

        @Override
        public AsyncJob insert(AsyncJob job) {
            return job;
        }

        @Override
        public AsyncJob retry(String jobId, Map<String, Object> attemptEntry) {
            return existing;
        }
    }
}
