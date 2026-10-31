package com.microboxlabs.miot.conversational.jobs;

import static org.junit.jupiter.api.Assertions.*;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import com.microboxlabs.miot.conversational.service.WhatsAppMessagingService;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplate;
import com.microboxlabs.miot.conversational.service.WhatsAppTemplatesService;
import com.microboxlabs.miot.core.mail.Mail;
import com.microboxlabs.miot.core.mail.MailDelivery;
import com.microboxlabs.miot.core.mail.OrganizationMailer;
import com.microboxlabs.miot.integrations.domain.ConnectionStatus;
import com.microboxlabs.miot.integrations.domain.IntegrationConnection;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.email.PlatformMailService;
import com.microboxlabs.miot.integrations.geocoding.GeocodingQuotaNotification;
import com.microboxlabs.miot.integrations.persistence.IntegrationConnectionRepository;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import java.math.BigDecimal;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.function.Function;
import org.junit.jupiter.api.Test;

class GeocodingQuotaNotificationHandlerTest {
    private final ObjectMapper mapper = new ObjectMapper();
    private final List<String> emailTenants = new ArrayList<>();
    private final List<String> emailKeys = new ArrayList<>();
    private final List<SendWhatsAppMessageRequest> messages = new ArrayList<>();
    private final List<String> whatsappTenants = new ArrayList<>();
    private boolean mailFails;
    private boolean whatsappFails;
    private boolean whatsappThrows;
    private boolean platformConnection = true;
    private boolean configured = true;
    private String status = "APPROVED";

    private GeocodingQuotaNotificationHandler handler() {
        OrganizationMailer mailer = (org, mail, key) -> {
            emailTenants.add(org.tenantClientId);
            emailKeys.add(key);
            return Uni.createFrom().item(mailFails ? MailDelivery.failed(mail.to()) : MailDelivery.sent());
        };
        PlatformMailService platform = new PlatformMailService(null, null, null, null, null) {
            @Override
            public MailDelivery send(Mail mail, String key) {
                emailTenants.add("_platform");
                emailKeys.add(key);
                return mailFails ? MailDelivery.failed(mail.to()) : MailDelivery.sent();
            }
        };
        WhatsAppMessagingService messaging = new WhatsAppMessagingService(null, null, null, null, null) {
            @Override
            public Message send(String tenant, SendWhatsAppMessageRequest request, String actor) {
                messages.add(request);
                whatsappTenants.add(tenant);
                if (whatsappThrows) throw new IllegalStateException("Provider echoed " + request.to() + " admin@example.com");
                return new Message("message-1", "conversation-1", MessageDirection.OUTBOUND,
                        MessageRole.SYSTEM, request.isTemplate() ? MessageType.TEMPLATE : MessageType.TEXT,
                        request.body(), request.templateName(), null, null, null, "wamid.example",
                        whatsappFails ? MessageStatus.FAILED : MessageStatus.SENT,
                        whatsappFails ? "Provider echoed " + request.to() : null,
                        actor, null, null, Map.of(), null, null, null, null,
                        Channel.WHATSAPP, request.to(), null, null, null);
            }
        };
        WhatsAppTemplatesService meta = new WhatsAppTemplatesService(
                (Function<String, com.microboxlabs.miot.integrations.service.ResolvedConnection>) null, null) {
            @Override
            public List<WhatsAppTemplate> list(String tenant) {
                return List.of(WhatsAppTemplate.from(new JsonObject().put("name", GeocodingQuotaNotification.TEMPLATE_NAME)
                        .put("language", "es").put("status", status)));
            }
        };
        TemplateStore templates = new TemplateStore() {
            public List<ConvTemplate> list(String tenant) { return List.of(); }
            public Optional<ConvTemplate> find(String tenant, String key) {
                return configured ? Optional.of(new ConvTemplate("template-1", tenant, key, "Quota",
                        GeocodingQuotaNotification.TEMPLATE_BODY,
                        new ConvTemplate.WhatsApp(GeocodingQuotaNotification.TEMPLATE_NAME, "es",
                                List.of("organization", "used", "quota", "pct", "next_step")),
                        null, null, null, "test", "0.1.0")) : Optional.empty();
            }
            public Optional<ConvTemplate> upsert(ConvTemplate template, String version) { return Optional.empty(); }
        };
        IntegrationConnectionRepository connections = new IntegrationConnectionRepository(null) {
            @Override
            public IntegrationConnection findActiveByProvider(String tenant, ProviderType provider) {
                return platformConnection ? new IntegrationConnection("connection-1", tenant, "WhatsApp", provider,
                        null, null, ConnectionStatus.ACTIVE, null, null, Map.of()) : null;
            }
        };
        return new GeocodingQuotaNotificationHandler(mapper, mailer, platform, messaging, meta, templates,
                connections, Optional.of("https://app.example.com"));
    }

