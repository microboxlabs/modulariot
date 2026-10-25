package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.DRIVER;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.PANIC_SPEC;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.T0;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.domain.Channel;
import com.microboxlabs.miot.conversational.domain.Message;
import com.microboxlabs.miot.conversational.domain.MessageStatus;
import com.microboxlabs.miot.conversational.events.ConversationReplyReceived;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleContext;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** A rule's draft sent for real to one chosen person, at its steps' times. */
class RuleTestSendsTest {

    private static final String TESTER_EMAIL = "tester@example.com";
    private static final String TESTER_PHONE = "+56900000099";
    private static final TestSend.To TESTER = new TestSend.To(TESTER_EMAIL, TESTER_PHONE, "Tester");

    private final RulesFixture f = new RulesFixture();

    private String draft(String spec) {
        return f.service.create(TENANT, "panic", "Pánico", json(spec), "owner@example.com").rule().id();
    }

    private static SampleEvent sample() {
        return new SampleEvent("symptom.case.opened", new SampleContext("symptom_case", "-7"),
                Map.of("symptomKey", "panic-button", "level", 4, "assetId", "ABCD12"), false, null);
    }

    @Test
    void eachStepGoesToTheChosenPersonAtItsTime() {
        String id = draft(PANIC_SPEC);
        Run run = f.testSends.start(TENANT, id, sample(), TESTER);
        assertEquals(TestSend.VERSION, run.ruleVersion());
        assertFalse(run.test(), "the messages are sent for real");

        f.engine.runDue();
        assertEquals(1, f.whatsappSent.size());
        assertEquals(TESTER_PHONE, f.whatsappSent.get(0).to(), "not to the rule's driver");
        assertTrue(f.emailsSent.isEmpty(), "the email step waits for the reply time");

        f.now = T0.plus(Duration.ofMinutes(5));
        f.engine.runDue();
        assertEquals(List.of(TESTER_EMAIL), f.emailsSent.stream().map(e -> e.to()).toList(),
                "not to the rule's tower address");
    }

    @Test
    void aReplyStopsItAsTheRuleSays() {
        String id = draft(PANIC_SPEC);
        Run run = f.testSends.start(TENANT, id, sample(), TESTER);
        f.engine.runDue();
        Message sent = f.store.conversations.messages.get(0);

        assertTrue(f.engine.replied(new ConversationReplyReceived(TENANT, sent.conversationId(), "m-1", null,
                run.id(), null, Channel.WHATSAPP, TESTER_PHONE, "Estoy bien", null,
                OffsetDateTime.of(2026, 10, 23, 15, 6, 0, 0, ZoneOffset.UTC))).isPresent());
        f.now = T0.plus(Duration.ofMinutes(5));
        f.engine.runDue();
        assertTrue(f.emailsSent.isEmpty());
    }

    @Test
    void itSendsTheDraftAsItWasWhenItStarted() {
        String id = draft(PANIC_SPEC);
        f.testSends.start(TENANT, id, sample(), TESTER);
        f.service.saveDraft(TENANT, id, json("""
                {"trigger": {"event": "symptom.case.opened", "when": ""}, "groups": [],
                 "steps": [{"channel": "email", "template": "panic-tower", "to": []}]}
                """), "owner@example.com");

        f.engine.runDue();
        assertEquals(1, f.whatsappSent.size(), "the copied draft's first step is WhatsApp");
    }

    @Test
    void aStepOnAChannelThePersonHasNoAddressForSendsNothing() {
        String id = draft(PANIC_SPEC);
        f.testSends.start(TENANT, id, sample(), new TestSend.To(TESTER_EMAIL, null, null));
        f.engine.runDue();
        assertTrue(f.whatsappSent.isEmpty());
        assertFalse(f.whatsappSent.stream().anyMatch(s -> DRIVER.equals(s.to())));
    }

    @Test
    void connectionStepsCallNothing() {
        String id = draft("""
                {"trigger": {"event": "symptom.case.opened", "when": ""}, "groups": [],
                 "steps": [{"channel": "slack", "template": "panic-tower", "connection": "slack-1"}]}
                """);
        f.testSends.start(TENANT, id, sample(), TESTER);
        f.engine.runDue();
        assertTrue(f.integrations.calls.isEmpty());
        assertEquals(MessageStatus.SIMULATED, f.store.conversations.messages.get(0).status());
    }

    @Test
    void aDraftWithErrorsOrNoPersonIsRefused() {
        String broken = draft("""
                {"trigger": {"event": "symptom.case.opened", "when": ""}, "groups": [], "steps": []}
                """);
        assertThrows(RulesService.NotPublishable.class, () -> f.testSends.start(TENANT, broken, sample(), TESTER));
        String id = f.service.create(TENANT, "panic-2", "Pánico 2", json(PANIC_SPEC), "owner@example.com").rule()
                .id();
        assertThrows(IllegalArgumentException.class,
                () -> f.testSends.start(TENANT, id, sample(), new TestSend.To(" ", null, "x")));
        assertTrue(f.store.runs.isEmpty());
    }
}
