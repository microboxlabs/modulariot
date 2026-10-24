package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.integrations.service.InboundChannelRef;
import com.microboxlabs.miot.integrations.service.IntegrationConnectionResolver;
import java.nio.charset.StandardCharsets;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.junit.jupiter.api.Test;

/** Messages on the platform's number reach the organization whose message they answer. Placeholder ids. */
class PlatformInboundRoutingTest {

    private static final String PLATFORM = WhatsAppMessagingService.PLATFORM_TENANT;
    private static final String ORG_A = "tenant-a";
    private static final String ORG_B = "tenant-b";
    private static final String DRIVER = "+56900000001";
    private static final String DRIVER_DIGITS = "56900000001";
    private static final String OTHER = "+56900000002";
    private static final String PLATFORM_PNID = "PLATFORM-PNID";
    private static final String ORG_PNID = "ORG-PNID";

    private final InMemoryConversations store = new InMemoryConversations();
    private final RecordingReplyEvent replies = new RecordingReplyEvent();
    private final WhatsAppInboundService service = new WhatsAppInboundService(
            new FakeResolver(), store.conversationRepository, store.messageRepository, replies);

    @Test
    void aQuoteGoesToTheQuotedMessagesOrganizationAndRun() {
        Conversation a = conversation("a", ORG_A, DRIVER);
        conversation("b", ORG_B, DRIVER);
        Message sent = sent(a, "wamid.A1", DRIVER, MessageStatus.SENT, "00000000-0000-0000-0000-0000000000a1", 2);
        sent(conversationId("b"), "wamid.B1", DRIVER, MessageStatus.SENT, null, null);

        ingest(PLATFORM_PNID, "wamid.IN1", "\"type\":\"text\",\"text\":{\"body\":\"si\"},"
                + "\"context\":{\"id\":\"wamid.A1\"}");

        Message stored = inbound("wamid.IN1");
        assertEquals(a.id(), stored.conversationId());
        assertEquals(sent.id(), stored.inReplyTo());
        ConversationReplyReceived event = replies.fired.get(0);
        assertEquals(ORG_A, event.tenantCode());
        assertEquals(a.id(), event.conversationId());
        assertEquals("00000000-0000-0000-0000-0000000000a1", event.runId());
        assertEquals(2, event.answeredStep());
    }

    @Test
    void aQuickReplyTapGoesByItsContext() {
        Conversation a = conversation("a", ORG_A, DRIVER);
        Conversation b = conversation("b", ORG_B, DRIVER);
        Message toA = sent(a, "wamid.A1", DRIVER, MessageStatus.SENT, null, null);
        sent(b, "wamid.B1", DRIVER, MessageStatus.SENT, null, null);

        ingest(PLATFORM_PNID, "wamid.IN2", "\"type\":\"button\",\"button\":{\"payload\":\"Estoy bien\","
                + "\"text\":\"Estoy bien\"},\"context\":{\"id\":\"wamid.A1\"}");

        assertEquals(a.id(), inbound("wamid.IN2").conversationId());
        assertEquals(toA.id(), inbound("wamid.IN2").inReplyTo());
        assertEquals(ORG_A, replies.fired.get(0).tenantCode());
        assertEquals("Estoy bien", replies.fired.get(0).buttonPayload());
    }

    @Test
    void aQuoteOfAMessageToAnotherPhoneIsNotFollowed() {
        Conversation others = conversation("b", ORG_B, OTHER);
        sent(others, "wamid.B9", OTHER, MessageStatus.SENT, null, null);

        ingest(PLATFORM_PNID, "wamid.IN3", "\"type\":\"text\",\"text\":{\"body\":\"hola\"},"
                + "\"context\":{\"id\":\"wamid.B9\"}");

        Message stored = inbound("wamid.IN3");
        assertEquals(PLATFORM, store.conversations.get(stored.conversationId()).tenantCode());
        assertNull(stored.inReplyTo());
        assertEquals(PLATFORM, replies.fired.get(0).tenantCode());
    }

