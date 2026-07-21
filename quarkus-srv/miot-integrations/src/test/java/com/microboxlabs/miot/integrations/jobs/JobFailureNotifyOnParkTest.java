package com.microboxlabs.miot.integrations.jobs;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobNotificationRule;
import com.microboxlabs.miot.integrations.domain.JobState;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.events.JobEventEmitter;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.persistence.JobNotificationRuleRepository;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/**
 * Park-hook policy for failure notifications: enabled rules for the parked
 * type fire one notification job each, the throttle slot is claimed before
 * enqueueing (a burst coalesces), the notification type never matches itself,
 * and nothing thrown here may escape into the report path.
 */
class JobFailureNotifyOnParkTest {

    private final FakeRules rules = new FakeRules();
    private final RecordingJobService jobService = new RecordingJobService();
    private final TestWorkers.RecordingWorker worker = new TestWorkers.RecordingWorker(jobService);
    private final JobFailureNotifyOnPark hook = new JobFailureNotifyOnPark(rules, jobService, worker);

    @Test
    void matchingRuleEnqueuesSelfContainedNotification() {
        rules.enabled = List.of(rule(List.of("+56911111111", "+56922222222"), null, null));

        hook.onParked(new JobParkedEvent(parked("alerce_assignment")));

        assertEquals("tenant-1", jobService.enqueuedTenant);
        AsyncJobSpec spec = jobService.lastRequest.jobs().get(0);
        assertEquals(JobFailureNotificationFeature.JOB_TYPE, spec.jobType());
        assertEquals(ModulithJobHandler.EXECUTOR, spec.executor());
        assertNull(spec.chainKey());
        assertEquals("notify:rule-1:job-1:5", spec.dedupeKey());
        assertEquals("tenant-1", spec.payload().get(JobFailureNotificationFeature.PAYLOAD_TENANT_CODE));
        assertEquals(List.of("+56911111111", "+56922222222"),
                spec.payload().get(JobFailureNotificationFeature.PAYLOAD_RECIPIENTS));
        assertEquals("job-1", spec.payload().get(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_ID));
        assertEquals("alerce_assignment",
                spec.payload().get(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_TYPE));
        assertEquals("87920845", spec.payload().get(JobFailureNotificationFeature.PAYLOAD_CORRELATION_KEY));
        assertEquals("Alerce rejected: CONDUCTOR2 NO EXISTE",
                spec.payload().get(JobFailureNotificationFeature.PAYLOAD_ERROR));
        assertFalse(spec.payload().containsKey(JobFailureNotificationFeature.PAYLOAD_TEMPLATE_NAME));
        assertEquals(1, worker.kicks.size());
    }

    @Test
    void templateFieldsRideThePayloadWhenConfigured() {
        rules.enabled = List.of(rule(List.of("+56911111111"), "job_failed_alert", "es_CL"));

        hook.onParked(new JobParkedEvent(parked("alerce_assignment")));

        Map<String, Object> payload = jobService.lastRequest.jobs().get(0).payload();
        assertEquals("job_failed_alert", payload.get(JobFailureNotificationFeature.PAYLOAD_TEMPLATE_NAME));
        assertEquals("es_CL", payload.get(JobFailureNotificationFeature.PAYLOAD_LANGUAGE));
    }

    @Test
    void throttledRuleIsSkipped() {
        rules.enabled = List.of(rule(List.of("+56911111111"), null, null));
        rules.claimWins = false;

        hook.onParked(new JobParkedEvent(parked("alerce_assignment")));

        assertNull(jobService.lastRequest);
        assertEquals(List.of("rule-1"), rules.claimedRuleIds);
    }

    @Test
    void notificationJobTypeNeverMatchesItself() {
        rules.enabled = List.of(rule(List.of("+56911111111"), null, null));

        hook.onParked(new JobParkedEvent(parked(JobFailureNotificationFeature.JOB_TYPE)));

        assertNull(rules.lookedUpJobType);
        assertNull(jobService.lastRequest);
    }

    @Test
    void ruleWithoutRecipientsNeverClaimsTheSlot() {
        rules.enabled = List.of(rule(List.of(), null, null));

        hook.onParked(new JobParkedEvent(parked("alerce_assignment")));

        assertTrue(rules.claimedRuleIds.isEmpty());
        assertNull(jobService.lastRequest);
    }

    @Test
    void hookSwallowsItsOwnFailures() {
        rules.findThrows = new IllegalStateException("db down");

        hook.onParked(new JobParkedEvent(parked("alerce_assignment")));

        assertNull(jobService.lastRequest);
    }

    // -----------------------------------------------------------------------

    private static JobNotificationRule rule(List<String> recipients, String templateName, String language) {
        return new JobNotificationRule("rule-1", "tenant-1", "alerce_assignment",
                JobNotificationRule.CHANNEL_WHATSAPP, recipients, true, 300,
                templateName, language, null, null, null);
    }

    private static AsyncJob parked(String jobType) {
        return new AsyncJob("job-1", "tenant-1", "ecm-1", "ecm", jobType,
                "87920845", null, 0, "dk-1", Map.of(), JobState.FAILED, 5, 5,
                null, null, null, "Alerce rejected: CONDUCTOR2 NO EXISTE",
                List.of(), "listener", null, null);
    }

    private static class FakeRules extends JobNotificationRuleRepository {
        List<JobNotificationRule> enabled = List.of();
        boolean claimWins = true;
        RuntimeException findThrows;
        String lookedUpJobType;
        final List<String> claimedRuleIds = new java.util.ArrayList<>();

        FakeRules() {
            super(null);
        }

        @Override
        public List<JobNotificationRule> findEnabled(String tenantCode, String jobType) {
            if (findThrows != null) {
                throw findThrows;
            }
            this.lookedUpJobType = jobType;
            return enabled;
        }

        @Override
        public boolean claimThrottleSlot(String ruleId) {
            claimedRuleIds.add(ruleId);
            return claimWins;
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
