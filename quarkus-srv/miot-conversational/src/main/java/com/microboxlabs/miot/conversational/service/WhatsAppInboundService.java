package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.conversational.persistence.WebhookIdempotencyRepository;
import com.microboxlabs.miot.integrations.service.InboundChannelRef;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import jakarta.enterprise.context.ApplicationScoped;
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
 * outbound message they refer to. Idempotent — Meta retries are absorbed by the
 * {@link WebhookIdempotencyRepository} claim plus advance-only status transitions — so the webhook
 * can safely ack every well-signed POST.
 *
 * <p>Runs on a worker thread (the resource offloads it): the repositories use synchronous,
 * blocking Vert.x SQL, matching the outbound send path.
 */
@ApplicationScoped
public class WhatsAppInboundService {

    private static final Logger LOG = Logger.getLogger(WhatsAppInboundService.class);
    private static final int PREVIEW_MAX = 280;
    private static final int SESSION_WINDOW_HOURS = 24;
    private static final String SOURCE_MESSAGE = "meta-message";
    private static final String SOURCE_STATUS = "meta-status";

    private final IntegrationConnectionResolver connectionResolver;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final WebhookIdempotencyRepository idempotencyRepository;

    @Inject
    public WhatsAppInboundService(
            IntegrationConnectionResolver connectionResolver,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            WebhookIdempotencyRepository idempotencyRepository) {
        this.connectionResolver = connectionResolver;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.idempotencyRepository = idempotencyRepository;
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
        // Resolve the owning org BEFORE claiming, so a not-yet-configured number isn't permanently
        // consumed — Meta can redeliver once the connection exists.
        Optional<InboundChannelRef> channel =
                connectionResolver.resolveByWhatsAppPhoneNumberId(message.phoneNumberId());
        if (channel.isEmpty()) {
            LOG.warnf("No active WHATSAPP connection for phone_number_id %s — dropping inbound message",
                    message.phoneNumberId());
            return;
        }
        if (!idempotencyRepository.recordOnce(SOURCE_MESSAGE, message.wamid())) {
            LOG.debugf("Duplicate inbound WhatsApp message %s — already ingested", message.wamid());
            return;
        }

        String tenantCode = channel.get().tenantCode();
        OffsetDateTime occurredAt = message.timestamp() != null
                ? message.timestamp()
                : OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = findOrCreateConversation(tenantCode, message, occurredAt);

        messageRepository.append(new Message(
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
                Map.of(),
                null,
                null,
                null,
                occurredAt));

        conversationRepository.updateInbound(
                conversation.id(),
                occurredAt,
                inboundPreview(message),
                occurredAt.plusHours(SESSION_WINDOW_HOURS),
                message.contactName());
    }

    private void ingestStatus(StatusUpdate status) {
        Message existing = messageRepository.findByMetaMessageId(status.wamid());
        if (existing == null) {
            LOG.debugf("Status %s for unknown wamid %s — ignored", status.status(), status.wamid());
            return;
        }
        if (!advances(existing.status(), status.status())) {
            return;
        }
        if (!idempotencyRepository.recordOnce(SOURCE_STATUS, status.wamid() + ":" + status.status())) {
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

    private Conversation findOrCreateConversation(
            String tenantCode, InboundMessage message, OffsetDateTime now) {
        Conversation existing = conversationRepository.findByTenantAndPhone(tenantCode, message.fromE164());
        if (existing != null) {
            return existing;
        }
        // Cold inbound: no trip context yet (context is anchored by trip-tied outbound). Created
        // neutral; updateInbound then applies the first inbound touch (unread → 1, timestamps).
        return conversationRepository.create(new Conversation(
                UUID.randomUUID().toString(),
                tenantCode,
                message.fromE164(),
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
                now));
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
            case RECEIVED, FAILED -> -1;
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
