package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.client.MetaWhatsAppClient;
import com.microboxlabs.miot.conversational.client.WhatsAppSendException;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.ConversationStatus;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
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
    private static final String DEFAULT_LANGUAGE = "es_CL";

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
                now,
                Channel.WHATSAPP,
                request.to(),
                null,
                null,
                null));

        conversationRepository.updateOutbound(
                conversation.id(),
                request.serviceCode() == null ? null : ContextKind.SERVICE,
                request.serviceCode(),
                request.serviceCode(),
                request.processInstanceId(),
                request.taskId(),
                request.driverId(),
                now,
                preview(request));

        return message;
    }

    /**
     * Sends the Meta template {@code message.templateName()} with its NAMED parameters and stores it, with the
     * run and step, on the conversation about the message's context with the recipient. The stored body is
     * {@code message.body()}. Any failure (no connection, a recipient the connection's test mode does not
     * allow, Meta refusing the send) is stored as FAILED with its reason. With {@code simulate} nothing is sent
     * and the message is stored SIMULATED.
     */
    public Message sendInContext(String tenantCode, ContextMessage message, boolean simulate) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.contextKind(), message.contextKey(), message.to(), message.to(), message.displayName(),
                message.role(), message.contactId(), now);
        String providerMessageId = null;
        MessageStatus status;
        String errorMessage = null;
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (simulate) {
            status = MessageStatus.SIMULATED;
        } else {
            try {
                ResolvedConnection connection = connectionResolver.resolve(tenantCode, ProviderType.WHATSAPP);
                metadata = metadata(connection);
                String phoneNumberId = connection.metadataString(PHONE_NUMBER_ID);
                String token = connection.secretString(TOKEN);
                if (phoneNumberId == null || phoneNumberId.isBlank() || token == null || token.isBlank()) {
                    throw new ConnectionResolutionException(
                            "WhatsApp connection is missing phone_number_id or the access token");
                }
                enforceTestMode(connection, message.to());
                providerMessageId = metaClient.sendTemplate(connection.baseUrl(), phoneNumberId, token,
                        message.to(), message.templateName(),
                        message.language() == null ? DEFAULT_LANGUAGE : message.language(), message.params());
                status = MessageStatus.SENT;
            } catch (ConnectionResolutionException | IllegalArgumentException | WhatsAppSendException e) {
                LOG.warnf("WhatsApp run send failed for tenant %s to %s: %s", tenantCode, maskPhone(message.to()),
                        e.getMessage());
                status = MessageStatus.FAILED;
                errorMessage = e.getMessage();
            }
        }
        Message stored = messageRepository.append(new Message(
                UUID.randomUUID().toString(), conversation.id(), MessageDirection.OUTBOUND, MessageRole.SYSTEM,
                MessageType.TEMPLATE, message.body(), message.templateName(), null, null, null, providerMessageId,
                status, errorMessage, null, null, null, metadata, status == MessageStatus.SENT ? now : null,
                null, null, now, Channel.WHATSAPP, message.to(), null, message.runId(), message.step()));
        conversationRepository.updateOutbound(conversation.id(), message.contextKind(), message.contextKey(),
                message.contextKind() == ContextKind.SERVICE ? message.contextKey() : null, null, null, null, now,
                truncate(message.body() != null ? message.body() : message.templateName()));
        return stored;
    }

    private static String truncate(String text) {
        if (text == null) {
            return null;
        }
        return text.length() <= PREVIEW_MAX ? text : text.substring(0, PREVIEW_MAX);
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
     * Chooses the conversation for a send. With a service code: the conversation about that
     * service with this recipient, else the recipient's open conversation without context (the
     * following {@code updateOutbound} gives it the service), else a new one. Without a service
     * code: the recipient's open conversation without context, else a new one. Two recipients
     * messaged about one service get two conversations.
     */
    private Conversation findOrCreateConversation(
            String tenantCode, SendWhatsAppMessageRequest request, OffsetDateTime now) {
        // serviceCode is normalized to null-if-blank by the request record.
        String serviceCode = request.serviceCode();
        String address = request.to();
        if (serviceCode != null) {
            Conversation byService = conversationRepository.findByContextAndAddress(
                    tenantCode, ContextKind.SERVICE, serviceCode, address);
            if (byService != null) {
                return byService;
            }
        }
        Conversation unassigned = conversationRepository.findOpenUnassignedByAddress(tenantCode, address);
        if (unassigned != null) {
            return unassigned;
        }
        return conversationRepository.create(newConversation(tenantCode, request, now));
    }

    static Conversation newConversation(String tenantCode, SendWhatsAppMessageRequest request, OffsetDateTime now) {
        String serviceCode = request.serviceCode();
        return new Conversation(
                UUID.randomUUID().toString(),
                tenantCode,
                request.to(),
                null,
                request.driverId(),
                serviceCode,
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
                now,
                serviceCode == null ? null : ContextKind.SERVICE,
                serviceCode,
                request.to(),
                null,
                request.driverId() == null ? null : Conversation.ROLE_DRIVER,
                null,
                Map.of());
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
