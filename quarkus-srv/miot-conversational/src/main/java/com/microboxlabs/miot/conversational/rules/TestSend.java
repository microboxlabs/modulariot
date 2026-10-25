package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Group;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import java.util.ArrayList;
import java.util.List;

/**
 * A run of a rule's draft that writes to one chosen person: each email step to {@code to.email}, each WhatsApp
 * step to {@code to.phone}, a preferred step to the phone when there is one. Connection steps call nothing.
 * {@code spec} is the draft as it was when the test started.
 */
public record TestSend(String runId, JsonNode spec, To to) {

    /** The {@code rule_version} of a test send's run. */
    public static final String VERSION = "prueba";
    static final String EMAIL_GROUP = "test-email";
    static final String PHONE_GROUP = "test-whatsapp";

    public record To(String email, String phone, String name) {

        public To {
            email = blankToNull(email);
            phone = blankToNull(phone);
            name = blankToNull(name);
        }

        public boolean isEmpty() {
            return email == null && phone == null;
        }

        private static String blankToNull(String s) {
            return s == null || s.isBlank() ? null : s.trim();
        }
    }

    /** The draft with its groups replaced by the chosen person, and each step written to the group for its channel. */
    public RuleSpec rule() {
        RuleSpec draft = RuleSpec.read(spec);
        List<Group> groups = new ArrayList<>();
        if (to.email() != null) {
            groups.add(new Group(EMAIL_GROUP, to.name(),
                    List.of(new Audience(null, to.email(), RuleSpec.EMAIL, to.name(), null))));
        }
        if (to.phone() != null) {
            groups.add(new Group(PHONE_GROUP, to.name(),
                    List.of(new Audience(null, to.phone(), RuleSpec.WHATSAPP, to.name(), null))));
        }
        List<Step> steps = draft.steps().stream()
                .map(s -> s.viaConnection() ? s
                        : new Step(s.after(), s.channel(), s.template(), groupsFor(s.channel()), false,
                                s.waitForReply(), s.onReply(), s.connection()))
                .toList();
        return new RuleSpec(draft.trigger(), groups, steps, draft.family());
    }

    private List<String> groupsFor(String channel) {
        boolean email = to.email() != null && !RuleSpec.WHATSAPP.equals(channel);
        boolean phone = to.phone() != null && !RuleSpec.EMAIL.equals(channel);
        if (phone) {
            return List.of(PHONE_GROUP);
        }
        return email ? List.of(EMAIL_GROUP) : List.of();
    }
}
