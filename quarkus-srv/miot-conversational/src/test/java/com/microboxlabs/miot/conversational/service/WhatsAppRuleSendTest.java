package com.microboxlabs.miot.conversational.service;

import com.microboxlabs.miot.conversational.rules.ConvTemplate;
import com.microboxlabs.miot.conversational.rules.store.TemplateStore;
import jakarta.enterprise.inject.Instance;
import java.lang.reflect.Proxy;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.accounts.InMemoryChannelAccounts;
import com.microboxlabs.miot.conversational.client.MetaWhatsAppClient;
import com.microboxlabs.miot.conversational.client.WhatsAppSendException;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.ConnectionNotConfiguredException;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.net.URI;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

/** Rule messages go out through the platform's WhatsApp account and stay the organization's. Placeholder ids. */
class WhatsAppRuleSendTest {

    private static final String TENANT = "tenant-1";
    private static final String PLATFORM = WhatsAppMessagingService.PLATFORM_TENANT;
    private static final String DRIVER = "+56900000001";

    private final InMemoryConversations store = new InMemoryConversations();
    private final Map<String, ResolvedConnection> connections = new HashMap<>();
    private final List<String> sentFrom = new ArrayList<>();
    private final Set<String> failing = new HashSet<>();
    private final InMemoryChannelAccounts accounts = new InMemoryChannelAccounts();
    private final List<String> metered = new ArrayList<>();
    private final WhatsAppMessagingService service = new WhatsAppMessagingService(new FakeResolver(),
            new FakeMeta(), store.conversationRepository, store.messageRepository, accounts.service,
            (tenant, sending, id, at) -> metered.add(tenant + " via " + sending));

