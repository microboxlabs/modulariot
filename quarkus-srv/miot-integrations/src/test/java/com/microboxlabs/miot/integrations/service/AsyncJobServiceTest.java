package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.ReportJobRequest;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
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
        // attempt 1 → base * 2^0 = 60s
        assertTrue(repo.reportedNextRetryAt.isAfter(OffsetDateTime.now().plusSeconds(BASE_SECONDS - 10)));
        assertTrue(repo.reportedNextRetryAt.isBefore(OffsetDateTime.now().plusSeconds(BASE_SECONDS + 10)));
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

        service.report("t", "job-1", new ReportJobRequest("w", "FAILED", "bad config", false));

        assertEquals(JobState.FAILED, repo.reportedState);
    }

    @Test
    void reportSkippedClosesJobAsSucceeded() {
        var repo = new FakeRepository(runningJob(1, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        service.report("t", "job-1", new ReportJobRequest("w", "SKIPPED", "already delivered", null));

        assertEquals(JobState.SUCCEEDED, repo.reportedState);
        assertNull(repo.reportedNextRetryAt);
    }

    @Test
    void reportRejectsJobsThatAreNotRunning() {
        var repo = new FakeRepository(jobInState(JobState.PENDING, 0, 5));
        var service = new AsyncJobService(repo, BASE_SECONDS, MAX_SECONDS);

        assertThrows(IllegalStateException.class,
                () -> service.report("t", "job-1", failed()));
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

        assertThrows(IllegalArgumentException.class,
                () -> service.enqueue("t", new EnqueueJobsRequest(null, "listener", List.of(spec()))));
        assertThrows(IllegalArgumentException.class,
                () -> service.enqueue("t", new EnqueueJobsRequest("ecm-1", "listener", List.of())));
        assertThrows(IllegalArgumentException.class,
                () -> service.enqueue("t", new EnqueueJobsRequest("ecm-1", "bogus", List.of(spec()))));
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

    // -----------------------------------------------------------------------

    private static ReportJobRequest failed() {
        return new ReportJobRequest("worker-1", "FAILED", "Alerce 500", null);
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

        FakeRepository(AsyncJob existing) {
            super(null);
            this.existing = existing;
        }

        @Override
        public AsyncJob findByTenantAndId(String tenantCode, String jobId) {
            return existing;
        }

        @Override
        public AsyncJob report(String jobId, JobState newState, OffsetDateTime nextRetryAt,
                String lastError, Map<String, Object> attemptEntry) {
            this.reportedState = newState;
            this.reportedNextRetryAt = nextRetryAt;
            return existing;
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
