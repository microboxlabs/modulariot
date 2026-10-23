package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.integrations.email.EmailMessage;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
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
 * Sends a rule's email through the tenant's RESEND connection (else the platform's, as organization mail does)
 * and stores it on the conversation about the message's context with the recipient. A failed send is stored
 * FAILED with its reason; with {@code simulate} nothing is sent and the message is stored SIMULATED. Reply-to is
 * not set yet (#2006).
 */
@ApplicationScoped
public class EmailMessagingService {

    private static final int PREVIEW_MAX = 280;
    static final String SUBJECT = "subject";

    private final ResendEmailSender sender;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Inject
    public EmailMessagingService(ResendEmailSender sender, ConversationRepository conversationRepository,
            MessageRepository messageRepository) {
        this.sender = sender;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    public Message sendInContext(String tenantCode, ContextMessage message, boolean simulate) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.participant(null), now);
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (message.subject() != null) {
            metadata.put(SUBJECT, message.subject());
        }
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
        }
        Message stored = messageRepository.append(new Message(
                UUID.randomUUID().toString(), conversation.id(), MessageDirection.OUTBOUND, MessageRole.SYSTEM,
                MessageType.TEXT, message.body(), message.templateName(), null, null, null, providerMessageId, status,
                errorMessage, null, null, null, metadata, status == MessageStatus.SENT ? now : null, null, null, now,
                Channel.EMAIL, message.to(), null, message.runId(), message.step()));
        String preview = message.subject() != null ? message.subject() : message.body();
        conversationRepository.updateOutbound(conversation.id(), ConversationRepository.OutboundTouch.ofContext(
                message.contextKind(), message.contextKey(), now,
                preview == null || preview.length() <= PREVIEW_MAX ? preview : preview.substring(0, PREVIEW_MAX)));
        return stored;
    }

    private SendResult deliver(String tenantCode, ContextMessage message) {
        String sendingTenant = sender.configured(tenantCode) ? tenantCode : null;
        if (sendingTenant == null && sender.configured(PlatformMailService.PLATFORM_TENANT)) {
            sendingTenant = PlatformMailService.PLATFORM_TENANT;
        }
        if (sendingTenant == null) {
            return SendResult.failed(0, "No email sender: set a RESEND connection in Settings");
        }
        EmailMessage email;
        try {
            email = new EmailMessage(null, message.to(), message.subject(), message.body(), null, null);
        } catch (IllegalArgumentException e) {
            return SendResult.failed(0, e.getMessage());
        }
        String key = message.runId() == null ? null : message.runId() + ":" + message.step() + ":" + message.to();
        return sender.send(sendingTenant, email, key);
    }
}
