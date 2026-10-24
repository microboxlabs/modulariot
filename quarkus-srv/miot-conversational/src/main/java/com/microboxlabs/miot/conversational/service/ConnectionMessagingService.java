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
import com.microboxlabs.miot.integrations.service.OperationInvocationResult;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import java.util.function.Supplier;

/**
 * Makes a rule's call to an integration connection (webhook, Slack, Teams) and stores it as a message on the
 * conversation about the message's context with the connection: address the connection id, display name the
 * connection's name. SENT on a 2xx, FAILED with the reason otherwise; with {@code simulate} nothing is called and
 * the message is stored SIMULATED.
 */
@ApplicationScoped
public class ConnectionMessagingService {

    private static final int PREVIEW_MAX = 280;
    static final String SUBJECT = "subject";
    static final String HTTP_STATUS = "httpStatus";

    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Inject
    public ConnectionMessagingService(ConversationRepository conversationRepository,
            MessageRepository messageRepository) {
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    /**
     * @param message {@code to} the connection id, {@code displayName} its name, {@code subject} the title,
     *                {@code body} the text
     * @param call    the call to the connection; not made with {@code simulate}
     */
    public Message sendInContext(String tenantCode, Channel channel, ContextMessage message, boolean simulate,
            Supplier<OperationInvocationResult> call) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.participant(null), now);
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (message.subject() != null) {
            metadata.put(SUBJECT, message.subject());
        }
        MessageStatus status;
        String errorMessage = null;
        if (simulate) {
            status = MessageStatus.SIMULATED;
        } else {
            try {
                OperationInvocationResult result = call.get();
                metadata.put(HTTP_STATUS, result.status());
                status = result.successful() ? MessageStatus.SENT : MessageStatus.FAILED;
                errorMessage = result.successful() ? null : result.summary();
            } catch (RuntimeException e) {
                // The invoker rethrows other runtime errors as is, such as the outbound URL guard's.
                status = MessageStatus.FAILED;
                errorMessage = e.getMessage();
            }
        }
        Message stored = messageRepository.append(new Message(
                UUID.randomUUID().toString(), conversation.id(), MessageDirection.OUTBOUND, MessageRole.SYSTEM,
                MessageType.TEXT, message.body(), message.templateName(), null, null, null, null, status,
                errorMessage, null, null, null, metadata, status == MessageStatus.SENT ? now : null, null, null, now,
                channel, message.to(), null, message.runId(), message.step()));
        String preview = message.subject() != null ? message.subject() : message.body();
        conversationRepository.updateOutbound(conversation.id(), ConversationRepository.OutboundTouch.ofContext(
                message.contextKind(), message.contextKey(), now,
                preview == null || preview.length() <= PREVIEW_MAX ? preview : preview.substring(0, PREVIEW_MAX)));
        return stored;
    }
}
