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
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Set;
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
    private static final String TEST_MODE_ENABLED = "test_mode_enabled";
    private static final String TEST_RECIPIENTS = "test_recipients";

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
        enforceTestMode(connection, request.to());

        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = findOrCreateConversation(tenantCode, request, now);

        String metaMessageId = null;
        MessageStatus status;
        String errorMessage = null;
        try {
            metaMessageId = dispatch(connection, phoneNumberId, token, request);
            status = MessageStatus.SENT;
        } catch (WhatsAppSendException e) {
            LOG.warnf(e, "WhatsApp send failed for tenant %s to %s", tenantCode, maskPhone(request.to()));
            status = MessageStatus.FAILED;
            errorMessage = e.getMessage();
        }

        Message message = messageRepository.append(new Message(
                UUID.randomUUID().toString(),
                conversation.id(),
                MessageDirection.OUTBOUND,
                request.roleOrDefault(),
                request.isTemplate() ? MessageType.TEMPLATE : MessageType.TEXT,
                renderedBody(request),
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

    /**
     * Resolves the thread this outbound belongs to under the per-service model. A trip-tied send
     * (carries a service code) lands on that service's thread — reusing it across the whole service
     * life, or adopting the phone's open no-service thread on first contact, or opening a fresh one.
     * An ad-hoc send with no service uses the phone's open no-service thread (or a new one). The
     * subsequent {@code updateOutbound} COALESCE fills the service code when adopting.
     */
    private Conversation findOrCreateConversation(
            String tenantCode, SendWhatsAppMessageRequest request, OffsetDateTime now) {
        String serviceCode = request.serviceCode();
        if (serviceCode != null && !serviceCode.isBlank()) {
            Conversation byService = conversationRepository.findByTenantAndService(tenantCode, serviceCode);
            if (byService != null) {
                return byService;
            }
        }
        Conversation unassigned = conversationRepository.findOpenUnassignedByPhone(tenantCode, request.to());
        if (unassigned != null) {
            return unassigned;
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

    /**
     * Demo/dev safety: when the connection's metadata has {@code test_mode_enabled} truthy,
     * only allow sends to recipients on {@code test_recipients} (digit-only match, so
     * formatting is ignored). Any other recipient is rejected so a real driver is never
     * messaged while testing. Off/absent → no restriction. Config is per-connection (DB),
     * editable in Settings at runtime — no restart.
     */
    static void enforceTestMode(ResolvedConnection connection, String to) {
        Map<String, Object> metadata = connection.metadata();
        if (metadata == null || !isTruthy(metadata.get(TEST_MODE_ENABLED))) {
            return;
        }
        if (!parseRecipients(metadata.get(TEST_RECIPIENTS)).contains(digitsOnly(to))) {
            throw new IllegalArgumentException(
                    "Test mode is active for this WhatsApp connection — the recipient is not "
                            + "on the allowed test-recipient list");
        }
    }

    private static boolean isTruthy(Object value) {
        return Boolean.TRUE.equals(value) || "true".equalsIgnoreCase(String.valueOf(value));
    }

    /** Accepts a JSON array (Iterable) or a comma-separated string; returns digit-only forms. */
    static Set<String> parseRecipients(Object value) {
        Set<String> recipients = new HashSet<>();
        if (value instanceof Iterable<?> iterable) {
            for (Object item : iterable) {
                addDigits(recipients, String.valueOf(item));
            }
        } else if (value != null) {
            for (String part : String.valueOf(value).split(",")) {
                addDigits(recipients, part);
            }
        }
        return recipients;
    }

    private static void addDigits(Set<String> recipients, String raw) {
        String digits = digitsOnly(raw);
        if (!digits.isBlank()) {
            recipients.add(digits);
        }
    }

    /** Reduces a phone to digits only, so formatting differences don't affect matching. */
    static String digitsOnly(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    /** Masks a phone number for logs, keeping only the last 4 digits (PII reduction). */
    private static String maskPhone(String phone) {
        if (phone == null || phone.length() <= 4) {
            return "****";
        }
        return "****" + phone.substring(phone.length() - 4);
    }

    private static Map<String, Object> metadata(ResolvedConnection connection) {
        Map<String, Object> metadata = new LinkedHashMap<>();
        metadata.put("connectionId", connection.connectionId());
        return metadata;
    }

    /**
     * Body persisted to the pool: the free-text body for TEXT, or the rendered template copy for
     * TEMPLATE (so the panel shows the real message). Null for a template we don't have copy for —
     * the UI then falls back to the template name.
     */
    private static String renderedBody(SendWhatsAppMessageRequest request) {
        if (!request.isTemplate()) {
            return request.body();
        }
        return WhatsAppTemplateRenderer.render(request.templateName(), request.templateParamsOrEmpty());
    }

    private static String preview(SendWhatsAppMessageRequest request) {
        String text = renderedBody(request);
        if (text == null) {
            // Unknown template (no local copy) — fall back to its name so the list still shows something.
            text = request.isTemplate() ? request.templateName() : null;
        }
        if (text == null) {
            return null;
        }
        return text.length() <= PREVIEW_MAX ? text : text.substring(0, PREVIEW_MAX);
    }
}
