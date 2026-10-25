package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageDirection;
import com.microboxlabs.miot.conversational.domain.MessageRole;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.domain.MessageType;
import com.microboxlabs.miot.conversational.events.ConversationEventCatalog;
import com.microboxlabs.miot.conversational.events.ConversationReplyData;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.events.ReplyEvents;
import com.microboxlabs.miot.core.event.OperationalEvent;
import java.time.Instant;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.concurrent.CompletableFuture;
import org.junit.jupiter.api.Test;

/** A reply to a rule's message goes back as an event in the context of the event that started the rule. */
class ReplyEventsTest {

    private static final String TENANT = "t1";
    private static final Instant AT = Instant.parse("2026-10-25T12:00:00Z");

    private final InMemoryRules world = new InMemoryRules();
    private final List<OperationalEvent> fired = new ArrayList<>();
    private final ReplyEvents replies = new ReplyEvents(world.runStore, e -> {
        fired.add(e);
        return CompletableFuture.completedFuture(null);
    });

    private Run run(String id, String contextKind, String contextKey) {
        world.runStore.saveEvent(new StoredEvent("e-" + id, TENANT, "trip.milestone.detected", "miot-trips",
                contextKind, contextKey, Map.of("milestone", "departure", "serviceCode", "SAMPLE-001"), false, AT,
                AT));
        return world.runStore.createRun(new Run(id, TENANT, "rule-1", "1", "e-" + id, contextKind, contextKey, false,
                Run.Status.REPLIED, 1, null, null, AT, AT));
    }

    private static ConversationReplyReceived reply(String runId, String payload) {
        return new ConversationReplyReceived(TENANT, "c-1", "m-9", "m-1", runId, 0, Channel.WHATSAPP,
                "+56900000000", "Confirmar", payload, OffsetDateTime.of(2026, 10, 25, 12, 5, 0, 0, ZoneOffset.UTC));
    }

    @Test
    void aReplyToARuleMessageIsPublishedInTheContextOfItsEvent() {
        run("r-1", "trip", "11111111-1111-1111-1111-111111111111");

        OperationalEvent e = replies.publish(reply("r-1", "confirm")).orElseThrow();

        assertEquals(ConversationEventCatalog.REPLY_RECEIVED, e.type());
        assertEquals("trip", e.context().kind());
        assertEquals("11111111-1111-1111-1111-111111111111", e.context().key());
        ConversationReplyData d = (ConversationReplyData) e.data();
        assertEquals("trip.milestone.detected", d.eventType());
        assertEquals("departure", d.eventData().get("milestone"));
        assertEquals("confirm", d.buttonPayload());
        assertEquals("whatsapp", d.channel());
        assertEquals("+56900000000", d.address());
        assertEquals(List.of(e), fired, "a run that already stopped waiting still passes its replies on");
    }

    @Test
    void aReplyOutsideARunOrWithoutAContextPublishesNothing() {
        run("r-2", null, null);
        assertTrue(replies.publish(reply("r-2", "confirm")).isEmpty());
        assertTrue(replies.publish(reply("missing", "confirm")).isEmpty());
        assertTrue(replies.publish(reply(null, null)).isEmpty());
        assertEquals(List.of(), fired);
    }

    @Test
    void synchronousWebhookDispatchPublishesTheReply() {
        run("r-3", "trip", "11111111-1111-1111-1111-111111111111");

        replies.onReplyInJob(reply("r-3", "confirm"));

        assertEquals(1, fired.size());
        assertEquals(ConversationEventCatalog.REPLY_RECEIVED, fired.getFirst().type());
    }

    @Test
    void manualReplyCannotBorrowAnotherWaitingRunInTheConversation() {
        world.runStore.saveEvent(new StoredEvent("e-waiting", TENANT, "trip.milestone.detected", "miot-trips",
                "trip", "11111111-1111-1111-1111-111111111111", Map.of("milestone", "departure"), false, AT, AT));
        world.runStore.createRun(new Run("r-waiting", TENANT, "rule-1", "1", "e-waiting", "trip",
                "11111111-1111-1111-1111-111111111111", false, Run.Status.WAITING, 1, null, null, AT, AT));
        world.conversations.messages.add(new Message("m-rule", "c-1", MessageDirection.OUTBOUND,
                MessageRole.AGENT, MessageType.TEXT, "Confirmar", null, null, null, null, "provider-1",
                MessageStatus.SENT, null, null, null, null, Map.of(), null, null, null, null,
                Channel.WHATSAPP, "+56900000000", null, "r-waiting", 1));

        assertTrue(replies.publish(reply(null, "confirm")).isEmpty());
        assertEquals(List.of(), fired);
    }
}
