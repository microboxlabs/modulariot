package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.integrations.service.InboundChannelRef;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.event.Event;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Ingests a verified Meta webhook body into the message pool: driver replies become INBOUND
 * messages on the right org's conversation, and delivery/read/failed callbacks mirror onto the
 * outbound message they refer to. A message on the platform's number goes to the organization
 * {@link PlatformInboundRouter} chooses; one on an organization's number stays with that
 * organization. Idempotent without a pre-write claim: inbound inserts dedupe on
 * the (channel, wamid) unique index ({@code appendInbound} returns null on a redelivery), and status
 * mirroring is advance-only, so a retry after a failure re-processes safely rather than being
 * silently swallowed.
 *
 * <p>After a new inbound message is stored, {@link ConversationReplyReceived} is fired
 * asynchronously. A redelivery stores nothing and fires nothing.
 *
 * <p>Runs on a worker thread (the resource offloads it): the repositories use synchronous,
 * blocking Vert.x SQL, matching the outbound send path.
 */
@ApplicationScoped
public class WhatsAppInboundService {

    private static final Logger LOG = Logger.getLogger(WhatsAppInboundService.class);
    private static final int PREVIEW_MAX = 280;
    private static final int SESSION_WINDOW_HOURS = 24;
    private static final String BUTTON_PAYLOAD = "buttonPayload";

    private final IntegrationConnectionResolver connectionResolver;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final Event<ConversationReplyReceived> replyReceived;
    private final PlatformInboundRouter platformRouter;

    @Inject
    public WhatsAppInboundService(
            IntegrationConnectionResolver connectionResolver,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            Event<ConversationReplyReceived> replyReceived) {
        this.connectionResolver = connectionResolver;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.replyReceived = replyReceived;
        this.platformRouter = new PlatformInboundRouter(conversationRepository, messageRepository);
    }

    /**
     * What storing one inbound message did. {@code reply} is the event for the rules; {@code duplicate} says
     * the message was already stored, and {@code skipped} why nothing was stored.
     */
    public record Ingested(ConversationReplyReceived reply, boolean duplicate, String skipped) {

        static Ingested skip(String reason) {
            return new Ingested(null, false, reason);
        }
    }

    /** Stores a whole webhook delivery inline; each new reply reaches the rules asynchronously. */
    public void ingest(byte[] rawBody) {
        ParsedWebhook parsed = MetaWebhookParser.parse(rawBody);
        for (InboundMessage message : parsed.messages()) {
            Ingested ingested = ingestMessage(message);
            if (ingested.reply() != null && !ingested.duplicate()) {
                publishReply(ingested.reply());
            }
        }
        for (StatusUpdate status : parsed.statuses()) {
            ingestStatus(status);
        }
    }

    /**
     * Stores an inbound message on its organization's conversation. A message already stored comes back as a
     * duplicate with its reply event, so a job that failed after storing it can still hand the reply on.
     */
    public Ingested ingestMessage(InboundMessage message) {
        if (message.wamid() == null || message.fromE164() == null) {
            LOG.warn("Skipping inbound WhatsApp message with no id or sender");
            return Ingested.skip("The message has no id or sender");
        }
        Optional<InboundChannelRef> channel =
                connectionResolver.resolveByWhatsAppPhoneNumberId(message.phoneNumberId());
        if (channel.isEmpty()) {
            LOG.warnf("No active WHATSAPP connection for phone_number_id %s — dropping inbound message",
                    message.phoneNumberId());
            return Ingested.skip("No active WhatsApp connection for phone_number_id " + message.phoneNumberId());
        }

        OffsetDateTime occurredAt = message.timestamp() != null
                ? message.timestamp()
                : OffsetDateTime.now(ZoneOffset.UTC);
        // The platform's number receives replies to every organization's rule messages.
        InboundRoute attachment = WhatsAppMessagingService.PLATFORM_TENANT.equals(channel.get().tenantCode())
                ? platformRouter.route(message, occurredAt)
                : attach(channel.get().tenantCode(), message, occurredAt);
        String tenantCode = attachment.tenantCode();
        Conversation conversation = attachment.conversation();

        // The insert IS the dedup: a redelivered wamid hits the unique index and returns null, and
        // the conversation touch in the same statement is skipped (no double unread count).
        Message persisted = messageRepository.appendInbound(new Message(
                UUID.randomUUID().toString(),
                conversation.id(),
                MessageDirection.INBOUND,
                MessageRole.DRIVER,
                message.type(),
                message.body(),
                null,
                message.mediaRef(),
                message.mediaMimeType(),
                message.mediaFileName(),
                message.wamid(),
                MessageStatus.RECEIVED,
                null,
                null,
                conversation.contextServiceCode(),
                conversation.contextProcessInstanceId(),
                inboundMetadata(message, channel.get().tenantCode()),
                null,
                null,
                null,
                occurredAt,
                Channel.WHATSAPP,
                message.fromE164(),
                attachment.inReplyTo(),
                attachment.runId(),
                null), new ConversationRepository.InboundTouch(
                occurredAt,
                inboundPreview(message),
                occurredAt.plusHours(SESSION_WINDOW_HOURS),
                message.contactName()));
        if (persisted == null) {
            LOG.debugf("Duplicate inbound WhatsApp message %s — already ingested", message.wamid());
            return duplicate(message, occurredAt, tenantCode);
        }

        return new Ingested(new ConversationReplyReceived(
                tenantCode,
                conversation.id(),
                persisted.id(),
                persisted.inReplyTo(),
                persisted.runId(),
                attachment.answeredStep(),
                Channel.WHATSAPP,
                message.fromE164(),
                message.body(),
                message.buttonPayload(),
                occurredAt), false, null);
    }

