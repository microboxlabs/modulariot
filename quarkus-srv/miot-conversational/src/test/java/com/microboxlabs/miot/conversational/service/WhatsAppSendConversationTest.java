package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.conversational.accounts.InMemoryChannelAccounts;
import com.microboxlabs.miot.conversational.client.MetaWhatsAppClient;
import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.dto.SendWhatsAppMessageRequest;
import com.microboxlabs.miot.integrations.domain.ProviderType;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import com.microboxlabs.miot.integrations.service.ResolvedConnection;
import java.net.URI;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Which conversation a send lands on. Placeholder phone numbers only. */
class WhatsAppSendConversationTest {

    private static final String TENANT = "tenant-1";
    private static final String DRIVER = "+56900000001";
    private static final String CARRIER = "+56900000002";

    private final InMemoryConversations store = new InMemoryConversations();
    private final WhatsAppMessagingService service = new WhatsAppMessagingService(
            new FakeResolver(), new FakeMeta(), store.conversationRepository, store.messageRepository,
            new InMemoryChannelAccounts().service);

    @Test
    void twoPeopleAboutOneServiceGetTwoConversations() {
        Message toDriver = service.send(TENANT, text(DRIVER, "SVC-1"), "user-1");
        Message toCarrier = service.send(TENANT, text(CARRIER, "SVC-1"), "user-1");

        assertNotEquals(toDriver.conversationId(), toCarrier.conversationId());
        Conversation driver = store.conversations.get(toDriver.conversationId());
        assertEquals(ContextKind.SERVICE, driver.contextKind());
        assertEquals("SVC-1", driver.contextKey());
        assertEquals("SVC-1", driver.contextServiceCode());
        assertEquals(DRIVER, driver.participantAddress());
        assertEquals(CARRIER, store.conversations.get(toCarrier.conversationId()).participantAddress());
    }

    @Test
    void sameServiceAndRecipientReusesTheConversation() {
        Message first = service.send(TENANT, text(DRIVER, "SVC-1"), "user-1");
        Message second = service.send(TENANT, text(DRIVER, "SVC-1"), "user-1");
        Message otherService = service.send(TENANT, text(DRIVER, "SVC-2"), "user-1");

        assertEquals(first.conversationId(), second.conversationId());
        assertNotEquals(first.conversationId(), otherService.conversationId());
    }

    @Test
    void aServiceSendAdoptsTheOpenConversationWithoutContext() {
        Message adHoc = service.send(TENANT, text(DRIVER, null), "user-1");
        assertNull(store.conversations.get(adHoc.conversationId()).contextKind());

        Message trip = service.send(TENANT, text(DRIVER, "SVC-1"), "user-1");

        assertEquals(adHoc.conversationId(), trip.conversationId());
        Conversation adopted = store.conversations.get(trip.conversationId());
        assertEquals(ContextKind.SERVICE, adopted.contextKind());
        assertEquals("SVC-1", adopted.contextKey());
    }

    @Test
    void aSendWithoutServiceStaysOffTheServiceConversation() {
        Message trip = service.send(TENANT, text(DRIVER, "SVC-1"), "user-1");
        Message notice = service.send(TENANT, text(DRIVER, null), "job-failure-notifier");

        assertNotEquals(trip.conversationId(), notice.conversationId());
        assertNull(store.conversations.get(notice.conversationId()).contextKind());
    }

    @Test
    void theStoredMessageCarriesChannelAndAddress() {
        Message sent = service.send(TENANT, text(DRIVER, "SVC-1"), "user-1");

        assertEquals(Channel.WHATSAPP, sent.channel());
        assertEquals(DRIVER, sent.address());
        assertEquals("wamid.out-1", sent.providerMessageId());
    }

    private static SendWhatsAppMessageRequest text(String to, String serviceCode) {
        return new SendWhatsAppMessageRequest(
                to, "TEXT", "hola", null, null, Map.of(), null, null, serviceCode, null, null);
    }

    private static final class FakeResolver extends IntegrationConnectionResolver {
        FakeResolver() {
            super(null, null, null);
        }

        @Override
        public ResolvedConnection resolve(String tenantCode, ProviderType providerType) {
            return new ResolvedConnection("conn-1", URI.create("https://graph.example.test"),
                    Map.of("phone_number_id", "PNID"), Map.of("token", "test-token"));
        }
    }

    private static final class FakeMeta extends MetaWhatsAppClient {
        private int sent;

        @Override
        public String sendText(URI baseUrl, String phoneNumberId, String token, String toE164, String body) {
            sent++;
            return "wamid.out-" + sent;
        }
    }
}
