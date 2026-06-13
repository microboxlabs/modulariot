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
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import java.lang.reflect.Method;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

class AsyncJobServiceTest {

    private static final int BASE_SECONDS = 60;
    private static final int MAX_SECONDS = 3600;

    @Test
    void reportFailureSchedulesBackoffRetryWhileAttemptsRemain() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        service.report("tenant-less-id", "job-1", failed());

        assertEquals(JobState.PENDING, repo.reportedState);
        assertNotNull(repo.reportedNextRetryAt);
    }

    @Test
    void backoffDoublesPerAttemptAndIsCapped() throws Exception {
        var service = new AsyncJobService(new FakeRepository(null), BASE_SECONDS, MAX_SECONDS);
        Method backoff = AsyncJobService.class.getDeclaredMethod("backoffSeconds", int.class);
        backoff.setAccessible(true);

        assertEquals(60L, backoff.invoke(service, 1));   // base * 2^0
        assertEquals(120L, backoff.invoke(service, 2));  // base * 2^1
        assertEquals(3600L, backoff.invoke(service, 10)); // capped at max
    }

    @Test
    void reportFailureParksJobWhenAttemptsExhausted() {
        var repo = new FakeRepository(runningJob(5, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", failed());

        assertEquals(JobState.FAILED, repo.reportedState);
        assertNull(repo.reportedNextRetryAt);
    }

    @Test
    void reportNonRetryableFailureParksImmediately() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("w", "FAILED", "bad config", false, null));

        assertEquals(JobState.FAILED, repo.reportedState);
    }

    @Test
    void reportSkippedClosesJobAsSucceeded() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("w", "SKIPPED", "already delivered", null, null));

        assertEquals(JobState.SUCCEEDED, repo.reportedState);
        assertNull(repo.reportedNextRetryAt);
    }

    @Test
    void reportRejectsJobsThatAreNotRunning() {
        var repo = new FakeRepository(jobInState(JobState.PENDING, 0, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);
        var request = failed();

        assertThrows(IllegalStateException.class,
                () -> service.report("t", "job-1", request));
    }

    @Test
    void retryRejectsSucceededJobs() {
        var repo = new FakeRepository(jobInState(JobState.SUCCEEDED, 1, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        assertThrows(IllegalStateException.class, () -> service.retry("t", "job-1", "actor"));
    }

    @Test
    void enqueueValidatesRequiredFields() {
        var service = new AsyncJobService(new FakeRepository(null), BASE_SECONDS, MAX_SECONDS);
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
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        var response = service.enqueue("t",
                new EnqueueJobsRequest("ecm-1", "reconciler", List.of(spec(), spec())));

        assertEquals(1, response.created().size());
        assertEquals(1, response.duplicates());
    }

    @Test
    void nullRequestBodiesAreRejected() {
        var service = new AsyncJobService(new FakeRepository(null), BASE_SECONDS, MAX_SECONDS);

        assertThrows(IllegalArgumentException.class, () -> service.enqueue("t", null));
        assertThrows(IllegalArgumentException.class, () -> service.claim("t", null));
        assertThrows(IllegalArgumentException.class, () -> service.report("t", "job-1", null));
    }

    @Test
    void claimScopesByTenantAndValidatesBounds() {
        var repo = new FakeRepository(null);
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);
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
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);
        var request = failed();

        assertThrows(IllegalStateException.class, () -> service.report("t", "job-1", request));
    }

    @Test
    void reportEchoesWorkerAndAttemptIntoLeaseCas() {
        var repo = new FakeRepository(runningJob(2, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("worker-1", "SUCCEEDED", "ok", null, 2));

        assertEquals("worker-1", repo.reportedWorkerId);
        assertEquals(2, repo.reportedExpectedAttempts);
    }

    // -----------------------------------------------------------------------

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
