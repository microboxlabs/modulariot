package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.rules.SendJobs;
import com.microboxlabs.miot.conversational.service.EmailMessagingService;
import com.microboxlabs.miot.conversational.service.SendFailure;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.NonRetryableJobException;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;

/**
 * Sends a rule's PENDING email through the organization's sending account. A provider error or no answer retries
 * with backoff; no account, or an address the provider refuses, parks the job at once.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class EmailSendJob implements ModulithJobHandler {

    private final EmailMessagingService email;

    @Inject
    public EmailSendJob(EmailMessagingService email) {
        this.email = email;
    }

    @Override
    public String jobType() {
        return InternalJobTypes.EMAIL_SEND;
    }

    /** Only the rules engine enqueues these. */
    @Override
    public boolean internalOnly() {
        return true;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        try {
            return SendOutcome.of(email.deliverQueued(tenantCode,
                    WhatsAppSendJob.text(payload, SendJobs.MESSAGE_ID)));
        } catch (SendFailure e) {
            if (e.retryable()) {
                throw e;
            }
            throw new NonRetryableJobException(e.getMessage(), e);
        }
    }
}