    @Test
    void eachTemplateSentIsMeteredWithTheAccountThatSentIt() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));

        service.sendInContext(TENANT, message(), false);
        service.sendInContext(TENANT, message(), true);
        accounts.own(TENANT, "whatsapp");
        service.sendInContext(TENANT, message(), false);

        assertEquals(List.of(TENANT + " via " + PLATFORM, TENANT + " via " + TENANT), metered,
                "a test run sends nothing and meters nothing");
    }

    @Test
    void aRuleMessageIsSentFromThePlatformNumberOnTheOrganizationsConversation() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));

        Message sent = service.sendInContext(TENANT, message(), false);

        assertEquals(List.of("PLATFORM-PNID"), sentFrom);
        assertEquals(MessageStatus.SENT, sent.status());
        assertEquals("conn-platform", sent.metadata().get("connectionId"));
        assertEquals(PLATFORM, sent.metadata().get(WhatsAppMessagingService.CONNECTION_TENANT));
        assertEquals(TENANT, store.conversations.get(sent.conversationId()).tenantCode());
        assertEquals("run-1", sent.runId());
    }

    @Test
    void manualPermissionRequestsEnterTheSameTenantMessagePoolWithTheirSender() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        var number = service.sendingNumber(TENANT, DRIVER);
        String wamid = service.sendCallPermission(TENANT, number, DRIVER, "permission-template", "es", Map.of());
        Message sent = store.messages.stream().filter(m -> wamid.equals(m.providerMessageId())).findFirst().orElseThrow();
        assertEquals(TENANT, store.conversations.get(sent.conversationId()).tenantCode());
        assertEquals("conn-platform", sent.metadata().get("connectionId"));
        assertEquals("PLATFORM-PNID", sent.metadata().get("phoneNumberId"));
        assertEquals(PLATFORM, sent.metadata().get(WhatsAppMessagingService.CONNECTION_TENANT));
        assertTrue(!number.toString().contains("token-platform"));
        assertTrue(number.toString().contains("<redacted>"));
    }

    @Test
    void withoutAPlatformAccountTheMessageFails() {
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));

        Message sent = service.sendInContext(TENANT, message(), false);

        assertTrue(sentFrom.isEmpty());
        assertEquals(MessageStatus.FAILED, sent.status());
        assertEquals("La plataforma no tiene WhatsApp configurado", sent.errorMessage());
        assertNull(sent.providerMessageId());
        assertEquals(TENANT, store.conversations.get(sent.conversationId()).tenantCode());
    }

    @Test
    void anOrganizationOnItsOwnAccountSendsFromItsNumber() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));
        accounts.own(TENANT, "whatsapp");

        Message sent = service.sendInContext(TENANT, message(), false);

        assertEquals(List.of("ORG-PNID"), sentFrom);
        assertEquals(TENANT, sent.metadata().get(WhatsAppMessagingService.CONNECTION_TENANT));

        connections.remove(TENANT);
        Message failed = service.sendInContext(TENANT, message(), false);
        assertEquals(MessageStatus.FAILED, failed.status());
        assertEquals(WhatsAppMessagingService.NO_OWN_WHATSAPP, failed.errorMessage());
    }

    @Test
    void aTestRunResolvesNothing() {
        Message sent = service.sendInContext(TENANT, message(), true);

        assertEquals(MessageStatus.SIMULATED, sent.status());
        assertTrue(sentFrom.isEmpty());
    }

    @Test
    void aManualSendKeepsTheOrganizationsNumber() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));

        Message sent = service.send(TENANT, new SendWhatsAppMessageRequest(
                DRIVER, "TEXT", "hola", null, null, Map.of(), null, null, null, null, null), "user-1");

        assertEquals(List.of("ORG-PNID"), sentFrom);
        assertEquals(TENANT, sent.metadata().get(WhatsAppMessagingService.CONNECTION_TENANT));
    }

    @Test
    void aReplyOnARuleConversationGoesFromTheNumberTheRuleUsed() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));
        Message ruleMessage = service.sendInContext(TENANT, message(), false);

        Message reply = service.send(TENANT, reply(ruleMessage.conversationId()), "user-1");

        assertEquals(List.of("PLATFORM-PNID", "PLATFORM-PNID"), sentFrom);
        assertEquals(ruleMessage.conversationId(), reply.conversationId());
        assertEquals(PLATFORM, reply.metadata().get(WhatsAppMessagingService.CONNECTION_TENANT));

        accounts.own(TENANT, "whatsapp");
        Message own = service.sendInContext(TENANT, message(), false);
        service.send(TENANT, reply(own.conversationId()), "user-1");
        assertEquals("ORG-PNID", sentFrom.get(sentFrom.size() - 1));
    }

    @Test
    void aFailedSendDoesNotChangeTheNumberRepliesGoFrom() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));
        accounts.own(TENANT, "whatsapp");
        Message own = service.sendInContext(TENANT, message(), false);
        accounts.rows.remove(TENANT);
        failing.add("PLATFORM-PNID");

        Message failed = service.sendInContext(TENANT, message(), false);
        service.send(TENANT, reply(own.conversationId()), "user-1");

        assertEquals(MessageStatus.FAILED, failed.status());
        assertEquals(own.conversationId(), failed.conversationId());
        assertEquals(List.of("ORG-PNID", "ORG-PNID"), sentFrom);
    }

    @Test
    void aManualSendStoredWithoutItsTenantCountsAsTheOrganizations() {
        connections.put(PLATFORM, connection("conn-platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));
        Message rule = service.sendInContext(TENANT, message(), false);
        Message older = service.send(TENANT, reply(rule.conversationId()), "user-1");
        older.metadata().remove(WhatsAppMessagingService.CONNECTION_TENANT);
        older.metadata().put("connectionId", "conn-org");

        service.send(TENANT, reply(rule.conversationId()), "user-1");

        assertEquals("ORG-PNID", sentFrom.get(sentFrom.size() - 1));
    }

    @Test
    void aReplyNamesAConversationOfTheOrganizationWithThatRecipient() {
        connections.put(TENANT, connection("conn-org", "ORG-PNID"));

        SendWhatsAppMessageRequest request = reply("00000000-0000-0000-0000-000000000099");
        assertThrows(IllegalArgumentException.class, () -> service.send(TENANT, request, "user-1"));
        assertTrue(sentFrom.isEmpty());
    }

    private static SendWhatsAppMessageRequest reply(String conversationId) {
        return new SendWhatsAppMessageRequest(DRIVER, "TEXT", "voy en camino", null, null, Map.of(), null, null,
                null, null, null, null, conversationId);
    }

    private static ContextMessage message() {
        return new ContextMessage(ContextKind.SYMPTOM_CASE, "-7", DRIVER, "Ana", "driver", null,
                "miot_panic_check_v1", "es_CL", Map.of("nombre", "Ana"), null, "¿Estás bien, Ana?", "run-1", 0);
    }

    private static ResolvedConnection connection(String id, String phoneNumberId) {
        return new ResolvedConnection(id, URI.create("https://graph.example.test"),
                Map.of("phone_number_id", phoneNumberId), Map.of("token", "test-token"));
    }

    private final class FakeResolver extends IntegrationConnectionResolver {
        FakeResolver() {
            super(null, null, null);
        }

        @Override
        public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
            ResolvedConnection connection = connections.get(tenantCode);
            if (connection == null) {
                throw new ConnectionNotConfiguredException("No usable WHATSAPP connection");
            }
            return connection;
        }
    }

    private final class FakeMeta extends MetaWhatsAppClient {
        @Override
        public String sendTemplate(URI baseUrl, String phoneNumberId, String token, String toE164,
                String templateName, String languageCode, Map<String, String> namedParams) {
            if (failing.contains(phoneNumberId)) {
                throw new WhatsAppSendException("Meta refused the send", 400, null);
            }
            sentFrom.add(phoneNumberId);
            return "wamid.out-" + sentFrom.size();
        }

        @Override
        public String sendText(URI baseUrl, String phoneNumberId, String token, String toE164, String body) {
            sentFrom.add(phoneNumberId);
            return "wamid.out-" + sentFrom.size();
        }
    }
    @Test
    void directPermissionTemplatesRequireAdmissionBeforeAnyNetworkCall() {
        var request = new SendWhatsAppMessageRequest(DRIVER, "TEMPLATE", null, "miot_call_permission_request",
                "es", Map.of("nombre", "Ana"), null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> service.send(TENANT, request, "operator"));
        var queued = service.queueInContext(TENANT, new ContextMessage(null, null, DRIVER, null, null, null,
                "miot_call_permission_request", "es", Map.of(), null, "Permission", "run-permission", 0));
        String queuedId = queued.id();
        Map<String, String> emptyParams = Map.of();
        assertThrows(SendFailure.class, () -> service.deliverQueued(TENANT, queuedId, "es", emptyParams));
        assertTrue(sentFrom.isEmpty());
    }

    @Test
    void queuedPermissionSendRefusesASenderChangedAfterAdmission() {
        connections.put(PLATFORM, connection("platform", "PLATFORM-PNID"));
        connections.put(TENANT, connection("own", "ORG-PNID"));
        var expected = service.sendingNumber(TENANT, DRIVER);
        Message queued = service.queueInContext(TENANT, message());
        accounts.own(TENANT, "whatsapp");
        String queuedId = queued.id();
        Map<String, String> emptyParams = Map.of();
        assertThrows(SendFailure.class,
                () -> service.deliverQueued(TENANT, queuedId, "es", emptyParams, expected));
        assertTrue(sentFrom.isEmpty());
        assertEquals(MessageStatus.PENDING, store.messageRepository.findById(queued.id()).status());
    }

    @Test
    void manualPermissionMessageStoresItsRenderedBody() {
        connections.put(PLATFORM, connection("platform", "PLATFORM-PNID"));
        var expected = service.sendingNumber(TENANT, DRIVER);
        String id = service.sendCallPermission(TENANT, expected, DRIVER, "miot_call_permission_request", "es",
                Map.of("nombre", "Ana"));
        Message message = store.messages.stream().filter(m -> id.equals(m.providerMessageId())).findFirst().orElseThrow();
        assertTrue(message.body().contains("Hola Ana"));
        assertTrue(message.body().contains("¿Nos das permiso?"));
    }

    @Test
    @SuppressWarnings("unchecked")
    void renamedPermissionTemplatesStillCannotUseTheGenericSendRoute() {
        var template = new ConvTemplate("t", PLATFORM,
                "miot_call_permission_request", "Permission", "Hello", new ConvTemplate.WhatsApp(
                "renamed_permission", "es", List.of("nombre"), true), null, null, null, null, "0.1.0");
        var templates = new TemplateStore() {
            @Override public List<ConvTemplate> list(String tenant) {
                return List.of(template);
            }
            @Override public Optional<ConvTemplate> find(String tenant, String key) {
                return Optional.of(template);
            }
            @Override public Optional<ConvTemplate> upsert(
                    ConvTemplate value, String version) {
                return Optional.of(value);
            }
        };
        Instance<TemplateStore> instance =
                (Instance<TemplateStore>)
                Proxy.newProxyInstance(Instance.class.getClassLoader(),
                        new Class<?>[]{Instance.class}, (proxy, method, args) -> switch (method.getName()) {
                            case "get" -> templates;
                            case "isResolvable" -> true;
                            default -> throw new UnsupportedOperationException(method.getName());
                        });
        var guarded = new WhatsAppMessagingService(new FakeResolver(), new FakeMeta(), store.conversationRepository,
                store.messageRepository, accounts.service, instance);
        var request = new SendWhatsAppMessageRequest(DRIVER, "TEMPLATE", null, "renamed_permission", "es",
                Map.of("nombre", "Ana"), null, null, null, null, null);
        assertThrows(IllegalArgumentException.class, () -> guarded.send(TENANT, request, "operator"));
        assertTrue(sentFrom.isEmpty());
    }

}
