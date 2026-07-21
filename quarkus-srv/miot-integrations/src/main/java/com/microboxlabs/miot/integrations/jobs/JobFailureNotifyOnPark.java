package com.microboxlabs.miot.integrations.jobs;

import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.domain.JobNotificationRule;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.persistence.JobNotificationRuleRepository;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jboss.logging.Logger;

/**
 * Park hook for failure notifications: when a job parks as FAILED and the
 * tenant has an enabled {@link JobNotificationRule} for its type, enqueue a
 * {@code job_failure_notification} job for the rule's recipients.
 *
 * <p>The rule's throttle slot is claimed atomically <i>before</i> enqueueing,
 * so a burst of parks inside the window coalesces into the one notification
 * already sent (across pods — the claim is a DB CAS). Rules are never matched
 * for the notification job type itself: a parked notification can't notify
 * about its own failure.
 *
 * <p>Never throws — a notification problem must not disturb the report path
 * that fired the event.
 */
@ApplicationScoped
public class JobFailureNotifyOnPark {

    private static final Logger LOG = Logger.getLogger(JobFailureNotifyOnPark.class);

    private final JobNotificationRuleRepository ruleRepository;
    private final AsyncJobService jobService;
    private final ModulithJobWorker worker;

    @Inject
    JobFailureNotifyOnPark(
            JobNotificationRuleRepository ruleRepository,
            AsyncJobService jobService,
            ModulithJobWorker worker) {
        this.ruleRepository = ruleRepository;
        this.jobService = jobService;
        this.worker = worker;
    }

    void onParked(@Observes JobParkedEvent event) {
        AsyncJob parked = event.job();
        try {
            if (JobFailureNotificationFeature.JOB_TYPE.equals(parked.jobType())) {
                return;
            }
            for (JobNotificationRule rule : ruleRepository.findEnabled(parked.tenantCode(), parked.jobType())) {
                notifyRule(parked, rule);
            }
        } catch (Exception e) {
            LOG.errorf(e, "Failure-notification hook failed for parked job %s (%s)",
                    parked.id(), parked.jobType());
        }
    }

    private void notifyRule(AsyncJob parked, JobNotificationRule rule) {
        if (rule.recipients() == null || rule.recipients().isEmpty()) {
            return;
        }
        if (!ruleRepository.claimThrottleSlot(rule.id())) {
            LOG.debugf("Notification for parked job %s (%s) throttled by rule %s",
                    parked.id(), parked.jobType(), rule.id());
            return;
        }
        AsyncJobSpec spec = new AsyncJobSpec(
                JobFailureNotificationFeature.JOB_TYPE,
                ModulithJobHandler.EXECUTOR,
                parked.correlationKey(),
                null, null,
                "notify:" + rule.id() + ":" + parked.id() + ":" + parked.attempts(),
                notificationPayload(parked, rule),
                null);
        worker.onEnqueued(jobService.enqueue(parked.tenantCode(),
                new EnqueueJobsRequest(parked.sourceInstance(), "listener", List.of(spec))));
        LOG.infof("Parked %s job %s → enqueued %s notification to %d recipient(s)",
                parked.jobType(), parked.id(), rule.channel(), rule.recipients().size());
    }

    /** Self-contained — the handler (in miot-conversational) sees only the payload. */
    private static Map<String, Object> notificationPayload(AsyncJob parked, JobNotificationRule rule) {
        Map<String, Object> payload = new LinkedHashMap<>();
        payload.put(JobFailureNotificationFeature.PAYLOAD_TENANT_CODE, parked.tenantCode());
        payload.put(JobFailureNotificationFeature.PAYLOAD_RECIPIENTS, rule.recipients());
        payload.put(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_ID, parked.id());
        payload.put(JobFailureNotificationFeature.PAYLOAD_FAILED_JOB_TYPE, parked.jobType());
        putIfPresent(payload, JobFailureNotificationFeature.PAYLOAD_CORRELATION_KEY, parked.correlationKey());
        putIfPresent(payload, JobFailureNotificationFeature.PAYLOAD_ERROR, truncatedError(parked));
        putIfPresent(payload, JobFailureNotificationFeature.PAYLOAD_TEMPLATE_NAME, rule.templateName());
        putIfPresent(payload, JobFailureNotificationFeature.PAYLOAD_LANGUAGE, rule.language());
        return payload;
    }

    private static String truncatedError(AsyncJob parked) {
        String error = parked.lastError();
        if (error == null || error.isBlank()) {
            return null;
        }
        return error.length() <= JobFailureNotificationFeature.ERROR_MAX_LENGTH
                ? error
                : error.substring(0, JobFailureNotificationFeature.ERROR_MAX_LENGTH);
    }

    private static void putIfPresent(Map<String, Object> payload, String key, String value) {
        if (value != null && !value.isBlank()) {
            payload.put(key, value);
        }
    }
}
