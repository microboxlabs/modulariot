package com.microboxlabs.miot.conversational.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

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

/** Inbound attachment order and the reply event. Placeholder phone numbers only. */
class WhatsAppInboundAttachmentTest {

    private static final String TENANT = "tenant-1";
    private static final String DRIVER = "+56900000001";
    private static final String DRIVER_DIGITS = "56900000001";
    private static final String OTHER = "+56900000002";

    private final InMemoryConversations store = new InMemoryConversations();
    private final RecordingReplyEvent replies = new RecordingReplyEvent();
    private final WhatsAppInboundService service = new WhatsAppInboundService(
            new FakeResolver(), store.conversationRepository, store.messageRepository, replies);

    @Test
    void aReplyNamingTheAnsweredMessageGoesToItsConversation() {
        Conversation older = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000a", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000b", TENANT, DRIVER, ContextKind.SERVICE, "SVC-2", at(10)));
        Message outbound = outbound(older.id(), "wamid.OUT1", DRIVER);

        ingest(webhook("wamid.IN1", "\"type\":\"text\",\"text\":{\"body\":\"si\"},"
                + "\"context\":{\"from\":\"15550000000\",\"id\":\"wamid.OUT1\"}"));

        Message stored = inbound("wamid.IN1");
        assertEquals(older.id(), stored.conversationId());
        assertEquals(outbound.id(), stored.inReplyTo());
        assertEquals(Channel.WHATSAPP, stored.channel());
        assertEquals(DRIVER, stored.address());
    }

    @Test
    void aButtonPayloadCarryingTheOutboundIdGoesToItsConversation() {
        Conversation older = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000a", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000b", TENANT, DRIVER, null, null, at(10)));
        Message outbound = outbound(older.id(), "wamid.OUT1", DRIVER);

        ingest(webhook("wamid.IN2", "\"type\":\"button\","
                + "\"button\":{\"payload\":\"" + outbound.id() + "\",\"text\":\"Confirmo\"}"));

        Message stored = inbound("wamid.IN2");
        assertEquals(older.id(), stored.conversationId());
        assertEquals(outbound.id(), stored.inReplyTo());
        assertEquals("Confirmo", stored.body());
        assertEquals(MessageType.TEXT, stored.type());
        assertEquals(outbound.id(), stored.metadata().get("buttonPayload"));
    }

    @Test
    void aMessageStoredTwiceComesBackAsADuplicateWithItsReply() {
        Conversation mine = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000e", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        InboundMessage message = MetaWebhookParser.parse(webhook("wamid.IN7",
                "\"type\":\"text\",\"text\":{\"body\":\"listo\"}").getBytes(StandardCharsets.UTF_8))
                .messages().get(0);

        WhatsAppInboundService.Ingested first = service.ingestMessage(message);
        WhatsAppInboundService.Ingested again = service.ingestMessage(message);

        assertFalse(first.duplicate());
        assertTrue(again.duplicate());
        assertEquals(mine.id(), again.reply().conversationId());
        assertEquals(first.reply().messageId(), again.reply().messageId());
        assertEquals(TENANT, again.reply().tenantCode());
        assertTrue(replies.fired.isEmpty(), "the caller hands the reply on");
    }

    @Test
    void aDuplicateIdFromAnotherTenantDoesNotReturnItsReply() {
        Conversation foreign = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000f", "tenant-2", DRIVER,
                ContextKind.SERVICE, "SVC-2", at(0)));
        store.messageRepository.append(new Message(
                "00000000-0000-0000-0000-0000000000f1", foreign.id(),
                MessageDirection.INBOUND, MessageRole.DRIVER, MessageType.TEXT, "reply", null,
                null, null, null, "wamid.FOREIGN", MessageStatus.RECEIVED, null, null, null, null,
                Map.of(), null, null, null, at(0), Channel.WHATSAPP, DRIVER, null, "run-2", null));
        InboundMessage forged = MetaWebhookParser.parse(webhook("wamid.FOREIGN",
                "\"type\":\"text\",\"text\":{\"body\":\"forged\"}")
                .getBytes(StandardCharsets.UTF_8)).messages().get(0);

        WhatsAppInboundService.Ingested result = service.ingestMessage(forged);

        assertNull(result.reply());
        assertTrue(result.skipped().contains("another organization"));
    }

    @Test
    void anOutboundIdCannotBeTreatedAsAnInboundDuplicate() {
        Conversation mine = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000e", TENANT, DRIVER,
                ContextKind.SERVICE, "SVC-1", at(0)));
        outbound(mine.id(), "wamid.OUTBOUND", DRIVER);
        InboundMessage forged = MetaWebhookParser.parse(webhook("wamid.OUTBOUND",
                "\"type\":\"text\",\"text\":{\"body\":\"forged\"}")
                .getBytes(StandardCharsets.UTF_8)).messages().get(0);

        WhatsAppInboundService.Ingested result = service.ingestMessage(forged);

        assertNull(result.reply());
        assertTrue(result.skipped().contains("outbound message"));
    }

    @Test
    void aDuplicateKeepsTheStepOfTheMessageItAnswers() {
        Conversation mine = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000e", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        store.messageRepository.append(new Message(
                "00000000-0000-0000-0000-0000000000f9", mine.id(), MessageDirection.OUTBOUND, MessageRole.SYSTEM,
                MessageType.TEMPLATE, "¿Estás bien?", "check", null, null, null, "wamid.OUT9", MessageStatus.SENT,
                null, null, null, null, Map.of(), at(0), null, null, at(0), Channel.WHATSAPP, DRIVER, null,
                "run-1", 0));
        InboundMessage message = MetaWebhookParser.parse(webhook("wamid.IN9", "\"type\":\"text\",\"text\":"
                + "{\"body\":\"si\"},\"context\":{\"from\":\"15550000000\",\"id\":\"wamid.OUT9\"}")
                .getBytes(StandardCharsets.UTF_8)).messages().get(0);

        WhatsAppInboundService.Ingested first = service.ingestMessage(message);
        WhatsAppInboundService.Ingested again = service.ingestMessage(message);

        assertEquals(0, first.reply().answeredStep());
        assertEquals(0, again.reply().answeredStep());
        assertEquals("run-1", again.reply().runId());
    }

    @Test
    void anAnsweredMessageOfAnotherAddressIsIgnored() {
        Conversation others = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000c", TENANT, OTHER, ContextKind.SERVICE, "SVC-1", at(0)));
        Conversation mine = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000d", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        outbound(others.id(), "wamid.OUT9", OTHER);

        ingest(webhook("wamid.IN3", "\"type\":\"text\",\"text\":{\"body\":\"hola\"},"
                + "\"context\":{\"id\":\"wamid.OUT9\"}"));

        Message stored = inbound("wamid.IN3");
        assertEquals(mine.id(), stored.conversationId());
        assertNull(stored.inReplyTo());
    }

    @Test
    void withoutAReferenceTheConversationOfAWaitingRunWins() {
        String run = "00000000-0000-0000-0000-0000000000a1";
        Conversation symptomCase = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000a", TENANT, DRIVER, ContextKind.SYMPTOM_CASE, "-7", at(0)));
        store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000b", TENANT, DRIVER, ContextKind.SERVICE, "SVC-2", at(10)));
        store.messageRepository.append(new Message("00000000-0000-0000-0000-0000000000e1", symptomCase.id(),
                MessageDirection.OUTBOUND, MessageRole.SYSTEM, MessageType.TEMPLATE, "¿Estás bien?", null, null, null,
                null, "wamid.RUN1", MessageStatus.SENT, null, null, null, null, Map.of(), at(0), null, null, at(0),
                Channel.WHATSAPP, DRIVER, null, run, 0));
        store.waitingRuns.add(run);

        ingest(webhook("wamid.IN9", "\"type\":\"text\",\"text\":{\"body\":\"estoy bien\"}"));

        Message stored = inbound("wamid.IN9");
        assertEquals(symptomCase.id(), stored.conversationId());
        assertEquals(run, stored.runId());
        assertEquals(run, replies.fired.get(0).runId());

        store.waitingRuns.remove(run);
        ingest(webhook("wamid.IN10", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}"));
        assertNull(inbound("wamid.IN10").runId());
    }

    @Test
    void withoutAReferenceTheNewestOpenConversationWins() {
        store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000a", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        Conversation newest = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000b", TENANT, DRIVER, ContextKind.SERVICE, "SVC-2", at(10)));

        ingest(webhook("wamid.IN4", "\"type\":\"text\",\"text\":{\"body\":\"llegue\"}"));

        assertEquals(newest.id(), inbound("wamid.IN4").conversationId());
    }

    @Test
    void aFirstMessageOpensAConversationWithoutContext() {
        ingest(webhook("wamid.IN5", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}"));

        List<Conversation> created = store.forAddress(DRIVER);
        assertEquals(1, created.size());
        Conversation conversation = created.get(0);
        assertNull(conversation.contextKind());
        assertNull(conversation.contextKey());
        assertEquals(DRIVER, conversation.phoneE164());
        assertEquals("Conductor", conversation.displayName());
        assertEquals(1, conversation.unreadCount());
    }

    @Test
    void aStoredReplyPublishesReplyReceived() {
        Conversation conversation = store.put(InMemoryConversations.conversation(
                "00000000-0000-0000-0000-00000000000a", TENANT, DRIVER, ContextKind.SERVICE, "SVC-1", at(0)));
        Message outbound = outbound(conversation.id(), "wamid.OUT1", DRIVER);

        ingest(webhook("wamid.IN6", "\"type\":\"interactive\",\"interactive\":{\"type\":\"button_reply\","
                + "\"button_reply\":{\"id\":\"ok\",\"title\":\"Recibido\"}},\"context\":{\"id\":\"wamid.OUT1\"}"));

        assertEquals(1, replies.fired.size());
        ConversationReplyReceived event = replies.fired.get(0);
        Message stored = inbound("wamid.IN6");
        assertEquals(TENANT, event.tenantCode());
        assertEquals(conversation.id(), event.conversationId());
        assertEquals(stored.id(), event.messageId());
        assertEquals(outbound.id(), event.inReplyTo());
        assertNull(event.runId());
        assertEquals(Channel.WHATSAPP, event.channel());
        assertEquals(DRIVER, event.address());
        assertEquals("Recibido", event.text());
        assertEquals("ok", event.buttonPayload());
        assertEquals(OffsetDateTime.parse("2024-07-01T00:00:00Z").toInstant(), event.at().toInstant());
    }

    @Test
    void aRedeliveryPublishesNothing() {
        String body = webhook("wamid.IN7", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}");
        ingest(body);
        ingest(body);

        assertEquals(1, replies.fired.size());
        assertEquals(1, store.messages.size());
    }

    @Test
    void aRedeliveryAfterAFailedWriteStoresTouchesAndPublishes() {
        String body = webhook("wamid.IN9", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}");
        store.messageRepository.failNextInbound = new IllegalStateException("database down");

        assertThrows(IllegalStateException.class, () -> ingest(body));
        assertTrue(store.messages.isEmpty());
        assertTrue(replies.fired.isEmpty());

        ingest(body);

        Message stored = inbound("wamid.IN9");
        assertEquals(1, store.messages.size());
        assertEquals(1, store.conversations.get(stored.conversationId()).unreadCount());
        assertEquals(1, replies.fired.size());
        assertEquals(stored.id(), replies.fired.get(0).messageId());
    }

    @Test
    void anObserverFailureDoesNotFailIngestion() {
        replies.failWith = new IllegalStateException("observer down");

        ingest(webhook("wamid.IN8", "\"type\":\"text\",\"text\":{\"body\":\"hola\"}"));

        assertTrue(store.messages.stream().anyMatch(m -> "wamid.IN8".equals(m.providerMessageId())));
    }

    private Message outbound(String conversationId, String wamid, String address) {
        Message message = new Message(
                "00000000-0000-0000-0000-0000000000f" + store.messages.size(), conversationId,
                MessageDirection.OUTBOUND, MessageRole.AGENT, MessageType.TEXT, "¿Llegaste?", null,
                null, null, null, wamid, MessageStatus.SENT, null, "user-1", null, null, Map.of(),
                at(0), null, null, at(0), Channel.WHATSAPP, address, null, null, null);
        return store.messageRepository.append(message);
    }

    private void ingest(String body) {
        service.ingest(body.getBytes(StandardCharsets.UTF_8));
    }

    private Message inbound(String wamid) {
        return store.messageRepository.findByProviderMessageId(Channel.WHATSAPP, wamid);
    }

    private static String webhook(String wamid, String messageFields) {
        return """
                {"entry":[{"changes":[{"value":{
                "metadata":{"phone_number_id":"PNID"},
                "contacts":[{"profile":{"name":"Conductor"},"wa_id":"%s"}],
                "messages":[{"from":"%s","id":"%s","timestamp":"1719792000",%s}]}}]}]}
                """.formatted(DRIVER_DIGITS, DRIVER_DIGITS, wamid, messageFields);
    }

    private static OffsetDateTime at(int minute) {
        return OffsetDateTime.parse("2024-06-30T12:00:00Z").plusMinutes(minute);
    }

    private static final class FakeResolver extends IntegrationConnectionResolver {
        FakeResolver() {
            super(null, null, null);
        }

        @Override
        public Optional<InboundChannelRef> resolveByWhatsAppPhoneNumberId(String phoneNumberId) {
            return Optional.of(new InboundChannelRef(TENANT, "conn-1"));
        }
    }
}
