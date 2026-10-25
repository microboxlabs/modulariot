package com.microboxlabs.miot.conversational.rules;

import com.microboxlabs.miot.conversational.rules.RuleSimulator.SampleEvent;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Audience;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Group;
import com.microboxlabs.miot.conversational.rules.RuleSpec.Step;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * A request to start a rule without its trigger.
 *
 * @param version {@value #CURRENT} (the default) the version in force; {@value #DRAFT} the draft as it is when
 *                each step goes out
 * @param event   the event the templates read; null: the trigger's event type with no data
 * @param to      people for some of the rule's groups, by group id; they replace that group's entries. Null or
 *                empty: every group as the rule has it
 * @param key     optional: a second request with the same key for the same rule starts nothing and returns the
 *                first run
 */
public record Invocation(String version, SampleEvent event, Map<String, List<Person>> to, String key) {

    public static final String CURRENT = "current";
    public static final String DRAFT = "draft";
    /** The source of the event an invocation stores. */
    public static final String SOURCE = "invocation";
    static final int MAX_KEY = 200;

    public Invocation {
        version = version == null || version.isBlank() ? CURRENT : version.trim();
        to = to == null ? Map.of() : Map.copyOf(to);
        key = key == null || key.isBlank() ? null : key.trim();
    }

    public boolean draft() {
        return DRAFT.equals(version);
    }

    /** One person: the email for email steps, the phone for WhatsApp steps, the phone first for a preferred step. */
    public record Person(String name, String email, String phone) {

        public Person {
            name = blankToNull(name);
            email = blankToNull(email);
            phone = blankToNull(phone);
        }

        public boolean isEmpty() {
            return email == null && phone == null;
        }

        /** Their address on the step's channel, as an audience entry; null when they have none. */
        Audience on(String channel) {
            boolean byPhone = RuleSpec.WHATSAPP.equals(channel)
                    || (!RuleSpec.EMAIL.equals(channel) && phone != null);
            String address = byPhone ? phone : email;
            return address == null ? null
                    : new Audience(null, address, byPhone ? RuleSpec.WHATSAPP : RuleSpec.EMAIL, name, null);
        }

        private static String blankToNull(String s) {
            return s == null || s.isBlank() ? null : s.trim();
        }
    }

    /** The spec with each group named in {@code to} holding its people's addresses on the step's channel. */
    static RuleSpec forStep(RuleSpec spec, Step step, Map<String, List<Person>> to) {
        if (to == null || to.isEmpty()) {
            return spec;
        }
        List<Group> groups = new ArrayList<>();
        for (Group g : spec.groups()) {
            List<Person> people = to.get(g.id());
            if (people == null) {
                groups.add(g);
                continue;
            }
            List<Audience> entries = new ArrayList<>();
            for (Person p : people) {
                Audience a = p.on(step.channel());
                if (a != null) {
                    entries.add(a);
                }
            }
            groups.add(new Group(g.id(), g.name(), entries));
        }
        return new RuleSpec(spec.trigger(), groups, spec.steps(), spec.family());
    }

    /** The people by group, checked against the rule's groups; throws for an unknown group or a person without address. */
    static Map<String, List<Person>> recipients(RuleSpec spec, Map<String, List<Person>> to) {
        Map<String, List<Person>> out = new LinkedHashMap<>();
        for (Map.Entry<String, List<Person>> e : to.entrySet()) {
            if (spec.groups().stream().noneMatch(g -> g.id().equals(e.getKey()))) {
                throw new IllegalArgumentException("to: la regla no tiene el grupo " + e.getKey());
            }
            List<Person> people = e.getValue() == null ? List.of() : List.copyOf(e.getValue());
            if (people.stream().anyMatch(p -> p == null || p.isEmpty())) {
                throw new IllegalArgumentException("to." + e.getKey() + ": cada persona necesita email o phone");
            }
            out.put(e.getKey(), people);
        }
        return out;
    }
}
