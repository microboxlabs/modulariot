package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.rules.SendJobs;
import com.microboxlabs.miot.conversational.rules.store.RunStore;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import io.quarkus.arc.properties.IfBuildProperty;
import io.quarkus.scheduler.Scheduled;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.Set;
import org.jboss.logging.Logger;

/**
 * A send job that ran out of attempts, or failed in a way a retry cannot fix: its message becomes FAILED with the
 * job's last error, and the error is written on the run. The run goes on with its next steps.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class SendJobsOnPark {

    private static final Logger LOG = Logger.getLogger(SendJobsOnPark.class);
    private static final Set<String> TYPES = Set.of(InternalJobTypes.WHATSAPP_SEND, InternalJobTypes.EMAIL_SEND);

    private final RunStore runs;

    @Inject
    public SendJobsOnPark(RunStore runs) {
        this.runs = runs;
    }

    void onParked(@Observes JobParkedEvent event) {
        parked(event.job());
    }

    public void parked(AsyncJob job) {
        if (!TYPES.contains(job.jobType())) {
            return;
        }
        try {
            String messageId = WhatsAppSendJob.text(job.payload(), SendJobs.MESSAGE_ID);
            runs.failQueuedMessage(job.tenantCode(), messageId, job.lastError(), Instant.now());
        } catch (RuntimeException e) {
            LOG.warnf(e, "Parked send job %s: message not marked failed", job.id());
        }
    }

    /** Repair a park whose database side effect failed after the job ledger was committed. */
    @Scheduled(every = "${miot.conversational.send-jobs.reconcile-every:1m}", delayed = "1m",
            concurrentExecution = Scheduled.ConcurrentExecution.SKIP)
    void reconcile() {
        try {
            int repaired = runs.reconcileFailedSends(100, Instant.now());
            if (repaired > 0) {
                LOG.warnf("Repaired %d parked send message(s)", repaired);
            }
        } catch (RuntimeException e) {
            LOG.warn("Could not reconcile parked send messages", e);
        }
    }
}
