package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.service.InboundMessage;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService.Ingested;
import com.microboxlabs.miot.integrations.jobs.JobOutcome;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.util.Map;
import java.util.function.Consumer;
import java.util.function.Function;

/**
 * Stores one inbound WhatsApp message and hands its reply to the rules in the same job, so a failure retries
 * both. A retry finds the message stored and hands the reply on again; the rules ignore a run it already moved.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.conversational.enabled", stringValue = "true")
public class WhatsAppInboundMessageJob implements ModulithJobHandler {

    private final Function<InboundMessage, Ingested> ingest;
    private final Consumer<ConversationReplyReceived> replies;

    @Inject
    public WhatsAppInboundMessageJob(WhatsAppInboundService inbound, Event<ConversationReplyReceived> replies) {
        this(inbound::ingestMessage, replies::fire);
    }

    /** {@code replies} delivers the reply synchronously and throws when a rule fails. */
    public WhatsAppInboundMessageJob(Function<InboundMessage, Ingested> ingest,
            Consumer<ConversationReplyReceived> replies) {
        this.ingest = ingest;
        this.replies = replies;
    }

    @Override
    public String jobType() {
        return WhatsAppWebhookJobs.MESSAGE_JOB;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        Ingested ingested = ingest.apply(WhatsAppWebhookJobs.JSON.convertValue(payload, InboundMessage.class));
        if (ingested.skipped() != null) {
            return JobOutcome.skipped(ingested.skipped());
        }
        if (ingested.reply() == null) {
            return JobOutcome.skipped("Already stored");
        }
        replies.accept(ingested.reply());
        return JobOutcome.succeeded((ingested.duplicate() ? "Already stored; reply handed on again to "
                : "Stored on ") + "conversation " + ingested.reply().conversationId());
    }
}
