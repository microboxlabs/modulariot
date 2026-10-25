package com.microboxlabs.miot.conversational.jobs;

import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.service.InboundMessage;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService;
import com.microboxlabs.miot.conversational.service.WhatsAppInboundService.Ingested;
import com.microboxlabs.miot.core.auth.PlatformScope;
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
    private final Function<InboundMessage, String> tenantOf;

    @Inject
    public WhatsAppInboundMessageJob(WhatsAppInboundService inbound, Event<ConversationReplyReceived> replies,
            WhatsAppWebhookJobs webhookJobs) {
        this(inbound::ingestMessage, replies::fire, webhookJobs::tenantOf);
    }

    /**
     * {@code replies} delivers the reply synchronously and throws when a rule fails; {@code tenantOf} names the
     * tenant whose job the message belongs to.
     */
    public WhatsAppInboundMessageJob(Function<InboundMessage, Ingested> ingest,
            Consumer<ConversationReplyReceived> replies, Function<InboundMessage, String> tenantOf) {
        this.ingest = ingest;
        this.replies = replies;
        this.tenantOf = tenantOf;
    }

    @Override
    public String jobType() {
        return WhatsAppWebhookJobs.MESSAGE_JOB;
    }

    /** Only the verified webhook enqueues these. */
    @Override
    public boolean internalOnly() {
        return true;
    }

    @Override
    public JobOutcome handle(String tenantCode, Map<String, Object> payload) {
        InboundMessage message = WhatsAppWebhookJobs.JSON.convertValue(payload, InboundMessage.class);
        if (!WhatsAppWebhookJobs.carries(tenantCode, tenantOf.apply(message))) {
            return JobOutcome.skipped("The number that received the message is not this tenant's");
        }
        Ingested ingested = ingest.apply(message);
        if (ingested.skipped() != null) {
            return JobOutcome.skipped(ingested.skipped());
        }
        if (ingested.reply() == null) {
            return JobOutcome.skipped("Already stored");
        }
        if (!PlatformScope.TENANT.equals(tenantCode)
                && !tenantCode.equals(ingested.reply().tenantCode())) {
            return JobOutcome.skipped("The reply belongs to another organization");
        }
        replies.accept(ingested.reply());
        return JobOutcome.succeeded((ingested.duplicate() ? "Already stored; reply handed on again to "
                : "Stored on ") + "conversation " + ingested.reply().conversationId());
    }
}
