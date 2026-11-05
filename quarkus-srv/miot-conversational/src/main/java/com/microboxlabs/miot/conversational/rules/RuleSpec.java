package com.microboxlabs.miot.conversational.rules;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.node.JsonNodeFactory;
import com.fasterxml.jackson.databind.node.ObjectNode;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

/**
 * A rule version's spec, read from its JSON. The JSON is stored and returned as the editor sent it; this record is
 * what the engine and the validator read. Reading never fails: a missing or mistyped value is null, and the
 * validator reports it.
 *
 * <p>Recipients are named groups, and each step names the groups it writes to. A spec saved before groups has
 * {@code audience} and steps whose {@code to} is {@code "audience"} or a list of recipients; it is read as a group
 * {@value #RULE_GROUP} with the audience and a group {@code step-N} for each step's own list.
 */
public record RuleSpec(Trigger trigger, List<Group> groups, List<Step> steps, String family) {

    public static final String TO_AUDIENCE = "audience";
    /** The group of a spec saved before groups that holds its {@code audience}. */
    public static final String RULE_GROUP = "rule";
    public static final String STEP_GROUP = "step-";
    public static final String WHATSAPP = "whatsapp";
    public static final String EMAIL = "email";
    public static final String PREFERRED = "preferred";
    /** The connection channels: each calls the step's integration connection once, whoever the audience is. */
    public static final String WEBHOOK = "webhook";
    public static final String SLACK = "slack";
    public static final String TEAMS = "teams";
    public static final String STOP = "stop";
    public static final String CONTINUE = "continue";
    private static final String GROUPS_FIELD = "groups";
    private static final String STEPS_FIELD = "steps";
    private static final String CHANNEL_FIELD = "channel";

    /** {@code when} is CEL over {@code event}; blank means always. */
    public record Trigger(String event, String when) {
    }

    /**
     * One of: a role, a fixed address (with channel and name), a path in {@code event.data}, or {@code contacts}:
     * CEL over {@code contact} and {@code event} that picks the contact book's active contacts.
     */
    public record Audience(String role, String address, String channel, String name, String path, String contacts) {

        public Audience(String role, String address, String channel, String name, String path) {
            this(role, address, channel, name, path, null);
        }
    }

    /** Recipients with a name the steps refer to; {@code name} may be null. */
    public record Group(String id, String name, List<Audience> entries) {

        public Group {
            entries = entries == null ? List.of() : List.copyOf(entries);
        }
    }

    /**
     * One message to send.
     *
     * @param after        minutes after the previous step finished waiting; null is 0
     * @param to           the ids of the groups the step writes to; unused by a connection step
     * @param waitForReply minutes to wait for a reply; null is 0
     * @param onReply      {@code stop} (the default) or {@code continue}
     * @param connection   the integration connection a connection step (webhook, slack, teams) calls
     */
    public record Step(Integer after, String channel, String template, List<String> to, boolean toInvalid,
            Integer waitForReply, String onReply, String connection) {

        /** The connection channel the step sends on; empty for WhatsApp, email and preferred. */
        public Optional<ConnectionChannel> connectionChannel() {
            return ConnectionChannel.of(channel);
        }

        public boolean viaConnection() {
            return connectionChannel().isPresent();
        }

        public int afterMinutes() {
            return after == null ? 0 : Math.max(0, after);
        }

        public int waitMinutes() {
            return waitForReply == null ? 0 : Math.max(0, waitForReply);
        }

        public boolean stopsOnReply() {
            return onReply == null || onReply.isBlank() || STOP.equals(onReply);
        }
    }

    public RuleSpec {
        groups = groups == null ? List.of() : List.copyOf(groups);
        steps = steps == null ? List.of() : List.copyOf(steps);
    }

    public RuleSpec(Trigger trigger, List<Group> groups, List<Step> steps) {
        this(trigger, groups, steps, null);
    }

    /** A new rule's spec: no event, no groups, no steps. */
    public static ObjectNode empty() {
        ObjectNode spec = JsonNodeFactory.instance.objectNode();
        ObjectNode trigger = spec.putObject("trigger");
        trigger.put("event", "");
        trigger.put("when", "");
        spec.putArray(GROUPS_FIELD);
        spec.putArray(STEPS_FIELD);
        return spec;
    }