    @Test
    void aQuoteOfAMessageFromAnOrganizationsOwnNumberIsNotFollowed() {
        Conversation b = conversation("b", ORG_B, DRIVER);
        store.messageRepository.append(message(b.id(), "wamid.OWN", DRIVER, MessageStatus.SENT, null, null,
                Map.of("connectionId", "conn-b")));

        ingest(PLATFORM_PNID, "wamid.IN4", "\"type\":\"text\",\"text\":{\"body\":\"hola\"},"
                + "\"context\":{\"id\":\"wamid.OWN\"}");

        assertEquals(PLATFORM, replies.fired.get(0).tenantCode());
    }

    @Test
    void freeTextGoesToTheNewestMessageWhoseRunWaits() {
        String run = "00000000-0000-0000-0000-0000000000a1";
        Conversation a = conversation("a", ORG_A, DRIVER);
        Conversation b = conversation("b", ORG_B, DRIVER);
        sent(a, "wamid.A1", DRIVER, MessageStatus.SENT, run, 0);
        sent(b, "wamid.B1", DRIVER, MessageStatus.DELIVERED, null, null);
        store.waitingRuns.add(run);

        ingest(PLATFORM_PNID, "wamid.IN5", "\"type\":\"text\",\"text\":{\"body\":\"estoy bien\"}");

        Message stored = inbound("wamid.IN5");
        assertEquals(a.id(), stored.conversationId());
        assertEquals(run, stored.runId());
        assertEquals(ORG_A, replies.fired.get(0).tenantCode());
        assertEquals(run, replies.fired.get(0).runId());
        assertNull(replies.fired.get(0).inReplyTo());
    }

    @Test
    void withoutAWaitingRunFreeTextGoesToTheNewestMessage() {
        Conversation a = conversation("a", ORG_A, DRIVER);
        Conversation b = conversation("b", ORG_B, DRIVER);
        sent(a, "wamid.A1", DRIVER, MessageStatus.SENT, "00000000-0000-0000-0000-0000000000a1", 0);
        sent(b, "wamid.B1", DRIVER, MessageStatus.READ, null, null);
        sent(a, "wamid.A2", DRIVER, MessageStatus.FAILED, null, null);

        ingest(PLATFORM_PNID, "wamid.IN6", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}");

        Message stored = inbound("wamid.IN6");
        assertEquals(b.id(), stored.conversationId());
        assertNull(stored.runId());
        assertEquals(ORG_B, replies.fired.get(0).tenantCode());
    }

    @Test
    void freeTextFromAPhoneWeNeverWroteStaysWithThePlatform() {
        Conversation a = conversation("a", ORG_A, DRIVER);
        sent(a, "wamid.A1", DRIVER, MessageStatus.SIMULATED, null, null);

        ingest(PLATFORM_PNID, "wamid.IN7", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}");
        ingest(PLATFORM_PNID, "wamid.IN8", "\"type\":\"text\",\"text\":{\"body\":\"hola?\"}");

        Message first = inbound("wamid.IN7");
        Conversation kept = store.conversations.get(first.conversationId());
        assertEquals(PLATFORM, kept.tenantCode());
        assertNull(kept.contextKind());
        assertEquals(kept.id(), inbound("wamid.IN8").conversationId());
        assertEquals(2, kept.unreadCount());
    }

    @Test
    void anOrganizationsOwnNumberIgnoresPlatformRouting() {
        Conversation a = conversation("a", ORG_A, DRIVER);
        sent(a, "wamid.A1", DRIVER, MessageStatus.SENT, null, null);

        ingest(ORG_PNID, "wamid.IN9", "\"type\":\"text\",\"text\":{\"body\":\"hola\"},"
                + "\"context\":{\"id\":\"wamid.A1\"}");

        Message stored = inbound("wamid.IN9");
        assertEquals(ORG_B, store.conversations.get(stored.conversationId()).tenantCode());
        assertEquals(ORG_B, replies.fired.get(0).tenantCode());
    }

