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
import com.microboxlabs.miot.conversational.rules.Invocation.Person;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleContext;
import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import java.time.Duration;
import java.time.OffsetDateTime;
import java.time.ZoneOffset;
import java.util.List;
import java.util.LinkedHashMap;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** A rule started on request: the version in force or the draft, to its groups or to the people named for them. */
class RuleInvocationsTest {

    private static final String TESTER_EMAIL = "tester@example.com";
    private static final String TESTER_PHONE = "+56900000099";
    private static final Person TESTER = new Person("Tester", TESTER_EMAIL, TESTER_PHONE);
    /** PANIC_SPEC's groups: the driver, and the tower address of its second step. */
    private static final Map<String, List<Person>> TO_TESTER =
            Map.of(RuleSpec.RULE_GROUP, List.of(TESTER), "step-2", List.of(TESTER));

    private final RulesFixture f = new RulesFixture();

    private String draft(String spec) {
        return f.service.create(TENANT, "panic", "Pánico", json(spec), "owner@example.com").rule().id();
    }

    private static SampleEvent sample() {
        return new SampleEvent("symptom.case.opened", new SampleContext("symptom_case", "-7"),
                Map.of("symptomKey", "panic-button", "level", 4, "assetId", "ABCD12"), false, null);
    }

    private static Invocation ofDraft(Map<String, List<Person>> to) {
        return new Invocation(Invocation.DRAFT, sample(), to, null);
    }

    @Test
    void theDraftGoesToTheNamedPersonAtEachStepsTime() {
        String id = draft(PANIC_SPEC);
        Run run = f.invocations.start(TENANT, id, ofDraft(TO_TESTER));
        assertEquals(Invocation.DRAFT, run.ruleVersion());
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
        Run run = f.invocations.start(TENANT, id, ofDraft(TO_TESTER));
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
    void aRunOfTheDraftReadsTheDraftAsItIsWhenEachStepGoesOut() {
        String id = draft(PANIC_SPEC);
        f.invocations.start(TENANT, id, ofDraft(Map.of(RuleSpec.RULE_GROUP, List.of(TESTER))));
        f.service.saveDraft(TENANT, id, json("""
                {"trigger": {"event": "symptom.case.opened", "when": ""},
                 "groups": [{"id": "rule", "entries": [{"role": "driver"}]}],
                 "steps": [{"channel": "email", "template": "panic-tower", "to": ["rule"]}]}
                """), "owner@example.com");

        f.engine.runDue();
        assertTrue(f.whatsappSent.isEmpty());
        assertEquals(List.of(TESTER_EMAIL), f.emailsSent.stream().map(e -> e.to()).toList());
    }

    @Test
    void aGroupNotNamedKeepsItsRecipients() {
        String id = draft(PANIC_SPEC);
        f.invocations.start(TENANT, id, ofDraft(Map.of("step-2", List.of(TESTER))));
        f.engine.runDue();
        assertEquals(DRIVER, f.whatsappSent.get(0).to());
    }

    @Test
    void aGroupAddedAfterARedirectedDraftStartedCannotReceiveTheTestSend() {
        String id = draft(PANIC_SPEC);
        f.invocations.start(TENANT, id, ofDraft(TO_TESTER));
        f.engine.runDue();
        f.service.saveDraft(TENANT, id, json("""
                {"trigger": {"event": "symptom.case.opened", "when": ""},
                 "groups": [{"id": "rule", "entries": [{"role": "driver"}]},
                            {"id": "late", "entries": [{"address": "other@example.com", "channel": "email"}]}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "to": ["rule"],
                            "waitForReply": 5},
                           {"channel": "email", "template": "panic-tower", "to": ["late"]}]}
                """), "owner@example.com");

        f.now = T0.plus(Duration.ofMinutes(5));
        f.engine.runDue();

        assertTrue(f.emailsSent.isEmpty());
    }

    @Test
    void aNullRecipientListIsAnEmptyOverride() {
        String id = draft(PANIC_SPEC);
        Map<String, List<Person>> recipients = new LinkedHashMap<>();
        recipients.put(RuleSpec.RULE_GROUP, null);

        f.invocations.start(TENANT, id, ofDraft(recipients));
        f.engine.runDue();

        assertTrue(f.whatsappSent.isEmpty());
    }

    @Test
    void aStepOnAChannelThePersonHasNoAddressForSendsNothing() {
        String id = draft(PANIC_SPEC);
        f.invocations.start(TENANT, id,
                ofDraft(Map.of(RuleSpec.RULE_GROUP, List.of(new Person(null, TESTER_EMAIL, null)))));
        f.engine.runDue();
        assertTrue(f.whatsappSent.isEmpty());
    }

    @Test
    void theDraftsConnectionStepsCallNothing() {
        String id = draft("""
                {"trigger": {"event": "symptom.case.opened", "when": ""}, "groups": [],
                 "steps": [{"channel": "slack", "template": "panic-tower", "connection": "slack-1"}]}
                """);
        f.invocations.start(TENANT, id, ofDraft(null));
        f.engine.runDue();
        assertTrue(f.integrations.calls.isEmpty());
        assertEquals(MessageStatus.SIMULATED, f.store.conversations.messages.get(0).status());
    }

    @Test
    void theVersionInForceGoesToTheRulesGroupsAndAKeyStartsItOnce() {
        Rule rule = f.rule("panic", PANIC_SPEC, Rule.State.ACTIVE);
        Invocation invocation = new Invocation(null, sample(), null, "OT-1-salida");
        Run run = f.invocations.start(TENANT, rule.id(), invocation);
        assertEquals("0.1.0", run.ruleVersion());
        assertEquals(run.id(), f.invocations.start(TENANT, rule.id(), invocation).id());
        assertEquals(1, f.store.runs.size());

        f.engine.runDue();
        assertEquals(DRIVER, f.whatsappSent.get(0).to());
    }

    @Test
    void aTestRuleSimulatesAndAnOffRuleIsRefused() {
        Rule test = f.rule("panic", PANIC_SPEC, Rule.State.TEST);
        assertTrue(f.invocations.start(TENANT, test.id(), new Invocation(null, sample(), null, null)).test());
        Rule off = f.rule("panic-off", PANIC_SPEC, Rule.State.OFF);
        Invocation offRequest = new Invocation(null, sample(), null, null);
        assertThrows(IllegalStateException.class,
                () -> f.invocations.start(TENANT, off.id(), offRequest));
    }

    @Test
    void aDraftWithErrorsAnUnknownGroupOrAPersonWithoutAddressIsRefused() {
        String broken = draft("""
                {"trigger": {"event": "symptom.case.opened", "when": ""}, "groups": [], "steps": []}
                """);
        Invocation brokenRequest = ofDraft(null);
        assertThrows(RulesService.NotPublishable.class, () -> f.invocations.start(TENANT, broken, brokenRequest));
        String id = f.service.create(TENANT, "panic-2", "Pánico 2", json(PANIC_SPEC), "owner@example.com").rule()
                .id();
        Invocation unknownGroup = ofDraft(Map.of("nope", List.of(TESTER)));
        assertThrows(IllegalArgumentException.class,
                () -> f.invocations.start(TENANT, id, unknownGroup));
        Invocation missingAddress = ofDraft(Map.of(RuleSpec.RULE_GROUP, List.of(new Person("x", " ", null))));
        assertThrows(IllegalArgumentException.class, () -> f.invocations.start(TENANT, id, missingAddress));
        assertTrue(f.store.runs.isEmpty());
    }
}
