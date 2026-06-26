package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.client.MetaWhatsAppClient;
import com.microboxlabs.miot.conversational.client.WhatsAppSendException;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.persistence.ConversationRepository;
import com.microboxlabs.miot.conversational.persistence.MessageRepository;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ConnectionResolutionException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;
import org.jboss.logging.Logger;

/**
 * Sends an outbound WhatsApp message and persists it to the message pool. Resolves the
 * org's WHATSAPP connection (base URL + phone-number-id + token) via miot-integrations,
 * calls Meta, then records the message and updates the conversation head row. A failed
 * send is still persisted (status FAILED) so the pool reflects every attempt.
 */
@ApplicationScoped
public class WhatsAppMessagingService {

    private static final Logger LOG = Logger.getLogger(WhatsAppMessagingService.class);
    private static final String PHONE_NUMBER_ID = "phone_number_id";
    private static final String TOKEN = "token";
    private static final int PREVIEW_MAX = 280;

    private final IntegrationConnectionResolver connectionResolver;
    private final MetaWhatsAppClient metaClient;
    private final ConversationRepository conversationRepository;
    private final MessageRepository messageRepository;

    @Inject
    public WhatsAppMessagingService(
            IntegrationConnectionResolver connectionResolver,
            MetaWhatsAppClient metaClient,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository) {
        this.connectionResolver = connectionResolver;
        this.metaClient = metaClient;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
    }

    public Message send(String tenantCode, SendWhatsAppMessageRequest request, String sentByUserId) {
        validate(request);

        ResolvedConnection connection = connectionResolver.resolve(tenantCode, ProviderType.WHATSAPP);
        String phoneNumberId = connection.metadataString(PHONE_NUMBER_ID);
        String token = connection.secretString(TOKEN);
        if (phoneNumberId == null || phoneNumberId.isBlank()) {
            throw new ConnectionResolutionException(
                    "WhatsApp connection metadata is missing phone_number_id");
        }
        if (token == null || token.isBlank()) {
            throw new ConnectionResolutionException(
                    "WhatsApp connection credential is missing the access token");
        }

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = findOrCreateConversation(tenantCode, request, now);

        String metaMessageId = null;
        MessageStatus status;
        String errorMessage = null;
        try {
            metaMessageId = dispatch(connection, phoneNumberId, token, request);
            status = MessageStatus.SENT;
        } catch (WhatsAppSendException e) {
            LOG.warnf(e, "WhatsApp send failed for tenant %s to %s", tenantCode, request.to());
            status = MessageStatus.FAILED;
            errorMessage = e.getMessage();
        }

        Message message = messageRepository.append(new Message(
                UUID.randomUUID().toString(),
                conversation.id(),
                MessageDirection.OUTBOUND,
                request.roleOrDefault(),
                request.isTemplate() ? MessageType.TEMPLATE : MessageType.TEXT,
                request.isTemplate() ? null : request.body(),
                request.isTemplate() ? request.templateName() : null,
                null,
                null,
                null,
                metaMessageId,
                status,
                errorMessage,
                sentByUserId,
                request.serviceCode(),
                request.processInstanceId(),
                metadata(connection),
                status == MessageStatus.SENT ? now : null,
                null,
                null,
                now));

        conversationRepository.updateOutbound(
                conversation.id(),
                request.serviceCode(),
                request.processInstanceId(),
                request.taskId(),
                request.driverId(),
                now,
                preview(request));

        return message;
    }

    private String dispatch(
            ResolvedConnection connection,
            String phoneNumberId,
            String token,
            SendWhatsAppMessageRequest request) {
        if (request.isTemplate()) {
            return metaClient.sendTemplate(
                    connection.baseUrl(), phoneNumberId, token, request.to(),
                    request.templateName(), request.languageOrDefault(), request.templateParamsOrEmpty());
        }
        return metaClient.sendText(connection.baseUrl(), phoneNumberId, token, request.to(), request.body());
    }

    private Conversation findOrCreateConversation(
            String tenantCode, SendWhatsAppMessageRequest request, OffsetDateTime now) {
        Conversation existing = conversationRepository.findByTenantAndPhone(tenantCode, request.to());
        if (existing != null) {
            return existing;
        }
        return conversationRepository.create(new Conversation(
                UUID.randomUUID().toString(),
                tenantCode,
                request.to(),
                null,
                request.driverId(),
                request.serviceCode(),
                request.processInstanceId(),
                request.taskId(),
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

    private static void validate(SendWhatsAppMessageRequest request) {
        if (request == null || request.to() == null || request.to().isBlank()) {
            throw new IllegalArgumentException("'to' (recipient phone in E.164) is required");
        }
        if (request.isTemplate()) {
            if (request.templateName() == null || request.templateName().isBlank()) {
                throw new IllegalArgumentException("'templateName' is required for a TEMPLATE message");
            }
            validateTemplateParams(request.templateParamsOrEmpty());
        } else if (request.body() == null || request.body().isBlank()) {
            throw new IllegalArgumentException("'body' is required for a TEXT message");
        }
    }

    private static void validateTemplateParams(Map<String, String> templateParams) {
        for (Map.Entry<String, String> param : templateParams.entrySet()) {
            if (param.getKey() == null || param.getKey().isBlank()) {
                throw new IllegalArgumentException("templateParams contains a blank parameter name");
            }
            if (param.getValue() == null || param.getValue().isBlank()) {
                throw new IllegalArgumentException(
                        "templateParams['" + param.getKey() + "'] must have a non-blank value");
            }
        }
    }

    private static Map<String, Object> metadata(ResolvedConnection connection) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("connectionId", connection.connectionId());
        return metadata;
    }

    private static String preview(SendWhatsAppMessageRequest request) {
        String text = request.isTemplate()
                ? "[template] " + request.templateName()
                : request.body();
        if (text == null) {
            return null;
        }
        return text.length() <= PREVIEW_MAX ? text : text.substring(0, PREVIEW_MAX);
    }
}