    @Test
    void aMessageOnTheOrganizationsOwnNumberDoesNotResumeARunSentFromThePlatform() {
        String run = "00000000-0000-0000-0000-0000000000b1";
        Conversation b = conversation("b", ORG_B, DRIVER);
        sent(b, "wamid.B1", DRIVER, MessageStatus.SENT, run, 0);
        store.waitingRuns.add(run);

        ingest(ORG_PNID, "wamid.IN10", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}");

        assertNull(inbound("wamid.IN10").runId());
        assertNull(replies.fired.get(0).runId());
    }

    @Test
    void aStatusOnThePlatformNumberUpdatesTheMessageOfAnyOrganization() {
        Message sent = sent(conversation("a", ORG_A, DRIVER), "wamid.A1", DRIVER, MessageStatus.SENT, null, null);

        service.ingest("""
                {"entry":[{"changes":[{"value":{"metadata":{"phone_number_id":"PLATFORM-PNID"},
                "statuses":[{"id":"wamid.A1","status":"delivered","timestamp":"1719792000",
                "recipient_id":"56900000001"}]}}]}]}
                """.getBytes(StandardCharsets.UTF_8));

        assertEquals(List.of(sent.id()), store.statusMarked);
    }

    private Conversation conversation(String suffix, String tenant, String address) {
        return store.put(InMemoryConversations.conversation(conversationId(suffix), tenant, address,
                ContextKind.SYMPTOM_CASE, "-7", at(0)));
    }

    private static String conversationId(String suffix) {
        return "00000000-0000-0000-0000-00000000000" + suffix;
    }

    private Message sent(Conversation conversation, String wamid, String address, MessageStatus status, String run,
            Integer step) {
        return sent(conversation.id(), wamid, address, status, run, step);
    }

    private Message sent(String conversationId, String wamid, String address, MessageStatus status, String run,
            Integer step) {
        return store.messageRepository.append(message(conversationId, wamid, address, status, run, step,
                Map.of("connectionId", "conn-platform", "connectionTenant", PLATFORM)));
    }

    private Message message(String conversationId, String wamid, String address, MessageStatus status, String run,
            Integer step, Map<String, Object> metadata) {
        return new Message("00000000-0000-0000-0000-0000000000f" + store.messages.size(), conversationId,
                MessageDirection.OUTBOUND, MessageRole.SYSTEM, MessageType.TEMPLATE, "¿Estás bien?", "panic", null,
                null, null, wamid, status, null, null, null, null, metadata, at(0), null, null,
                at(store.messages.size()), Channel.WHATSAPP, address, null, run, step);
    }

    private void ingest(String phoneNumberId, String wamid, String messageFields) {
        service.ingest("""
                {"entry":[{"changes":[{"value":{
                "metadata":{"phone_number_id":"%s"},
                "contacts":[{"profile":{"name":"Conductor"},"wa_id":"%s"}],
                "messages":[{"from":"%s","id":"%s","timestamp":"1719792000",%s}]}}]}]}
                """.formatted(phoneNumberId, DRIVER_DIGITS, DRIVER_DIGITS, wamid, messageFields)
                .getBytes(StandardCharsets.UTF_8));
    }

    private Message inbound(String wamid) {
        return store.messageRepository.findByProviderMessageId(Channel.WHATSAPP, wamid);
    }

    private static OffsetDateTime at(int minute) {
        return OffsetDateTime.parse("2024-06-30T12:00:00Z").plusMinutes(minute);
    }

    /** The platform's number belongs to _platform; the other one to organization B. */
    private static final class FakeResolver extends IntegrationConnectionResolver {
        FakeResolver() {
            super(null, null, null);
        }

        @Override
        public Optional<InboundChannelRef> resolveByWhatsAppPhoneNumberId(String phoneNumberId) {
            return Optional.of(PLATFORM_PNID.equals(phoneNumberId)
                    ? new InboundChannelRef(PLATFORM, "conn-platform")
                    : new InboundChannelRef(ORG_B, "conn-b"));
        }
    }
}
