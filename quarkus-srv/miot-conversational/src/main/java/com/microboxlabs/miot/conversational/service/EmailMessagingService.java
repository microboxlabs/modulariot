package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.accounts.ChannelAccountsService;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.core.mail.NotificationMail;
import com.microboxlabs.miot.integrations.email.EmailMessage;
import com.microboxlabs.miot.integrations.email.ResendEmailSender;
import com.microboxlabs.miot.integrations.email.SendResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

/**
 * Sends a rule's email through the platform's RESEND connection, or the organization's own when its email mode
 * is OWN, and stores it on the conversation about the message's context with the recipient. A failed send is stored
 * FAILED with its reason; with {@code simulate} nothing is sent and the message is stored SIMULATED. Reply-to is
 * not set yet (#2006).
 */
@ApplicationScoped
public class EmailMessagingService {

    private static final int PREVIEW_MAX = 280;
    static final String SUBJECT = "subject";
    /** The rendered HTML body, without the layout; the text is the message's body. */
    static final String HTML = "html";

    private final ResendEmailSender sender;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;
    private final ChannelAccountsService accounts;
    private final NotificationMail layout;

    @Inject
    public EmailMessagingService(ResendEmailSender sender, ConversationRepository conversationRepository,
            MessageRepository messageRepository, ChannelAccountsService accounts, NotificationMail layout) {
        this.sender = sender;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.accounts = accounts;
        this.layout = layout;
    }

    private static Map<String, Object> metadata(ContextMessage message) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (message.subject() != null) {
            metadata.put(SUBJECT, message.subject());
        }
        if (message.html() != null) {
            metadata.put(HTML, message.html());
        }
        return metadata;
    }

    public Message sendInContext(String tenantCode, ContextMessage message, boolean simulate) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.participant(null), now);
        Map<String, Object> metadata = metadata(message);
        MessageStatus status;
        String providerMessageId = null;
        String errorMessage = null;
        if (simulate) {
            status = MessageStatus.SIMULATED;
        } else {
            SendResult result = deliver(tenantCode, message);
            status = result.accepted() ? MessageStatus.SENT : MessageStatus.FAILED;
            providerMessageId = result.messageId();
            errorMessage = result.error();
            // A retried step resends with the same idempotency key: the provider answers with the email it
            // already sent, which is stored, so the retry goes on to the next recipient.
            Message already = providerMessageId == null ? null
                    : messageRepository.findByProviderMessageId(Channel.EMAIL, providerMessageId);
            if (already != null) {
                return already;
            }
        }
        return storeOutbound(conversation, message, now, metadata, status, providerMessageId, errorMessage);
    }

    /** Stores a rule's email as PENDING on its context's conversation; its job sends it. */
    public Message queueInContext(String tenantCode, ContextMessage message) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.participant(null), now);
        Map<String, Object> metadata = metadata(message);
        Message stored = messageRepository.appendQueued(new Message(
                QueuedMessageId.forStep(message, Channel.EMAIL), conversation.id(), MessageDirection.OUTBOUND,
                MessageRole.SYSTEM, MessageType.TEXT, message.body(), message.templateName(), null, null, null, null,
                MessageStatus.PENDING, null, null, null, null, metadata, null, null, null, now, Channel.EMAIL,
                message.to(), null, message.runId(), message.step()));
        String preview = message.subject() != null ? message.subject() : message.body();
        conversationRepository.updateOutbound(conversation.id(), ConversationRepository.OutboundTouch.ofContext(
                message.contextKind(), message.contextKey(), now,
                preview == null || preview.length() <= PREVIEW_MAX ? preview : preview.substring(0, PREVIEW_MAX)));
        return stored;
    }

    /**
     * Sends a PENDING email of this organization through its sending account and marks it SENT. A message no
     * longer PENDING is returned as it is, except FAILED after a manual retry of its parked job. A repeated
     * send uses the same idempotency key, so the provider does not send it twice.
     *
     * @throws SendFailure when the provider did not take it
     */
    public Message deliverQueued(String tenantCode, String messageId) {
        Message message = WhatsAppMessagingService.queued(messageRepository, conversationRepository, tenantCode,
                messageId);
        if (message.status() != MessageStatus.PENDING && message.status() != MessageStatus.FAILED) {
            return message;
        }
        Object subject = message.metadata() == null ? null : message.metadata().get(SUBJECT);
        Object html = message.metadata() == null ? null : message.metadata().get(HTML);
        SendResult result = deliver(tenantCode, new ContextMessage(null, null, message.address(), null, null, null,
                message.templateName(), null, Map.of(), subject == null ? null : subject.toString(), message.body(),
                message.runId(), message.step(), html == null ? null : html.toString()));
        if (!result.accepted()) {
            throw new SendFailure(result.error(), result.retryable());
        }
        Message sent = messageRepository.markSent(messageId, result.messageId(), Map.of(),
                OffsetDateTime.now(ZoneOffset.UTC));
        return sent != null ? sent : messageRepository.findById(messageId);
    }

    private Message storeOutbound(Conversation conversation, ContextMessage message, OffsetDateTime now,
            Map<String, Object> metadata, MessageStatus status, String providerMessageId, String errorMessage) {
        Message outgoing = new Message(
                UUID.randomUUID().toString(), conversation.id(), MessageDirection.OUTBOUND, MessageRole.SYSTEM,
                MessageType.TEXT, message.body(), message.templateName(), null, null, null, providerMessageId, status,
                errorMessage, null, null, null, metadata, status == MessageStatus.SENT ? now : null, null, null, now,
                Channel.EMAIL, message.to(), null, message.runId(), message.step());
        String preview = message.subject() != null ? message.subject() : message.body();
        Message stored = messageRepository.appendOutbound(outgoing, ConversationRepository.OutboundTouch.ofContext(
                message.contextKind(), message.contextKey(), now,
                preview == null || preview.length() <= PREVIEW_MAX ? preview : preview.substring(0, PREVIEW_MAX)));
        if (stored == null) {
            Message already = messageRepository.findByProviderMessageId(Channel.EMAIL, providerMessageId);
            if (already == null) {
                throw new IllegalStateException("Email provider message was not found after an insert conflict");
            }
            return already;
        }
        return stored;
    }

    private SendResult deliver(String tenantCode, ContextMessage message) {
        String sendingTenant = accounts.sendingTenant(tenantCode, ChannelAccountsService.EMAIL);
        if (!sender.configured(sendingTenant)) {
            return SendResult.failedPermanently(sendingTenant.equals(tenantCode)
                    ? "The organization has no active RESEND connection; connect it or use the platform's account"
                    : "The platform has no email account configured");
        }
        EmailMessage email;
        try {
            String html = message.html() == null ? null : layout.wrap(message.subject(), message.html());
            email = new EmailMessage(null, message.to(), message.subject(), message.body(), html, null);
        } catch (IllegalArgumentException e) {
            return SendResult.failedPermanently(e.getMessage());
        }
        String key = message.runId() == null ? null : message.runId() + ":" + message.step() + ":" + message.to();
        return sender.send(sendingTenant, email, key);
    }
}