    public static RuleSpec read(JsonNode spec) {
        if (spec == null || !spec.isObject()) {
            return new RuleSpec(null, List.of(), List.of());
        }
        JsonNode t = spec.path("trigger");
        Trigger trigger = t.isObject() ? new Trigger(text(t, "event"), text(t, "when")) : null;
        List<Group> groups = new ArrayList<>();
        List<Step> steps = new ArrayList<>();
        if (spec.has(GROUPS_FIELD)) {
            spec.path(GROUPS_FIELD).forEach(g -> groups.add(group(g)));
            spec.path(STEPS_FIELD).forEach(s -> steps.add(step(s)));
        } else {
            readLegacy(spec, groups, steps);
        }
        return new RuleSpec(trigger, groups, steps, text(spec, "family"));
    }

    /** The recipients of the groups a step writes to, in the order it names them; unknown ids are skipped. */
    public List<Audience> recipients(Step step) {
        List<Audience> out = new ArrayList<>();
        for (String id : step.to()) {
            groups.stream().filter(g -> id.equals(g.id())).findFirst().ifPresent(g -> out.addAll(g.entries()));
        }
        return out;
    }

    private static Group group(JsonNode g) {
        List<Audience> entries = new ArrayList<>();
        g.path("entries").forEach(a -> entries.add(audience(a)));
        return new Group(text(g, "id"), text(g, "name"), entries);
    }

    private static Step step(JsonNode s) {
        JsonNode to = s.path("to");
        List<String> ids = new ArrayList<>();
        boolean invalid = false;
        if (to.isArray()) {
            for (JsonNode id : to) {
                if (id.isTextual() && !id.asText().isBlank()) {
                    ids.add(id.asText().trim());
                } else {
                    invalid = true;
                }
            }
        } else if (!to.isMissingNode() && !to.isNull()) {
            invalid = true;
        }
        return step(s, ids, invalid);
    }

    private static Step step(JsonNode s, List<String> to, boolean invalid) {
        return new Step(integer(s, "after"), text(s, CHANNEL_FIELD), text(s, "template"), List.copyOf(to), invalid,
                integer(s, "waitForReply"), text(s, "onReply"), text(s, "connection"));
    }

    /** {@code audience} becomes the group {@value #RULE_GROUP}; a step's own list, the group {@code step-N}. */
    private static void readLegacy(JsonNode spec, List<Group> groups, List<Step> steps) {
        List<Audience> audience = new ArrayList<>();
        spec.path(TO_AUDIENCE).forEach(a -> audience.add(audience(a)));
        List<Group> own = new ArrayList<>();
        boolean usesAudience = false;
        int n = 0;
        for (JsonNode s : spec.path(STEPS_FIELD)) {
            n++;
            JsonNode to = s.path("to");
            boolean viaConnection = ConnectionChannel.of(text(s, CHANNEL_FIELD)).isPresent();
            if (viaConnection) {
                steps.add(step(s, List.of(), false));
            } else if (to.isArray()) {
                List<Audience> entries = new ArrayList<>();
                to.forEach(a -> entries.add(audience(a)));
                own.add(new Group(STEP_GROUP + n, null, entries));
                steps.add(step(s, List.of(STEP_GROUP + n), false));
            } else if (to.isMissingNode() || to.isNull() || (to.isTextual() && TO_AUDIENCE.equals(to.asText()))) {
                usesAudience = true;
                steps.add(step(s, List.of(RULE_GROUP), false));
            } else {
                steps.add(step(s, List.of(), true));
            }
        }
        if (!audience.isEmpty() || usesAudience) {
            groups.add(new Group(RULE_GROUP, null, audience));
        }
        groups.addAll(own);
    }

    private static Audience audience(JsonNode a) {
        return new Audience(text(a, "role"), text(a, "address"), text(a, CHANNEL_FIELD), text(a, "name"),
                text(a, "path"), text(a, "contacts"));
    }

    private static String text(JsonNode node, String field) {
        JsonNode v = node.path(field);
        if (!v.isValueNode() || v.isNull()) {
            return null;
        }
        String s = v.asText().trim();
        return s.isEmpty() ? null : s;
    }

    private static Integer integer(JsonNode node, String field) {
        JsonNode v = node.path(field);
        return v.isNumber() ? v.intValue() : null;
    }

    /** The steps' channels, in order and without repeats. */
    public List<String> channels() {
        return steps.stream().map(Step::channel).filter(c -> c != null).distinct().toList();
    }
}
