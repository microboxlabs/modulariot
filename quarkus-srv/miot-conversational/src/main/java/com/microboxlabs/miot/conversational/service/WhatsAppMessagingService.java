package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.accounts.ChannelAccountsService;
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
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
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

    /** The tenant of the platform's connections; its WhatsApp account sends the rule messages. */
    public static final String PLATFORM_TENANT = PlatformMailService.PLATFORM_TENANT;
    /** Message metadata: the tenant of the connection the message went through. */
    public static final String CONNECTION_TENANT = "connectionTenant";
    static final String NO_PLATFORM_WHATSAPP = "La plataforma no tiene WhatsApp configurado";
    static final String NO_OWN_WHATSAPP = "La organización no tiene una cuenta de WhatsApp conectada";
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
    private final ChannelAccountsService accounts;

    @Inject
    public WhatsAppMessagingService(
            IntegrationConnectionResolver connectionResolver,
            MetaWhatsAppClient metaClient,
            ConversationRepository conversationRepository,
            MessageRepository messageRepository,
            ChannelAccountsService accounts) {
        this.connectionResolver = connectionResolver;
        this.metaClient = metaClient;
        this.conversationRepository = conversationRepository;
        this.messageRepository = messageRepository;
        this.accounts = accounts;
    }

    /**
     * With {@code request.conversationId()} the message goes on that conversation of the organization, from the
     * number the conversation used last: the platform's when a rule wrote or the person answered there, else
     * the organization's own. Without it the conversation is chosen as before and the organization's number sends.
     */
    public Message send(String tenantCode, SendWhatsAppMessageRequest request, String sentByUserId) {
        validate(request);

        Conversation target = targetConversation(tenantCode, request);
        String sendingTenant = target == null ? tenantCode : replyTenant(tenantCode, target.id());
        ResolvedConnection connection = sendingConnection(sendingTenant);
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
        Conversation conversation = target != null ? target : findOrCreateConversation(tenantCode, request, now);
        Map<String, Object> metadata = metadata(connection);
        metadata.put(CONNECTION_TENANT, sendingTenant);

        String metaMessageId = null;
        MessageStatus status;
        String errorMessage = null;
        try {
            metaMessageId = dispatch(connection, phoneNumberId, token, request);
            status = MessageStatus.SENT;
        } catch (WhatsAppSendException e) {
            LOG.warnf("WhatsApp send failed for tenant %s to %s (%s)", tenantCode, maskPhone(request.to()),
                    e.getClass().getSimpleName());
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
                metadata,
                status == MessageStatus.SENT ? now : null,
                null,
                null,
                now,
                Channel.WHATSAPP,
                request.to(),
                null,
                null,
                null));

        conversationRepository.updateOutbound(conversation.id(), new ConversationRepository.OutboundTouch(
                request.serviceCode() == null ? null : ContextKind.SERVICE,
                request.serviceCode(),
                request.serviceCode(),
                request.processInstanceId(),
                request.taskId(),
                request.driverId(),
                now,
                preview(request)));

        return message;
    }

    /**
     * Sends the Meta template {@code message.templateName()} with its NAMED parameters and stores it, with the
     * run and step, on the organization's conversation about the message's context with the recipient. It goes
     * through the platform's WhatsApp connection, or the organization's own when its WhatsApp mode is OWN; the
     * template must exist on that connection's WABA. The stored body is {@code message.body()}. Any failure (no
     * connection, a recipient the connection's test mode does not allow, Meta refusing the send) is stored as
     * FAILED with its reason. With {@code simulate} nothing is sent and the message is stored SIMULATED.
     */
    public Message sendInContext(String tenantCode, ContextMessage message, boolean simulate) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.participant(message.to()), now);
        String providerMessageId = null;
        MessageStatus status;
        String errorMessage = null;
        Map<String, Object> metadata = new LinkedHashMap<>();
        if (simulate) {
            status = MessageStatus.SIMULATED;
        } else {
            try {
                String sendingTenant = accounts.sendingTenant(tenantCode, ChannelAccountsService.WHATSAPP);
                ResolvedConnection connection = sendingConnection(sendingTenant);
                metadata = metadata(connection);
                metadata.put(CONNECTION_TENANT, sendingTenant);
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
        conversationRepository.updateOutbound(conversation.id(), ConversationRepository.OutboundTouch.ofContext(
                message.contextKind(), message.contextKey(), now,
                truncate(message.body() != null ? message.body() : message.templateName())));
        return stored;
    }

    /** Stores a rule's WhatsApp message as PENDING on its context's conversation; its job sends it. */
    public Message queueInContext(String tenantCode, ContextMessage message) {
        OffsetDateTime now = OffsetDateTime.now(ZoneOffset.UTC);
        Conversation conversation = conversationRepository.findOrCreateForContext(tenantCode,
                message.participant(message.to()), now);
        Message stored = messageRepository.appendQueued(new Message(
                QueuedMessageId.forStep(message, Channel.WHATSAPP), conversation.id(), MessageDirection.OUTBOUND,
                MessageRole.SYSTEM, MessageType.TEMPLATE, message.body(), message.templateName(), null, null, null, null,
                MessageStatus.PENDING, null, null, null, null, Map.of(), null, null, null, now, Channel.WHATSAPP,
                message.to(), null, message.runId(), message.step()));
        conversationRepository.updateOutbound(conversation.id(), ConversationRepository.OutboundTouch.ofContext(
                message.contextKind(), message.contextKey(), now,
                truncate(message.body() != null ? message.body() : message.templateName())));
        return stored;
    }

    /**
     * Sends a PENDING message of this organization through its sending account and marks it SENT. A message
     * no longer PENDING is returned as it is, except FAILED after a manual retry of its parked job.
     *
     * @throws SendFailure when Meta did not take it
     */
    public Message deliverQueued(String tenantCode, String messageId, String language, Map<String, String> params) {
        Message message = queued(messageRepository, conversationRepository, tenantCode, messageId);
        if (message.status() != MessageStatus.PENDING && message.status() != MessageStatus.FAILED) {
            return message;
        }
        try {
            String sendingTenant = accounts.sendingTenant(tenantCode, ChannelAccountsService.WHATSAPP);
            ResolvedConnection connection = sendingConnection(sendingTenant);
            Map<String, Object> metadata = metadata(connection);
            metadata.put(CONNECTION_TENANT, sendingTenant);
            String phoneNumberId = connection.metadataString(PHONE_NUMBER_ID);
            String token = connection.secretString(TOKEN);
            if (phoneNumberId == null || phoneNumberId.isBlank() || token == null || token.isBlank()) {
                throw new ConnectionResolutionException(
                        "WhatsApp connection is missing phone_number_id or the access token");
            }
            enforceTestMode(connection, message.address());
            String wamid = metaClient.sendTemplate(connection.baseUrl(), phoneNumberId, token, message.address(),
                    message.templateName(), language == null ? DEFAULT_LANGUAGE : language,
                    params == null ? Map.of() : params);
            Message sent = messageRepository.markSent(messageId, wamid, metadata, OffsetDateTime.now(ZoneOffset.UTC));
            return sent != null ? sent : messageRepository.findById(messageId);
        } catch (ConnectionResolutionException | IllegalArgumentException e) {
            throw new SendFailure(e.getMessage(), false);
        } catch (WhatsAppSendException e) {
            LOG.warnf("WhatsApp send of message %s failed (HTTP %s): %s", messageId, e.httpStatus(), e.getMessage());
            throw new SendFailure(e.getMessage(), SendFailure.retryable(e.httpStatus()));
        }
    }

    /** The message of this organization; a missing or foreign one fails for good. */
    static Message queued(MessageRepository messages, ConversationRepository conversations, String tenantCode,
            String messageId) {
        Message message = messageId == null ? null : messages.findById(messageId);
        Conversation conversation = message == null ? null : conversations.findById(message.conversationId());
        if (conversation == null || !tenantCode.equals(conversation.tenantCode())) {
            throw new SendFailure("The message " + messageId + " is not a message of this organization", false);
        }
        return message;
    }

    private Conversation targetConversation(String tenantCode, SendWhatsAppMessageRequest request) {
        if (request.conversationId() == null) {
            return null;
        }
        Conversation conversation = conversationRepository.findByTenantAndId(tenantCode, request.conversationId());
        if (conversation == null || !digits(request.to()).equals(digits(conversation.participantAddress()))) {
            throw new IllegalArgumentException("conversationId: no conversation of this organization with 'to'");
        }
        return conversation;
    }

    /** The platform's number when the conversation last used it, else the organization's own. */
    private String replyTenant(String tenantCode, String conversationId) {
        return PLATFORM_TENANT.equals(messageRepository.findLatestConnectionTenant(conversationId))
                ? PLATFORM_TENANT : tenantCode;
    }

    private static String digits(String phone) {
        return phone == null ? "" : phone.replaceAll("\\D", "");
    }

    private ResolvedConnection sendingConnection(String sendingTenant) {
        try {
            return connectionResolver.resolve(sendingTenant, ProviderType.WHATSAPP);
        } catch (ConnectionNotConfiguredException e) {
            throw new ConnectionResolutionException(
                    PLATFORM_TENANT.equals(sendingTenant) ? NO_PLATFORM_WHATSAPP : NO_OWN_WHATSAPP);
        }
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
