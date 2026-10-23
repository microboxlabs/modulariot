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
import java.util.Map;
import java.util.Optional;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Ingests a verified Meta webhook body into the message pool: driver replies become INBOUND
 * messages on the right org's conversation, and delivery/read/failed callbacks mirror onto the
 * outbound message they refer to. Idempotent without a pre-write claim: inbound inserts dedupe on
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
    }

    public void ingest(byte[] rawBody) {
        ParsedWebhook parsed = MetaWebhookParser.parse(rawBody);
        for (InboundMessage message : parsed.messages()) {
            ingestMessage(message);
        }
        for (StatusUpdate status : parsed.statuses()) {
            ingestStatus(status);
        }
    }

    private void ingestMessage(InboundMessage message) {
        if (message.wamid() == null || message.fromE164() == null) {
            LOG.warn("Skipping inbound WhatsApp message with no id or sender");
            return;
        }
        Optional<InboundChannelRef> channel =
                connectionResolver.resolveByWhatsAppPhoneNumberId(message.phoneNumberId());
        if (channel.isEmpty()) {
            LOG.warnf("No active WHATSAPP connection for phone_number_id %s — dropping inbound message",
                    message.phoneNumberId());
            return;
        }

        String tenantCode = channel.get().tenantCode();
        OffsetDateTime occurredAt = message.timestamp() != null
                ? message.timestamp()
                : OffsetDateTime.now(ZoneOffset.UTC);
        Attachment attachment = attach(tenantCode, message, occurredAt);
        Conversation conversation = attachment.conversation();

        // The insert IS the dedup: a redelivered wamid hits the unique index and returns null, so
        // we skip the conversation touch (no double unread count) without losing anything.
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
                message.buttonPayload() == null ? Map.of() : Map.of(BUTTON_PAYLOAD, message.buttonPayload()),
                null,
                null,
                null,
                occurredAt,
                Channel.WHATSAPP,
                message.fromE164(),
                attachment.inReplyTo(),
                attachment.runId(),
                null));
        if (persisted == null) {
            LOG.debugf("Duplicate inbound WhatsApp message %s — already ingested", message.wamid());
            return;
        }

        conversationRepository.updateInbound(
                conversation.id(),
                occurredAt,
                inboundPreview(message),
                occurredAt.plusHours(SESSION_WINDOW_HOURS),
                message.contactName());

        publishReply(new ConversationReplyReceived(
                tenantCode,
                conversation.id(),
                persisted.id(),
                persisted.inReplyTo(),
                persisted.runId(),
                Channel.WHATSAPP,
                message.fromE164(),
                message.body(),
                message.buttonPayload(),
                occurredAt));
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

    private void ingestStatus(StatusUpdate status) {
        Message existing = messageRepository.findByProviderMessageId(Channel.WHATSAPP, status.wamid());
        if (existing == null) {
            LOG.debugf("Status %s for unknown wamid %s — ignored", status.status(), status.wamid());
            return;
        }
        // Advance-only IS the idempotency: re-applying a status the message already reached is a
        // no-op, so a redelivered callback needs no separate dedup ledger.
        if (!advances(existing.status(), status.status())) {
            return;
        }
        OffsetDateTime at = status.timestamp() != null ? status.timestamp() : OffsetDateTime.now(ZoneOffset.UTC);
        messageRepository.markStatus(
                existing.id(),
                status.status(),
                status.status() == MessageStatus.DELIVERED ? at : null,
                status.status() == MessageStatus.READ ? at : null,
                status.status() == MessageStatus.FAILED ? failureReason(status) : null);
    }

    /**
     * Chooses the conversation for an inbound message; the first match wins:
     * <ol>
     *   <li>the message it answers, named by the provider ({@code context.id}, or a button payload
     *       carrying the outbound message id or wamid); also sets {@code inReplyTo};</li>
     *   <li>the conversation of a run waiting for this address;</li>
     *   <li>the newest open conversation for the address;</li>
     *   <li>a new conversation without context.</li>
     * </ol>
     */
    private Attachment attach(String tenantCode, InboundMessage message, OffsetDateTime now) {
        String address = message.fromE164();
        Message answered = answeredMessage(message);
        if (answered != null) {
            Conversation conversation = conversationRepository.findByTenantAndId(tenantCode, answered.conversationId());
            if (conversation != null && address.equals(conversation.participantAddress())) {
                return new Attachment(conversation, answered.id(), answered.runId());
            }
        }
        Attachment waiting = conversationWithWaitingRun(tenantCode, address);
        if (waiting != null) {
            return waiting;
        }
        Conversation latest = conversationRepository.findLatestOpenByAddress(tenantCode, address);
        if (latest != null) {
            return new Attachment(latest, null, null);
        }
        // updateInbound then applies the first inbound touch (unread 1, timestamps).
        return new Attachment(conversationRepository.create(new Conversation(
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
                Map.of())), null, null);
    }

    private Message answeredMessage(InboundMessage message) {
        Message byContext = messageRepository.findByProviderMessageId(Channel.WHATSAPP, message.contextMessageId());
        if (byContext != null) {
            return byContext;
        }
        String payload = message.buttonPayload();
        if (payload == null || payload.isBlank()) {
            return null;
        }
        Message byId = messageRepository.findById(payload);
        if (byId != null) {
            return byId;
        }
        return messageRepository.findByProviderMessageId(Channel.WHATSAPP, payload);
    }

    /**
     * Step 2 of the attachment order: the conversation where a WAITING run last messaged this
     * address. The reply carries the run.
     */
    private Attachment conversationWithWaitingRun(String tenantCode, String address) {
        ConversationRepository.WithWaitingRun waiting = conversationRepository.findWithWaitingRun(tenantCode, address);
        return waiting == null ? null : new Attachment(waiting.conversation(), null, waiting.runId());
    }

    private record Attachment(Conversation conversation, String inReplyTo, String runId) {
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
