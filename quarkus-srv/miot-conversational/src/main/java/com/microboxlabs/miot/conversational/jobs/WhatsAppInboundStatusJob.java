package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.service.StatusUpdate;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.function.Function;
import java.util.function.Predicate;

/**
 * Advances the status of a sent WhatsApp message. A status that arrives before its message is stored fails the
 * attempt, so the job retries with backoff instead of losing it.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppInboundStatusJob implements ModulithJobHandler {

    private final Predicate<StatusUpdate> ingest;
    private final Function<StatusUpdate, String> tenantOf;

    @Inject
    public WhatsAppInboundStatusJob(WhatsAppInboundService inbound, WhatsAppWebhookJobs webhookJobs) {
        this(inbound::ingestStatus, webhookJobs::tenantOf);
    }

    /**
     * {@code ingest} returns false when no stored message has the status's wamid; {@code tenantOf} names the
     * tenant of that message, or null while the message has not been stored.
     */
    public WhatsAppInboundStatusJob(Predicate<StatusUpdate> ingest, Function<StatusUpdate, String> tenantOf) {
        this.ingest = ingest;
        this.tenantOf = tenantOf;
    }

    @Override
    public String jobType() {
        return WhatsAppWebhookJobs.STATUS_JOB;
    }

    /** Only the verified webhook enqueues these. */
    @Override
    public boolean internalOnly() {
        return true;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        StatusUpdate status = WhatsAppWebhookJobs.JSON.convertValue(payload, StatusUpdate.class);
        String messageTenant = tenantOf.apply(status);
        if (messageTenant == null) {
            throw new IllegalStateException("No message with wamid " + status.wamid() + " is stored yet");
        }
        if (!WhatsAppWebhookJobs.carries(tenantCode, messageTenant)) {
            return JobOutcome.skipped("The message " + status.wamid() + " is not this tenant's");
        }
        if (!ingest.test(status)) {
            throw new IllegalStateException("No message with wamid " + status.wamid() + " is stored yet");
        }
        return JobOutcome.succeeded(status.status() + " for " + status.wamid());
    }
}
