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
 */
public record RuleSpec(Trigger trigger, List<Audience> audience, List<Step> steps, String family) {

    public static final String TO_AUDIENCE = "audience";
    public static final String WHATSAPP = "whatsapp";
    public static final String EMAIL = "email";
    public static final String PREFERRED = "preferred";
    /** The connection channels: each calls the step's integration connection once, whoever the audience is. */
    public static final String WEBHOOK = "webhook";
    public static final String SLACK = "slack";
    public static final String TEAMS = "teams";
    public static final String STOP = "stop";
    public static final String CONTINUE = "continue";

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

    /**
     * One message to send.
     *
     * @param after        minutes after the previous step finished waiting; null is 0
     * @param to           null when the step goes to the rule's audience, else its own recipients; unused by a
     *                     connection step
     * @param waitForReply minutes to wait for a reply; null is 0
     * @param onReply      {@code stop} (the default) or {@code continue}
     * @param connection   the integration connection a connection step (webhook, slack, teams) calls
     */
    public record Step(Integer after, String channel, String template, List<Audience> to, boolean toInvalid,
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
        audience = audience == null ? List.of() : List.copyOf(audience);
        steps = steps == null ? List.of() : List.copyOf(steps);
    }

    public RuleSpec(Trigger trigger, List<Audience> audience, List<Step> steps) {
        this(trigger, audience, steps, null);
    }

    /** A new rule's spec: no event, no audience, no steps. */
    public static ObjectNode empty() {
        ObjectNode spec = JsonNodeFactory.instance.objectNode();
        ObjectNode trigger = spec.putObject("trigger");
        trigger.put("event", "");
        trigger.put("when", "");
        spec.putArray(TO_AUDIENCE);
        spec.putArray("steps");
        return spec;
    }

    public static RuleSpec read(JsonNode spec) {
        if (spec == null || !spec.isObject()) {
            return new RuleSpec(null, List.of(), List.of());
        }
        JsonNode t = spec.path("trigger");
        Trigger trigger = t.isObject() ? new Trigger(text(t, "event"), text(t, "when")) : null;
        List<Audience> audience = new ArrayList<>();
        spec.path(TO_AUDIENCE).forEach(a -> audience.add(audience(a)));
        List<Step> steps = new ArrayList<>();
        spec.path("steps").forEach(s -> steps.add(step(s)));
        return new RuleSpec(trigger, audience, steps, text(spec, "family"));
    }

    private static Step step(JsonNode s) {
        JsonNode to = s.path("to");
        List<Audience> recipients = null;
        boolean invalid = false;
        if (to.isArray()) {
            recipients = new ArrayList<>();
            for (JsonNode a : to) {
                recipients.add(audience(a));
            }
        } else if (!to.isMissingNode() && !to.isNull() && !(to.isTextual() && TO_AUDIENCE.equals(to.asText()))) {
            invalid = true;
        }
        return new Step(integer(s, "after"), text(s, "channel"), text(s, "template"), recipients, invalid,
                integer(s, "waitForReply"), text(s, "onReply"), text(s, "connection"));
    }

    private static Audience audience(JsonNode a) {
        return new Audience(text(a, "role"), text(a, "address"), text(a, "channel"), text(a, "name"),
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
