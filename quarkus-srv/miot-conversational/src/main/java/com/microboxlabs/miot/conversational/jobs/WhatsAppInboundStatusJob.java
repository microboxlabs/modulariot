package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.service.StatusUpdate;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.function.Predicate;

/**
 * Advances the status of a sent WhatsApp message. A status that arrives before its message is stored fails the
 * attempt, so the job retries with backoff instead of losing it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppInboundStatusJob implements ModulithJobHandler {

    private final Predicate<StatusUpdate> ingest;

    @Inject
    public WhatsAppInboundStatusJob(WhatsAppInboundService inbound) {
        this(inbound::ingestStatus);
    }

    /** {@code ingest} returns false when no stored message has the status's wamid. */
    public WhatsAppInboundStatusJob(Predicate<StatusUpdate> ingest) {
        this.ingest = ingest;
    }

    @Override
    public String jobType() {
        return WhatsAppWebhookJobs.STATUS_JOB;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        StatusUpdate status = WhatsAppWebhookJobs.JSON.convertValue(payload, StatusUpdate.class);
        if (!ingest.test(status)) {
            throw new IllegalStateException("No message with wamid " + status.wamid() + " is stored yet");
        }
        return JobOutcome.succeeded(status.status() + " for " + status.wamid());
    }
}