    private Map<String, Object> payload(List<String> owners, List<String> admins, List<String> platform, List<String> org) {
        return mapper.convertValue(new GeocodingQuotaNotification("example-org", "Example", 1, "tenant-1", "2026-10",
                "exhausted", 100, 100, 100, "review", true, new BigDecimal("0.005"),
                "/app/es/users/settings/geocoding", owners, admins, platform, org), new TypeReference<>() {});
    }

    @Test
    void usesEachAudiencesSenderAndDeterministicEmailKeys() {
        var p = payload(List.of("owner@example.com"), List.of("admin@example.com", "owner@example.com"), List.of(), List.of());
        var handler = handler();
        assertEquals("SUCCEEDED", handler.handle("tenant-1", p).outcome());
        assertEquals(List.of("_platform", "tenant-1"), emailTenants);
        assertTrue(emailKeys.get(0).startsWith("geocoding-quota:example-org:2026-10:exhausted:platform:"));
        handler.handle("tenant-1", p);
        assertEquals(emailKeys.get(0), emailKeys.get(2));
        assertFalse(emailKeys.get(0).contains("owner@example.com"));
    }

    @Test
    void approvedConfiguredTemplateUsesTheCorrectConnectionsAndNamedParams() {
        var outcome = handler().handle("tenant-1", payload(List.of(), List.of(), List.of("+15550000001"), List.of("+15550000002")));
        assertTrue(outcome.detail().contains("2/2"));
        assertEquals(List.of("tenant-1", "_platform"), whatsappTenants);
        assertTrue(messages.stream().allMatch(SendWhatsAppMessageRequest::isTemplate));
        assertEquals("es", messages.get(0).language());
        assertEquals(5, messages.get(0).templateParams().size());
        assertTrue(messages.get(0).templateParams().get("next_step").contains("próximo mes"));
        assertNull(messages.get(0).serviceCode());
    }

    @Test
    void pendingTemplateFallsBackToFreeText() {
        status = "PENDING";
        handler().handle("tenant-1", payload(List.of(), List.of(), List.of(), List.of("+15550000001")));
        assertEquals("TEXT", messages.get(0).type());
        assertTrue(messages.get(0).body().contains("2026-10 (UTC): 100 / 100"));
    }

    @Test
    void missingLocalTemplateFallsBackToFreeText() {
        configured = false;
        handler().handle("tenant-1", payload(List.of(), List.of(), List.of(), List.of("+15550000001")));
        assertFalse(messages.get(0).isTemplate());
    }

    @Test
    void missingPlatformConnectionSkipsItsRecipients() {
        platformConnection = false;
        var result = handler().handle("tenant-1", payload(List.of(), List.of(), List.of("+15550000001"), List.of()));
        assertEquals("SUCCEEDED", result.outcome());
        assertTrue(result.detail().contains("no platform WhatsApp connection"));
        assertTrue(messages.isEmpty());
    }

    @Test
    void emptyRecipientsSucceedWithoutDelivery() {
        assertTrue(handler().handle("tenant-1", payload(List.of(), List.of(), List.of(), List.of()))
                .detail().contains("no delivery recipients"));
        assertTrue(emailTenants.isEmpty());
    }

    @Test
    void partialFailureSucceedsWithMaskedDetails() {
        whatsappFails = true;
        var result = handler().handle("tenant-1", payload(List.of("owner@example.com"), List.of(), List.of(), List.of("+15550000001")));
        assertEquals("SUCCEEDED", result.outcome());
        assertTrue(result.detail().contains("1/2"));
        assertTrue(result.detail().contains("****0001"));
        assertFalse(result.detail().contains("+15550000001"));
        assertFalse(result.detail().contains("owner@example.com"));
    }

    @Test
    void allFailedThrowsForLedgerRetryWithoutProviderPii() {
        mailFails = true;
        whatsappThrows = true;
        var p = payload(List.of("owner@example.com"), List.of("admin@example.com"), List.of(), List.of("+15550000001"));
        var failure = assertThrows(IllegalStateException.class, () -> handler().handle("tenant-1", p));
        assertTrue(failure.getMessage().contains("0/3"));
        assertTrue(failure.getMessage().contains("o***@***"));
        assertFalse(failure.getMessage().contains("owner@example.com"));
        assertFalse(failure.getMessage().contains("admin@example.com"));
        assertFalse(failure.getMessage().contains("+15550000001"));
        assertNull(failure.getCause());
    }

    @Test
    void tenantMismatchFailsBeforeAnyDelivery() {
        var p = payload(List.of("owner@example.com"), List.of(), List.of(), List.of());
        assertThrows(IllegalArgumentException.class, () -> handler().handle("other-tenant", p));
        assertTrue(emailTenants.isEmpty());
    }
}