    /** The reply of a message already stored, with the step of the message it answers, as the first time. */
    private Ingested duplicate(InboundMessage message, OffsetDateTime occurredAt, String tenantCode) {
        Message stored = messageRepository.findByProviderMessageId(Channel.WHATSAPP, message.wamid());
        Conversation conversation = stored == null ? null : conversationRepository.findById(stored.conversationId());
        if (!isOwnInboundDuplicate(stored, conversation, tenantCode)) {
            return Ingested.skip("The message id belongs to another organization or an outbound message");
        }
        Message answered = stored.inReplyTo() == null ? null : messageRepository.findById(stored.inReplyTo());
        return new Ingested(new ConversationReplyReceived(conversation.tenantCode(), conversation.id(), stored.id(),
                stored.inReplyTo(), stored.runId(), answered == null ? null : answered.step(), Channel.WHATSAPP,
                message.fromE164(), message.body(), message.buttonPayload(), occurredAt), true, null);
    }

    /** A shared provider id may belong to another tenant or to an outbound message. */
    private static boolean isOwnInboundDuplicate(Message stored, Conversation conversation, String tenantCode) {
        return stored != null && stored.direction() == MessageDirection.INBOUND
                && conversation != null && tenantCode.equals(conversation.tenantCode());
    }

    /** The button payload, if any, and the tenant of the connection whose number received the message. */
    private static Map<String, Object> inboundMetadata(InboundMessage message, String connectionTenant) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (message.buttonPayload() != null) {
            metadata.put(BUTTON_PAYLOAD, message.buttonPayload());
        }
        metadata.put(WhatsAppMessagingService.CONNECTION_TENANT, connectionTenant);
        return metadata;
    }

    /** Observer failures are logged; the message is already stored. */
    private void publishReply(ConversationReplyReceived event) {
        try {
            replyReceived.fireAsync(event).exceptionally(failure -> {
                LOG.errorf(failure, "conversation.reply_received observer failed for message %s", event.messageId());
                return null;
            });
        } catch (RuntimeException e) {
            LOG.errorf(e, "Could not publish conversation.reply_received for message %s", event.messageId());
        }
    }

    /** Advances the status of the message with the wamid; false when no stored message has it. */
    public boolean ingestStatus(StatusUpdate status) {
        Message existing = messageRepository.findByProviderMessageId(Channel.WHATSAPP, status.wamid());
        if (existing == null) {
            LOG.debugf("Status %s for unknown wamid %s — ignored", status.status(), status.wamid());
            return false;
        }
        // Advance-only IS the idempotency: re-applying a status the message already reached is a
        // no-op, so a redelivered callback needs no separate dedup ledger.
        if (!advances(existing.status(), status.status())) {
            return true;
        }
        OffsetDateTime at = status.timestamp() != null ? status.timestamp() : OffsetDateTime.now(ZoneOffset.UTC);
        messageRepository.markStatus(
                existing.id(),
                status.status(),
                status.status() == MessageStatus.DELIVERED ? at : null,
                status.status() == MessageStatus.READ ? at : null,
                status.status() == MessageStatus.FAILED ? failureReason(status) : null,
                advancesFrom(status.status()));
        return true;
    }

    /** The statuses {@code next} advances from; the update applies only while the stored status is one. */
    static Set<MessageStatus> advancesFrom(MessageStatus next) {
        Set<MessageStatus> from = EnumSet.noneOf(MessageStatus.class);
        for (MessageStatus current : MessageStatus.values()) {
            if (advances(current, next)) {
                from.add(current);
            }
        }
        return from;
    }

    /**
     * Chooses the conversation for an inbound message on an organization's own number; the first match wins:
     * <ol>
     *   <li>the message it answers, named by the provider ({@code context.id}, or a button payload
     *       carrying the outbound message id or wamid); also sets {@code inReplyTo};</li>
     *   <li>the conversation of a run waiting for this address;</li>
     *   <li>the newest open conversation for the address;</li>
     *   <li>a new conversation without context.</li>
     * </ol>
     */
    private InboundRoute attach(String tenantCode, InboundMessage message, OffsetDateTime now) {
        String address = message.fromE164();
        Message answered = PlatformInboundRouter.answeredMessage(messageRepository, message);
        if (answered != null) {
            Conversation conversation = conversationRepository.findByTenantAndId(tenantCode, answered.conversationId());
            if (conversation != null && address.equals(conversation.participantAddress())) {
                return new InboundRoute(tenantCode, conversation, answered.id(), answered.runId(), answered.step());
            }
        }
        InboundRoute waiting = conversationWithWaitingRun(tenantCode, address);
        if (waiting != null) {
            return waiting;
        }
        return InboundRoute.to(latestOpenOrNew(conversationRepository, tenantCode, message, now));
    }

    /** The newest open conversation of the tenant with the sender, else a new one without context. */
    static Conversation latestOpenOrNew(
            ConversationRepository conversationRepository, String tenantCode, InboundMessage message,
            OffsetDateTime now) {
        String address = message.fromE164();
        Conversation latest = conversationRepository.findLatestOpenByAddress(tenantCode, address);
        if (latest != null) {
            return latest;
        }
        // appendInbound then applies the first inbound touch (unread 1, timestamps).
        return conversationRepository.create(new Conversation(
                UUID.randomUUID().toString(),
                tenantCode,
                address,
                message.contactName(),
                null,
                null,
                null,
                null,
                ConversationStatus.OPEN,
                null,
                null,
                null,
                null,
                null,
                0,
                now,
                now,
                null,
                null,
                address,
                null,
                null,
                message.contactName(),
                Map.of()));
    }

    /**
     * Step 2 of the attachment order: the conversation where a WAITING run last messaged this
     * address. The reply carries the run.
     */
    private InboundRoute conversationWithWaitingRun(String tenantCode, String address) {
        ConversationRepository.WithWaitingRun waiting = conversationRepository.findWithWaitingRun(tenantCode, address);
        return waiting == null ? null : new InboundRoute(tenantCode, waiting.conversation(), null, waiting.runId(), null);
    }

    /**
     * Outbound delivery lifecycle is monotonic: SENT → DELIVERED → READ, with FAILED reachable
     * only from a not-yet-delivered state. Mirroring only ever moves forward, so an out-of-order
     * or duplicate callback can't regress READ back to DELIVERED. Static for unit testing.
     */
    static boolean advances(MessageStatus current, MessageStatus next) {
        if (next == null || current == MessageStatus.FAILED) {
            return false;
        }
        if (next == MessageStatus.FAILED) {
            return current == MessageStatus.PENDING || current == MessageStatus.SENT;
        }
        return progressRank(next) > progressRank(current);
    }

    private static int progressRank(MessageStatus status) {
        return switch (status) {
            case PENDING -> 0;
            case SENT -> 1;
            case DELIVERED -> 2;
            case READ -> 3;
            case RECEIVED, FAILED, SIMULATED -> -1;
        };
    }

    /** Inbox preview: the text/caption, or a bracketed type label for media (e.g. {@code [image]}). */
    static String inboundPreview(InboundMessage message) {
        String body = message.body();
        if (body != null && !body.isBlank()) {
            return body.length() <= PREVIEW_MAX ? body : body.substring(0, PREVIEW_MAX);
        }
        return "[" + message.type().name().toLowerCase() + "]";
    }

    private static String failureReason(StatusUpdate status) {
        return status.error() != null ? status.error() : "WhatsApp reported the message as failed";
    }
}
