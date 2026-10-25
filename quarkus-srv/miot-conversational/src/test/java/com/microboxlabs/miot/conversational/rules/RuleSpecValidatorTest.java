package com.microboxlabs.miot.conversational.rules;

import static com.microboxlabs.miot.conversational.rules.RulesFixture.PANIC_SPEC;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.TENANT;
import static com.microboxlabs.miot.conversational.rules.RulesFixture.json;
import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Finding;
import com.microboxlabs.miot.conversational.rules.RuleSpecValidator.Severity;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The findings of a rule spec: codes, sections, params and positions. */
class RuleSpecValidatorTest {

    private final RulesFixture f = new RulesFixture();

    private List<Finding> validate(String spec) {
        return f.service.validate(TENANT, RuleSpec.read(json(spec)));
    }

    private static Finding only(List<Finding> findings, String code) {
        List<Finding> matching = findings.stream().filter(x -> x.code().equals(code)).toList();
        assertEquals(1, matching.size(), code + " in " + findings);
        return matching.get(0);
    }

    @Test
    void theSliceRuleHasNoFindings() {
        assertEquals(List.of(), validate(PANIC_SPEC));
    }

    @Test
    void aMissingOrUnknownEventIsNoEvent() {
        Finding missing = only(validate("""
                {"audience": [{"role": "driver"}], "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "noEvent");
        assertEquals("trigger", missing.section());
        assertEquals(Severity.ERROR, missing.severity());

        Finding unknown = only(validate("""
                {"trigger": {"event": "trip.arrived"}, "audience": [{"role": "driver"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "noEvent");
        assertEquals(Map.of("event", "trip.arrived"), unknown.params());
        assertTrue(unknown.message().contains("trip.arrived"));
    }

    @Test
    void aConditionThatDoesNotCompileIsWhenInvalidWithItsPosition() {
        Finding f1 = only(validate("""
                {"trigger": {"event": "symptom.case.opened", "when": "event.data.level >= "},
                 "audience": [{"role": "driver"}], "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "whenInvalid");
        assertEquals("trigger", f1.section());
        assertTrue(f1.position() > 0, "position " + f1.position());

        Finding unknownVar = only(validate("""
                {"trigger": {"event": "symptom.case.opened", "when": "evento.data.level >= 4"},
                 "audience": [{"role": "driver"}], "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "whenInvalid");
        assertEquals(0, unknownVar.position());

        only(validate("""
                {"trigger": {"event": "symptom.case.opened", "when": "event.data.level + 1"},
                 "audience": [{"role": "driver"}], "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "whenInvalid");
    }

    @Test
    void anEmptyAudienceForAStepToTheAudienceIsAnEmptyGroup() {
        Finding finding = only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "to": "audience"}]}
                """), "groupEmpty");
        assertEquals("groups.0", finding.section());
        assertEquals(List.of(), validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "email", "template": "panic-tower",
                            "to": [{"address": "tower@example.com", "channel": "email"}]}]}
                """));
    }

    @Test
    void anEmptyContactConditionCannotBePublished() {
        Finding finding = only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"contacts": ""}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "audienceEmptyEntry");
        assertEquals(Severity.ERROR, finding.severity());
        assertFalse(RuleSpecValidator.publishable(List.of(finding)));
    }

    @Test
    void anUnknownRoleIsAWarning() {
        Finding finding = only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"role": "driver"}, {"role": "carrier"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "unknownRole");
        assertEquals("groups.0", finding.section());
        assertEquals(Severity.WARNING, finding.severity());
        assertEquals(Map.of("role", "carrier", "entry", 2, "group", 1), finding.params());
        assertEquals(List.of(), validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"role": "jefe de torre"}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "roles match ignoring case");
    }

    @Test
    void stepsNeedATemplateThatExistsAndHasTheChannel() {
        List<Finding> findings = validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"role": "driver"}],
                 "steps": [{"channel": "whatsapp"},
                           {"channel": "whatsapp", "template": "nope"},
                           {"channel": "email", "template": "panic-check"}]}
                """);
        assertEquals("steps.0", only(findings, "stepNoTemplate").section());
        Finding unknown = only(findings, "stepUnknownTemplate");
        assertEquals("steps.1", unknown.section());
        assertEquals(Map.of("template", "nope", "step", 2), unknown.params());
        assertEquals(Map.of("step", 1), only(findings, "stepNoTemplate").params());
        assertEquals("steps.2", only(findings, "stepTemplateNoChannel").section());
    }

    @Test
    void noStepsAndBadValues() {
        assertEquals("steps.0", only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"role": "driver"}], "steps": []}
                """), "noSteps").section());

        List<Finding> findings = validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"role": "driver"}],
                 "steps": [{"channel": "sms", "template": "panic-check", "waitForReply": 5},
                           {"channel": "whatsapp", "template": "panic-check", "after": -1, "onReply": "later"}]}
                """);
        assertEquals("steps.0", only(findings, "stepBadChannel").section());
        assertEquals(Map.of("channel", "sms", "step", 1), only(findings, "stepWaitNeedsReplies").params());
        assertEquals("steps.1", only(findings, "stepNegativeMinutes").section());
        assertEquals("steps.1", only(findings, "stepBadOnReply").section());
        assertFalse(RuleSpecValidator.publishable(findings));
    }

    @Test
    void aWebhookStepNeedsAConnectionButNoRecipientsNorTemplate() {
        assertEquals(List.of(), validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "webhook", "connection": "conn-9"},
                           {"channel": "webhook", "connection": "conn-9", "template": "panic-check"}]}
                """));

        Finding finding = only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"role": "driver"}],
                 "steps": [{"channel": "webhook", "to": []}]}
                """), "stepNoConnection");
        assertEquals("steps.0", finding.section());
        assertEquals(Severity.ERROR, finding.severity());
        assertEquals(Map.of("channel", "webhook", "step", 1), finding.params());
        assertEquals("Elige la conexión que llama el paso.", finding.message());
    }

    @Test
    void aConnectionStepNamesOneOfTheOrganizationsConnectionsOfItsChannel() {
        RulesService checked = new RulesService(f.store.ruleStore, f.store.templateStore, () -> List.of(f.catalog),
                () -> List.of(f.participants), f.clock,
                (tenant, channel, id) -> TENANT.equals(tenant) && "slack".equals(channel) && "conn-1".equals(id));

        assertEquals(List.of(), checked.validate(TENANT, RuleSpec.read(json("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "slack", "connection": "conn-1"}]}
                """))));
        Finding finding = only(checked.validate(TENANT, RuleSpec.read(json("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "teams", "connection": "conn-1"}]}
                """))), "stepUnknownConnection");
        assertEquals("steps.0", finding.section());
        assertEquals(Severity.ERROR, finding.severity());
    }

    @Test
    void slackAndTeamsStepsFollowTheWebhookRules() {
        assertEquals(List.of(), validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "slack", "connection": "conn-1"},
                           {"channel": "Teams", "connection": "conn-2", "template": "panic-check"}]}
                """));

        List<Finding> findings = validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "slack", "waitForReply": 5},
                           {"channel": "teams", "to": [], "template": "nope"}]}
                """);
        List<Finding> noConnection = findings.stream().filter(found -> "stepNoConnection".equals(found.code())).toList();
        assertEquals(List.of(Map.of("channel", "slack", "step", 1), Map.of("channel", "teams", "step", 2)),
                noConnection.stream().map(Finding::params).toList());
        assertEquals(Map.of("channel", "slack", "step", 1), only(findings, "stepWaitNeedsReplies").params());
        assertEquals("steps.1", only(findings, "stepUnknownTemplate").section());
        assertEquals(4, findings.size(), findings.toString());
    }

    @Test
    void aWebhookStepCannotWaitForAReplyAndItsTemplateMustExist() {
        List<Finding> findings = validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [],
                 "steps": [{"channel": "webhook", "connection": "conn-9", "template": "nope", "waitForReply": 5}]}
                """);
        assertEquals(Map.of("channel", "webhook", "step", 1), only(findings, "stepWaitNeedsReplies").params());
        only(findings, "stepUnknownTemplate");
        assertEquals(2, findings.size(), findings.toString());
    }

    @Test
    void aFixedAddressNeedsItsChannel() {
        Finding finding = only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"address": "+56900000000"}, {}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "audienceBadChannel");
        assertEquals(Map.of("address", "+56900000000", "entry", 1, "group", 1), finding.params());
        assertEquals(Map.of("entry", 2, "group", 1), only(validate("""
                {"trigger": {"event": "symptom.case.opened"}, "audience": [{"address": "+56900000000"}, {}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check"}]}
                """), "audienceEmptyEntry").params());
    }

    @Test
    void stepsWriteToGroupsThatExist() {
        List<Finding> findings = validate("""
                {"trigger": {"event": "symptom.case.opened"},
                 "groups": [{"id": "drivers", "name": "Conductores", "entries": [{"role": "driver"}]},
                            {"id": "tower", "entries": [{"address": "tower@example.com", "channel": "email"}]}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "to": ["drivers", "night"]},
                           {"channel": "email", "template": "panic-tower", "to": []}]}
                """);
        Finding unknown = only(findings, "stepUnknownGroup");
        assertEquals("steps.0", unknown.section());
        assertEquals(Map.of("id", "night", "step", 1), unknown.params());
        assertEquals("steps.1", only(findings, "stepNoRecipients").section());
        Finding unused = only(findings, "groupUnused");
        assertEquals("groups.1", unused.section());
        assertEquals(Severity.WARNING, unused.severity());
    }

    @Test
    void aGroupNeedsAnIdOfItsOwnAndRecipients() {
        List<Finding> findings = validate("""
                {"trigger": {"event": "symptom.case.opened"},
                 "groups": [{"id": "drivers", "entries": [{"role": "driver"}]},
                            {"id": "drivers", "entries": [{"role": "driver"}]},
                            {"name": "Sin id", "entries": []}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "to": ["drivers"]}]}
                """);
        assertEquals("groups.1", only(findings, "groupDuplicateId").section());
        assertEquals("groups.2", only(findings, "groupNoId").section());
        assertEquals(Map.of("group", 3), only(findings, "groupEmpty").params());
    }

    @Test
    void aStepNamesGroupsById() {
        assertEquals("stepBadRecipients", only(validate("""
                {"trigger": {"event": "symptom.case.opened"},
                 "groups": [{"id": "drivers", "entries": [{"role": "driver"}]}],
                 "steps": [{"channel": "whatsapp", "template": "panic-check", "to": [{"role": "driver"}]}]}
                """), "stepBadRecipients").code());
    }
}
