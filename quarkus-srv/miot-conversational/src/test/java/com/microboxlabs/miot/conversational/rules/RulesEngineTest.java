package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.DRIVER;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.PANIC_SPEC;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.event;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.panic;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.ContextKind;
import com.microboxlabs.miot.conversational.domain.Conversation;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** Which rules an event starts, how runs step through sends and waits, and what stops them. */
class RulesEngineTest {

    private final RulesFixture f = new RulesFixture();

    private Run onlyRun() {
        assertEquals(1, f.store.runs.size());
        return f.store.runs.values().iterator().next();
    }

    private void at(Duration later) {
        f.now = T0.plus(later);
    }

    @Test
    void anEventStartsTheRulesWhoseTypeAndConditionMatch() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);

        assertTrue(f.engine.accept(event("symptom.case.opened", "-1", panic(3), false)).isEmpty());
        assertTrue(f.engine.accept(event("symptom.case.closed", "-1", panic(4), false)).isEmpty());
        assertTrue(f.engine.accept(event("symptom.case.opened", "-1",
                new RulesFixture.CaseData("speeding", "Exceso", 4, "ABCD12", null, null, null, false), false))
                .isEmpty());
        List<Run> started = f.engine.accept(event("symptom.case.opened", "-2", panic(4), false));

        assertEquals(1, started.size());
        Run run = started.get(0);
        assertEquals(Run.Status.WAITING, run.status());
        assertEquals(0, run.step());
        assertEquals(T0, run.nextAt());
        assertEquals("symptom_case", run.contextKind());
        assertEquals("-2", run.contextKey());
        assertEquals("0.1.0", run.ruleVersion());
        assertFalse(run.test());
        assertEquals(4, f.store.events.size(), "every event is stored");
    }

    @Test
    void offRulesAndUnpublishedDraftsStartNothing() {
        Rule rule = f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        f.service.setState(TENANT, rule.id(), Rule.State.OFF);

        assertTrue(f.engine.accept(event("symptom.case.opened", "-1", panic(4), false)).isEmpty());
    }

    @Test
    void aTestEventStartsOnlyTestRules() {
        f.rule("active", PANIC_SPEC, Rule.State.ACTIVE);
        Rule test = f.rule("test", PANIC_SPEC, Rule.State.TEST);

        List<Run> fromTest = f.engine.accept(event("symptom.case.opened", "-1", panic(4), true));
        assertEquals(1, fromTest.size());
        assertEquals(test.id(), fromTest.get(0).ruleId());
        assertTrue(fromTest.get(0).test());

        List<Run> fromReal = f.engine.accept(event("symptom.case.opened", "-2", panic(4), false));
        assertEquals(2, fromReal.size());
        assertEquals(Map.of(true, 1L, false, 1L), Map.of(
                true, fromReal.stream().filter(Run::test).count(),
                false, fromReal.stream().filter(r -> !r.test()).count()));
    }

    @Test
    void theFirstStepSendsTheTemplateOnTheCaseConversation() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));

        assertEquals(1, f.engine.runDue());
        assertEquals(1, f.whatsappSent.size());
        RulesFixture.Sent sent = f.whatsappSent.get(0);
        assertEquals(DRIVER, sent.to());
        assertEquals("miot_panic_check_v1", sent.template());
        assertEquals("es_CL", sent.language());
        assertEquals(Map.of("nombre", "Ana", "patente", "ABCD12", "hora", "12:04"), sent.params());
        assertEquals(List.of("nombre", "patente", "hora"), List.copyOf(sent.params().keySet()));

        Message m = f.store.conversations.messages.get(0);
        assertEquals(MessageStatus.SENT, m.status());
        assertEquals("Hola Ana, se activó el botón de pánico en ABCD12 a las 12:04. ¿Estás bien?", m.body());
        assertEquals(onlyRun().id(), m.runId());
        assertEquals(0, m.step());
        Conversation c = f.store.conversations.conversations.get(m.conversationId());
        assertEquals(ContextKind.SYMPTOM_CASE, c.contextKind());
        assertEquals("-7", c.contextKey());
        assertEquals(DRIVER, c.participantAddress());
        assertEquals("driver", c.participantRole());
    }

    @Test
    void theNextStepWaitsForTheReplyTime() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        Run afterFirst = onlyRun();
        assertEquals(Run.Status.WAITING, afterFirst.status());
        assertEquals(1, afterFirst.step());
        assertEquals(T0.plus(Duration.ofMinutes(5)), afterFirst.nextAt());

        at(Duration.ofMinutes(4));
        assertEquals(0, f.engine.runDue());

        at(Duration.ofMinutes(5));
        assertEquals(1, f.engine.runDue());
        assertEquals(1, f.emailsSent.size());
        assertEquals("Pánico en ABCD12 (Código negro)", f.emailsSent.get(0).subject());
        assertEquals("El conductor no respondió. Ubicación: -33.45679, -70.64827.", f.emailsSent.get(0).text());
        assertNull(f.emailsSent.get(0).replyTo());
        assertEquals(2, onlyRun().step());
        assertEquals(T0.plus(Duration.ofMinutes(15)), onlyRun().nextAt());

        at(Duration.ofMinutes(15));
        f.engine.runDue();
        assertEquals(Run.Status.DONE, onlyRun().status());
        assertNull(onlyRun().lastError());
        assertEquals(1, f.whatsappSent.size());
    }

    @Test
    void stepsWithoutWaitsGoOutInOneScan() {
        f.rule("burst", """
                {"trigger": {"event": "symptom.case.opened", "when": ""},
                 "audience": [{"role": "driver"}, {"role": "Jefe de torre"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"},
                           {"channel": "email", "template": "panic-tower",
                            "to": [{"address": "tower@example.com", "channel": "email"}]}]}
                """, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));

        f.engine.runDue();

        assertEquals(List.of(DRIVER, RulesFixture.LEAD), f.whatsappSent.stream().map(RulesFixture.Sent::to).toList());
        assertEquals(1, f.emailsSent.size());
        assertEquals(Run.Status.DONE, onlyRun().status());
    }

    @Test
    void eachStepWritesToTheGroupsItNames() {
        f.rule("groups", """
                {"trigger": {"event": "symptom.case.opened", "when": ""},
                 "groups": [{"id": "drivers", "name": "Conductores", "entries": [{"role": "driver"}]},
                            {"id": "tower", "name": "Torre",
                             "entries": [{"address": "tower@example.com", "channel": "email"}]}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "to": ["drivers"]},
                           {"channel": "email", "template": "panic-tower", "to": ["tower"]}]}
                """, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));

        f.engine.runDue();

        assertEquals(List.of(DRIVER), f.whatsappSent.stream().map(RulesFixture.Sent::to).toList());
        assertEquals(1, f.emailsSent.size());
        assertEquals(Run.Status.DONE, onlyRun().status());
    }

    @Test
    void aReplyToAStopStepEndsTheRun() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        Message sent = f.store.conversations.messages.get(0);

        at(Duration.ofMinutes(2));
        assertTrue(f.engine.replied(reply(sent.conversationId(), null)).isPresent());

        assertEquals(Run.Status.REPLIED, onlyRun().status());
        at(Duration.ofMinutes(5));
        assertEquals(0, f.engine.runDue());
        assertTrue(f.emailsSent.isEmpty());
    }

    @Test
    void aReplyNamingTheRunEndsIt() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        Run run = f.engine.accept(event("symptom.case.opened", "-7", panic(4), false)).get(0);
        f.engine.runDue();

        assertTrue(f.engine.replied(reply("unknown-conversation", run.id())).isPresent());
        assertEquals(Run.Status.REPLIED, onlyRun().status());
    }

    @Test
    void aReplyToAContinueStepLetsTheRunGoOn() {
        f.rule("panic", PANIC_SPEC.replace("\"waitForReply\": 5, \"onReply\": \"stop\"",
                "\"waitForReply\": 5, \"onReply\": \"continue\""), Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();

        assertTrue(f.engine.replied(reply(f.store.conversations.messages.get(0).conversationId(), null)).isEmpty());
        assertEquals(Run.Status.WAITING, onlyRun().status());
    }

    @Test
    void aReplyToAnEarlierStepFollowsThatStep() {
        f.rule("two", """
                {"trigger": {"event": "symptom.case.opened", "when": ""},
                 "audience": [{"role": "driver"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "waitForReply": 5,
                            "onReply": "continue"},
                           {"channel": "whatsapp", "template": "panic-check", "waitForReply": 5,
                            "onReply": "stop"}]}
                """, Rule.State.ACTIVE);
        Run run = f.engine.accept(event("symptom.case.opened", "-7", panic(4), false)).get(0);
        f.engine.runDue();
        at(Duration.ofMinutes(5));
        f.engine.runDue();
        assertEquals(2, onlyRun().step());
        String conversation = f.store.conversations.messages.get(0).conversationId();

        assertTrue(f.engine.replied(reply(conversation, run.id(), 0)).isEmpty(), "step 0 says continue");
        assertEquals(Run.Status.WAITING, onlyRun().status());
        assertTrue(f.engine.replied(reply(conversation, run.id(), 1)).isPresent(), "step 1 says stop");
        assertEquals(Run.Status.REPLIED, onlyRun().status());
    }

    @Test
    void aReplyNamingAFinishedRunStopsNoOtherRun() {
        f.rule("burst", """
                {"trigger": {"event": "symptom.case.opened", "when": ""},
                 "audience": [{"role": "driver"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """, Rule.State.ACTIVE);
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        List<Run> started = f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        Run done = f.store.runs.values().stream().filter(r -> r.status() == Run.Status.DONE).findFirst()
                .orElseThrow();
        String conversation = f.store.conversations.messages.get(0).conversationId();

        assertTrue(f.engine.replied(reply(conversation, done.id(), 0)).isEmpty());

        assertEquals(2, started.size());
        assertEquals(1, f.store.runs.values().stream().filter(r -> r.status() == Run.Status.WAITING).count());
    }

    @Test
    void aTestRunDoesNotTakeARealReply() {
        f.rule("panic", PANIC_SPEC, Rule.State.TEST);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        Message simulated = f.store.conversations.messages.get(0);
        assertEquals(MessageStatus.SIMULATED, simulated.status());

        assertTrue(f.engine.replied(reply(simulated.conversationId(), null)).isEmpty());
        assertEquals(Run.Status.WAITING, onlyRun().status());
    }

    @Test
    void aReplyBeforeTheFirstSendDoesNothing() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        Run run = f.engine.accept(event("symptom.case.opened", "-7", panic(4), false)).get(0);

        assertTrue(f.engine.replied(reply("c", run.id())).isEmpty());
        assertEquals(Run.Status.WAITING, onlyRun().status());
    }

    @Test
    void closingTheCaseCancelsItsWaitingRuns() {
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        Run same = f.engine.accept(event("symptom.case.opened", "-7", panic(4), false)).get(0);
        Run other = f.engine.accept(event("symptom.case.opened", "-8", panic(4), false)).get(0);
        f.engine.runDue();

        f.engine.accept(event("symptom.case.closed", "-7", panic(4), false));

        assertEquals(Run.Status.CANCELLED, f.store.runs.get(same.id()).status());
        assertEquals(Run.Status.WAITING, f.store.runs.get(other.id()).status());
        at(Duration.ofMinutes(5));
        f.engine.runDue();
        assertEquals(1, f.emailsSent.size(), "only the run of the open case escalates");
    }

    @Test
    void aTestRunRecordsSimulatedMessagesAndSendsNothing() {
        f.rule("panic", PANIC_SPEC, Rule.State.TEST);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));
        f.engine.runDue();
        at(Duration.ofMinutes(5));
        f.engine.runDue();

        assertTrue(f.whatsappSent.isEmpty());
        assertTrue(f.emailsSent.isEmpty());
        List<Message> messages = f.store.conversations.messages;
        assertEquals(2, messages.size());
        assertTrue(messages.stream().allMatch(m -> m.status() == MessageStatus.SIMULATED));
        assertEquals(Channel.EMAIL, messages.get(1).channel());
        assertEquals("tower@example.com", messages.get(1).address());
        assertEquals("Pánico en ABCD12 (Código negro)", messages.get(1).metadata().get("subject"));
    }

    @Test
    void aSendTheConnectionsTestModeRefusesIsStoredFailedAndTheRunGoesOn() {
        f.connectionMetadata.put("test_mode_enabled", true);
        f.connectionMetadata.put("test_recipients", "+56900000009");
        f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));

        f.engine.runDue();

        Message m = f.store.conversations.messages.get(0);
        assertEquals(MessageStatus.FAILED, m.status());
        assertTrue(m.errorMessage().contains("Test mode"));
        assertTrue(f.whatsappSent.isEmpty());
        Run run = onlyRun();
        assertEquals(Run.Status.WAITING, run.status());
        assertEquals(1, run.step());
        assertTrue(run.lastError().startsWith(DRIVER + ": Test mode"));
    }

    @Test
    void aRoleNobodyHasIsAWarningOnTheRun() {
        f.rule("carrier", """
                {"trigger": {"event": "symptom.case.opened"},
                 "audience": [{"role": "carrier"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """, Rule.State.ACTIVE);
        f.engine.accept(event("symptom.case.opened", "-7", panic(4), false));

        f.engine.runDue();

        Run run = onlyRun();
        assertEquals(Run.Status.DONE, run.status());
        assertTrue(run.lastError().contains("Nadie tiene el rol carrier"));
        assertTrue(f.store.conversations.messages.isEmpty());
    }

    private static ConversationReplyReceived reply(String conversationId, String runId) {
        return reply(conversationId, runId, null);
    }

    private static ConversationReplyReceived reply(String conversationId, String runId, Integer answeredStep) {
        return new ConversationReplyReceived(TENANT, conversationId, "m-1", null, runId, answeredStep,
                Channel.WHATSAPP, DRIVER, "Estoy bien", null,
                OffsetDateTime.of(2026, 10, 23, 15, 6, 0, 0, ZoneOffset.UTC));
    }
}
