package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;

import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class RuleBumpTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static final String BASE = """
            {"trigger": {"event": "symptom.case.opened", "when": "event.data.level >= 4"},
             "audience": [{"role": "driver"}],
             "steps": [
               {"after": 0, "channel": "whatsapp", "template": "check", "to": "audience", "waitForReply": 5,
                "onReply": "stop"},
               {"after": 5, "channel": "email", "template": "tower", "to": "audience", "waitForReply": 0}
             ]}""";

    private static RuleSpec spec(String json) throws Exception {
        return RuleSpec.read(JSON.readTree(json));
    }

    /** The bump from the base rule to the base rule with {@code from} replaced. */
    private static RuleBump bump(String from, String to) throws Exception {
        if (!BASE.contains(from)) {
            throw new IllegalArgumentException("not in the base rule: " + from);
        }
        return RuleBump.between(spec(BASE), spec(BASE.replace(from, to)));
    }

    @Test
    void theEventIsMajor() throws Exception {
        assertEquals(RuleBump.MAJOR, bump("symptom.case.opened", "symptom.case.closed"));
    }

    @Test
    void whitespaceInTheConditionIsNoChange() throws Exception {
        assertNull(bump("\"event.data.level >= 4\"", "\"  event.data.level   >=\\n 4 \""));
        assertEquals(RuleBump.MINOR, bump("event.data.level >= 4", "event.data.name == 'a  b'"));
        assertEquals("event.data.name == 'a  b'", RuleBump.squash(" event.data.name  ==  'a  b' "));
        assertEquals("", RuleBump.squash(null));
        assertEquals("a == 'it\\'s  x' && b", RuleBump.squash("a  ==  'it\\'s  x'   &&  b"));
        assertEquals("a == 'open", RuleBump.squash("a  == 'open"));
    }

    @Test
    void conditionRecipientsAndStepRoutingAreMinor() throws Exception {
        assertEquals(RuleBump.MINOR, bump(">= 4", ">= 3"));
        assertEquals(RuleBump.MINOR, bump("\"role\": \"driver\"", "\"role\": \"tower_lead\""));
        assertEquals(RuleBump.MINOR, bump("\"channel\": \"email\"", "\"channel\": \"whatsapp\""));
        assertEquals(RuleBump.MINOR, bump("\"template\": \"tower\", \"to\": \"audience\"",
                "\"template\": \"tower\", \"to\": [{\"address\": \"ops@example.com\", \"channel\": \"email\"}]"));
        for (String channel : List.of("webhook", "slack", "teams")) {
            String step = BASE.replace("\"channel\": \"email\"",
                    "\"channel\": \"" + channel + "\", \"connection\": \"c-1\"");
            assertEquals(RuleBump.MINOR, RuleBump.between(spec(step), spec(step.replace("c-1", "c-2"))), channel);
        }
        String slack = BASE.replace("\"channel\": \"email\"", "\"channel\": \"slack\", \"connection\": \"c-1\"");
        assertEquals(RuleBump.MINOR, RuleBump.between(spec(slack), spec(slack.replace("slack", "teams"))));
        RuleSpec base = spec(BASE);
        RuleSpec oneStep = new RuleSpec(base.trigger(), base.groups(), base.steps().subList(0, 1));
        assertEquals(RuleBump.MINOR, RuleBump.between(base, oneStep));
    }

    @Test
    void movingAStepIsMinor() throws Exception {
        RuleSpec base = spec(BASE);
        RuleSpec sameChannels = spec(BASE.replace("\"channel\": \"email\"", "\"channel\": \"whatsapp\""));
        RuleSpec swapped = new RuleSpec(base.trigger(), base.groups(),
                java.util.List.of(sameChannels.steps().get(1), sameChannels.steps().get(0)));
        assertEquals(RuleBump.MINOR, RuleBump.between(sameChannels, swapped));
    }

    @Test
    void theFamilyIsPatch() throws Exception {
        String filed = BASE.replace("{\"trigger\"", "{\"family\": \"trips\", \"trigger\"");
        assertEquals("trips", spec(filed).family());
        assertEquals(RuleBump.PATCH, RuleBump.between(spec(BASE), spec(filed)));
        assertEquals(RuleBump.PATCH, RuleBump.between(spec(filed), spec(filed.replace("trips", "symptoms"))));
        assertNull(RuleBump.between(spec(filed), spec(filed)));
    }

    @Test
    void timingTemplateAndReplyArePatch() throws Exception {
        assertEquals(RuleBump.PATCH, bump("\"after\": 5", "\"after\": 10"));
        assertEquals(RuleBump.PATCH, bump("\"template\": \"check\"", "\"template\": \"check-v2\""));
        assertEquals(RuleBump.PATCH, bump("\"onReply\": \"stop\"", "\"onReply\": \"continue\""));
    }

    @Test
    void theSameSpecIsNoBump() throws Exception {
        assertNull(RuleBump.between(spec(BASE), spec(BASE)));
    }

    @Test
    void nextVersions() {
        assertEquals("0.1.0", RuleBump.MINOR.next(null));
        assertEquals("1.0.0", RuleBump.MAJOR.next("0.3.2"));
        assertEquals("0.4.0", RuleBump.MINOR.next("0.3.2"));
        assertEquals("0.3.3", RuleBump.PATCH.next("0.3.2"));
        assertEquals("0.10.0", RuleBump.MINOR.next("0.9.0"));
    }

    @Test
    void aRequestedBumpRaisesButNeverLowers() {
        assertEquals(RuleBump.MINOR, RuleBump.PATCH.atLeast(RuleBump.MINOR));
        assertEquals(RuleBump.MAJOR, RuleBump.MAJOR.atLeast(RuleBump.PATCH));
        assertEquals(RuleBump.PATCH, RuleBump.PATCH.atLeast(null));
    }

    @Test
    void aGroupsNameIsPatchAndItsRecipientsMinor() throws Exception {
        String groups = """
                {"trigger": {"event": "symptom.case.opened"},
                 "groups": [{"id": "drivers", "name": "Conductores", "entries": [{"role": "driver"}]}],
                 "steps": [{"channel": "whatsapp", "template": "check", "to": ["drivers"]}]}""";
        assertEquals(RuleBump.PATCH, RuleBump.between(spec(groups), spec(groups.replace("Conductores", "Choferes"))));
        assertEquals(RuleBump.MINOR,
                RuleBump.between(spec(groups), spec(groups.replace("\"driver\"", "\"carrier\""))));
    }

    @Test
    void aRuleSavedBeforeGroupsReadsAsTheSameRuleWithGroups() throws Exception {
        String groups = """
                {"trigger": {"event": "symptom.case.opened", "when": "event.data.level >= 4"},
                 "groups": [{"id": "rule", "entries": [{"role": "driver"}]}],
                 "steps": [
                   {"after": 0, "channel": "whatsapp", "template": "check", "to": ["rule"], "waitForReply": 5,
                    "onReply": "stop"},
                   {"after": 5, "channel": "email", "template": "tower", "to": ["rule"], "waitForReply": 0}
                 ]}""";
        assertNull(RuleBump.between(spec(BASE), spec(groups)));
    }
}
