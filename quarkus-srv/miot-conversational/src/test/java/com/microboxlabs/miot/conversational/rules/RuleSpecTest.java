package com.microboxlabs.miot.conversational.rules;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Group;
import java.util.List;
import org.junit.jupiter.api.Test;

class RuleSpecTest {

    private static final ObjectMapper JSON = new ObjectMapper();

    private static RuleSpec read(String json) throws Exception {
        return RuleSpec.read(JSON.readTree(json));
    }

    @Test
    void aRuleSavedBeforeGroupsGetsAGroupForItsAudienceAndOneForEachStepsOwnList() throws Exception {
        RuleSpec spec = read("""
                {"audience": [{"role": "driver"}],
                 "steps": [{"channel": "whatsapp", "template": "a", "to": "audience"},
                           {"channel": "email", "template": "b",
                            "to": [{"address": "tower@example.com", "channel": "email"}]},
                           {"channel": "slack", "connection": "c-1"},
                           {"channel": "email", "template": "c"}]}""");

        assertEquals(List.of(new Group("rule", null, List.of(new Audience("driver", null, null, null, null))),
                new Group("step-2", null, List.of(new Audience(null, "tower@example.com", "email", null, null)))),
                spec.groups());
        assertEquals(List.of(List.of("rule"), List.of("step-2"), List.of(), List.of("rule")),
                spec.steps().stream().map(RuleSpec.Step::to).toList());
    }

    @Test
    void aStepsRecipientsAreThoseOfItsGroupsInTheOrderItNamesThem() throws Exception {
        RuleSpec spec = read("""
                {"groups": [{"id": "a", "entries": [{"role": "driver"}]},
                            {"id": "b", "entries": [{"role": "carrier"}, {"role": "tower_lead"}]}],
                 "steps": [{"channel": "whatsapp", "template": "x", "to": ["b", "missing", "a"]}]}""");

        assertEquals(List.of("carrier", "tower_lead", "driver"),
                spec.recipients(spec.steps().get(0)).stream().map(Audience::role).toList());
    }

    @Test
    void aStepWithRecipientsInsteadOfGroupIdsIsInvalid() throws Exception {
        RuleSpec spec = read("""
                {"groups": [], "steps": [{"channel": "whatsapp", "template": "x", "to": "audience"}]}""");

        assertTrue(spec.steps().get(0).toInvalid());
    }
}
