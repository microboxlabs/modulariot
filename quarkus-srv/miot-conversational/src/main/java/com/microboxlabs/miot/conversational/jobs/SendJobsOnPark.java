package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.conversational.rules.RulesEngine;
import com.microboxlabs.miot.conversational.rules.SendJobs;
import com.microboxlabs.miot.integrations.domain.AsyncJob;
import com.microboxlabs.miot.integrations.events.JobParkedEvent;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Observes;
import jakarta.inject.Inject;
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

    private final MessageRepository messages;
    private final RulesEngine engine;

    @Inject
    public SendJobsOnPark(MessageRepository messages, RulesEngine engine) {
        this.messages = messages;
        this.engine = engine;
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
            Message message = messageId == null ? null : messages.findById(messageId);
            if (message == null || message.status() != MessageStatus.PENDING) {
                return;
            }
            messages.markStatus(messageId, MessageStatus.FAILED, null, null, job.lastError(),
                    Set.of(MessageStatus.PENDING));
            engine.sendFailed(message.runId(), message.address() + ": " + job.lastError());
        } catch (RuntimeException e) {
            LOG.warnf(e, "Parked send job %s: message not marked failed", job.id());
        }
    }
}
