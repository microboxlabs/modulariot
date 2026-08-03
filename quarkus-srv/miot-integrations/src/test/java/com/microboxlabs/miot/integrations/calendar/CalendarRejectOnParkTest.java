package com.microboxlabs.miot.integrations.calendar;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.events.JobEventEmitter;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.jobs.TestWorkers;
import com.microboxlabs.miot.integrations.persistence.AsyncJobRepository;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.junit.jupiter.api.Test;

/**
 * Park-hook policy for the REJECTED stamp: only configured push job types with
 * a chain stamp, coordinates come from the chain's calendar_sync sibling, the
 * reject job is standalone (no chain key — it must run while the chain is
 * stuck), and nothing thrown here may escape into the report path.
 */
class CalendarRejectOnParkTest {

    private static final UUID CAL = UUID.fromString("3b4808f2-68ae-4b45-b921-f5a012a8962a");
    private static final String CHAIN = "calsync:chain:proc-9:task-3";

    private final FakeRepository repository = new FakeRepository();
    private final RecordingJobService jobService = new RecordingJobService();
    private final TestWorkers.RecordingWorker worker = new TestWorkers.RecordingWorker(jobService);
    private final CalendarRejectOnPark hook =
            new CalendarRejectOnPark(List.of("alerce_assignment"), repository, jobService, worker);

    @Test
    void parkedPushEnqueuesStandaloneRejectWithSiblingCoordinates() {
        repository.chainJobs = List.of(syncLeg());

        hook.onParked(new JobParkedEvent(parked("alerce_assignment", CHAIN)));

        assertEquals("tenant-1", jobService.enqueuedTenant);
        assertEquals("ecm-1", jobService.lastRequest.sourceInstance());
        AsyncJobSpec spec = jobService.lastRequest.jobs().get(0);
        assertEquals(CalendarRejectFeature.JOB_TYPE, spec.jobType());
        assertEquals("modulith", spec.executor());
        assertEquals("87920845", spec.correlationKey());
        assertNull(spec.chainKey());
        assertEquals("reject:job-1:5", spec.dedupeKey());
        assertEquals("1658427-V", spec.payload().get(CalendarRejectFeature.PAYLOAD_RESOURCE_ID));
        assertEquals(CAL.toString(), spec.payload().get(CalendarRejectFeature.PAYLOAD_CALENDAR_ID));
        assertEquals("87920845", spec.payload().get(CalendarRejectFeature.PAYLOAD_SERVICE_CODE));
        assertEquals("Alerce rejected: CONDUCTOR2 NO EXISTE",
                spec.payload().get(CalendarRejectFeature.PAYLOAD_DETAIL));
        assertEquals(1, worker.kicks.size());
    }

    @Test
    void oversizedLastErrorIsTruncatedIntoThePayload() {
        repository.chainJobs = List.of(syncLeg());
        AsyncJob job = parkedWithError("alerce_assignment", CHAIN, "x".repeat(700));

        hook.onParked(new JobParkedEvent(job));

        String detail = (String) jobService.lastRequest.jobs().get(0)
                .payload().get(CalendarRejectFeature.PAYLOAD_DETAIL);
        assertEquals(CalendarRejectFeature.DETAIL_MAX_LENGTH, detail.length());
    }

    @Test
    void unlistedJobTypesAreIgnored() {
        repository.chainJobs = List.of(syncLeg());

        hook.onParked(new JobParkedEvent(parked("calendar_sync", CHAIN)));
        hook.onParked(new JobParkedEvent(parked("calendar_confirm", CHAIN)));

        assertNull(jobService.lastRequest);
        assertTrue(worker.kicks.isEmpty());
    }

    @Test
    void chainlessParkIsIgnored() {
        repository.chainJobs = List.of(syncLeg());

        hook.onParked(new JobParkedEvent(parked("alerce_assignment", null)));

        assertNull(jobService.lastRequest);
    }

    @Test
    void missingSyncSiblingSkipsTheStamp() {
        repository.chainJobs = List.of();

        hook.onParked(new JobParkedEvent(parked("alerce_assignment", CHAIN)));

        assertNull(jobService.lastRequest);
    }

    @Test
    void hookSwallowsItsOwnFailures() {
        repository.listThrows = new IllegalStateException("db down");

        hook.onParked(new JobParkedEvent(parked("alerce_assignment", CHAIN)));

        assertNull(jobService.lastRequest);
    }

    // -----------------------------------------------------------------------

    private static AsyncJob syncLeg() {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(CalendarSyncFeature.PAYLOAD_RESOURCE_ID, "1658427-V");
        payload.put(CalendarSyncFeature.PAYLOAD_CALENDAR_ID, CAL.toString());
        payload.put(CalendarSyncFeature.PAYLOAD_SERVICE_CODE, "87920845");
        return new AsyncJob("job-0", "tenant-1", "ecm-1", "modulith", CalendarSyncFeature.JOB_TYPE,
                "87920845", CHAIN, 0, "dk-0", payload, JobState.SUCCEEDED, 1, 5,
                null, null, null, null, List.of(), "listener", null, null, null);
    }

    private static AsyncJob parked(String jobType, String chainKey) {
        return parkedWithError(jobType, chainKey, "Alerce rejected: CONDUCTOR2 NO EXISTE");
    }

    private static AsyncJob parkedWithError(String jobType, String chainKey, String lastError) {
        return new AsyncJob("job-1", "tenant-1", "ecm-1", "ecm", jobType,
                "87920845", chainKey, 1, "dk-1", Map.of(), JobState.FAILED, 5, 5,
                null, null, null, lastError, List.of(), "listener", null, null, null);
    }

    /** Returns canned chain jobs for the sibling lookup. */
    private static class FakeRepository extends AsyncJobRepository {
        List<AsyncJob> chainJobs = List.of();
        RuntimeException listThrows;

        FakeRepository() {
            super(null);
        }

        @Override
        public List<AsyncJob> list(String tenantCode, String state, String correlationKey,
                String jobType, String chainKey, int limit) {
            if (listThrows != null) {
                throw listThrows;
            }
            return chainJobs;
        }
    }

    /** Captures the enqueue instead of hitting the ledger. */
    private static class RecordingJobService extends AsyncJobService {
        String enqueuedTenant;
        EnqueueJobsRequest lastRequest;

        RecordingJobService() {
            super(null, new JobEventEmitter(Optional.empty()), null, 60, 3600);
        }

        @Override
        public EnqueueJobsResponse enqueue(String tenantCode, EnqueueJobsRequest request) {
            this.enqueuedTenant = tenantCode;
            this.lastRequest = request;
            return new EnqueueJobsResponse(List.of(), 0);
        }
    }
}
