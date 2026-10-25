package com.microboxlabs.miot.conversational.jobs;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.fasterxml.jackson.databind.SerializationFeature;
import com.fasterxml.jackson.datatype.jsr310.JavaTimeModule;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.conversational.service.InboundMessage;
import com.microboxlabs.miot.conversational.service.MetaWebhookParser;
import com.microboxlabs.miot.conversational.service.ParsedWebhook;
import com.microboxlabs.miot.conversational.service.StatusUpdate;
import com.microboxlabs.miot.core.auth.PlatformScope;
import com.microboxlabs.miot.integrations.dto.AsyncJobSpec;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsRequest;
import com.microboxlabs.miot.integrations.dto.EnqueueJobsResponse;
import com.microboxlabs.miot.integrations.jobs.InternalJobTypes;
import com.microboxlabs.miot.integrations.jobs.ModulithJobHandler;
import com.microboxlabs.miot.integrations.jobs.ModulithJobWorker;
import com.microboxlabs.miot.integrations.service.AsyncJobService;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.InboundChannelRef;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Consumer;
import java.util.function.UnaryOperator;
import org.jboss.logging.Logger;

/**
 * Turns a Meta webhook delivery into one integration job per event, on the modulith lane: an inbound message
 * ({@value #MESSAGE_JOB}) or a status ({@value #STATUS_JOB}). A message's job belongs to the organization of the
 * number that received it, a status's to the organization of the message it updates; anything without one goes
 * to the platform scope, where its job explains why nothing was stored.
 */
@ApplicationScoped
public class WhatsAppWebhookJobs {

    public static final String MESSAGE_JOB = InternalJobTypes.WHATSAPP_INBOUND_MESSAGE;
    public static final String STATUS_JOB = InternalJobTypes.WHATSAPP_INBOUND_STATUS;
    static final String SOURCE = "whatsapp-webhook";
    static final String ENQUEUED_BY = "webhook";
    static final ObjectMapper JSON = new ObjectMapper().registerModule(new JavaTimeModule())
            .disable(SerializationFeature.WRITE_DATES_AS_TIMESTAMPS);
    private static final int DEDUPE_MAX = 640;
    private static final Logger LOG = Logger.getLogger(WhatsAppWebhookJobs.class);

    /** Enqueues jobs for one tenant and returns what the ledger created. */
    @FunctionalInterface
    public interface Enqueuer {
        EnqueueJobsResponse enqueue(String tenantCode, EnqueueJobsRequest request);
    }

    private final Enqueuer jobs;
    private final Consumer<EnqueueJobsResponse> onEnqueued;
    private final UnaryOperator<String> numberTenant;
    private final UnaryOperator<String> messageTenant;

    @Inject
    public WhatsAppWebhookJobs(AsyncJobService jobs, ModulithJobWorker worker,
            IntegrationConnectionResolver resolver, MessageRepository messages,
            ConversationRepository conversations) {
        this(jobs::enqueue, worker::onEnqueued,
                phoneNumberId -> resolver.resolveByWhatsAppPhoneNumberId(phoneNumberId)
                        .map(InboundChannelRef::tenantCode).orElse(null),
                wamid -> {
                    Message message = messages.findByProviderMessageId(Channel.WHATSAPP, wamid);
                    Conversation conversation = message == null ? null
                            : conversations.findById(message.conversationId());
                    return conversation == null ? null : conversation.tenantCode();
                });
    }

    /** {@code numberTenant} maps a phone_number_id, {@code messageTenant} a wamid, to a tenant or null. */
    public WhatsAppWebhookJobs(Enqueuer jobs, Consumer<EnqueueJobsResponse> onEnqueued,
            UnaryOperator<String> numberTenant, UnaryOperator<String> messageTenant) {
        this.jobs = jobs;
        this.onEnqueued = onEnqueued;
        this.numberTenant = numberTenant;
        this.messageTenant = messageTenant;
    }

    /**
     * Parses a delivery received on a connection of {@code connectionTenant} and enqueues the events that
     * connection may carry (see {@link #carries}); returns how many jobs were created. An organization that
     * holds its own App secret can sign any payload, so its connection never reaches another organization.
     */
    public int enqueue(byte[] body, String connectionTenant) {
        ParsedWebhook parsed = MetaWebhookParser.parse(body);
        Map<String, List<AsyncJobSpec>> byTenant = new LinkedHashMap<>();
        int skipped = 0;
        for (InboundMessage m : parsed.messages()) {
            skipped += add(byTenant, connectionTenant, tenantOf(m),
                    spec(MESSAGE_JOB, m.wamid(), "wa:msg:" + m.wamid(), m));
        }
        for (StatusUpdate s : parsed.statuses()) {
            skipped += add(byTenant, connectionTenant, tenantOf(s),
                    spec(STATUS_JOB, s.wamid(), "wa:status:" + s.wamid() + ":" + s.status(), s));
        }
        if (skipped > 0) {
            LOG.warnf("Skipped %d WhatsApp webhook event(s) that do not belong to organization %s",
                    skipped, connectionTenant);
        }
        int created = 0;
        for (Map.Entry<String, List<AsyncJobSpec>> e : byTenant.entrySet()) {
            EnqueueJobsResponse response = jobs.enqueue(e.getKey(),
                    new EnqueueJobsRequest(SOURCE, ENQUEUED_BY, e.getValue()));
            created += response.created().size();
            onEnqueued.accept(response);
        }
        return created;
    }

    /** The tenant a message's job belongs to: the organization of the number that received it, else the platform. */
    public String tenantOf(InboundMessage message) {
        return tenantOr(numberTenant, message.phoneNumberId());
    }

    /** The tenant a status's job belongs to: the organization of the message it updates, else the platform. */
    public String tenantOf(StatusUpdate status) {
        return tenantOr(messageTenant, status.wamid());
    }

    /**
     * Whether a job of {@code rowTenant} may carry an event of {@code eventTenant}. A platform-scope job may carry
     * any (the platform is trusted, and a status whose message was not stored yet waits there); an
     * organization's job only its own, so a job enqueued under one organization cannot write into another's.
     */
    static boolean carries(String rowTenant, String eventTenant) {
        return PlatformScope.TENANT.equals(rowTenant) || Objects.equals(rowTenant, eventTenant);
    }

    private static String tenantOr(UnaryOperator<String> lookup, String key) {
        String tenant = key == null ? null : lookup.apply(key);
        return tenant == null ? PlatformScope.TENANT : tenant;
    }

    /** Adds the event under its tenant when the connection may carry it; returns 1 when it was skipped. */
    private static int add(Map<String, List<AsyncJobSpec>> byTenant, String connectionTenant, String tenant,
            AsyncJobSpec spec) {
        if (!carries(connectionTenant, tenant)) {
            return 1;
        }
        byTenant.computeIfAbsent(tenant, t -> new ArrayList<>()).add(spec);
        return 0;
    }

    @SuppressWarnings("unchecked")
    private static AsyncJobSpec spec(String jobType, String wamid, String dedupe, Object event) {
        return new AsyncJobSpec(jobType, ModulithJobHandler.EXECUTOR, wamid, null, 0,
                dedupe.length() <= DEDUPE_MAX ? dedupe : dedupe.substring(0, DEDUPE_MAX),
                JSON.convertValue(event, Map.class), null);
    }
}
