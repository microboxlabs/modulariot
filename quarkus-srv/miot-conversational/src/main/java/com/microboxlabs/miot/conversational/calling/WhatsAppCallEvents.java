package com.microboxlabs.miot.conversational.calling;

import io.vertx.core.json.JsonArray;
import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads the {@code calls} webhook field ({@code entry[].changes[].value.calls[]}) and the user's answers to a
 * permission request ({@code messages[]} of type {@code interactive.call_permission_reply}). Pure: nothing is
 * stored. Not wired to the webhook while calling is off.
 */
public final class WhatsAppCallEvents {

    /**
     * One call event: {@code connect} carries Meta's SDP answer; {@code terminate} carries the status and
     * the duration in seconds.
     */
    public record CallEvent(String phoneNumberId, String callId, String event, String from, String to,
            String status, Integer durationSeconds, String sdpType, String sdp, Instant at) {
    }

    /** The user's answer; {@code expiresAt} null when the permission is permanent or rejected. */
    public record PermissionReply(String phoneNumberId, String from, boolean accepted, boolean permanent,
            Instant expiresAt, Instant at) {
    }

    private WhatsAppCallEvents() {
    }

    public static List<CallEvent> calls(JsonObject payload) {
        List<CallEvent> out = new ArrayList<>();
        forEachValue(payload, "calls", (phone, value) -> {
            JsonArray calls = value.getJsonArray("calls");
            for (int i = 0; calls != null && i < calls.size(); i++) {
                JsonObject c = calls.getJsonObject(i);
                JsonObject session = c.getJsonObject("session", new JsonObject());
                out.add(new CallEvent(phone, c.getString("id"), c.getString("event"), c.getString("from"),
                        c.getString("to"), c.getString("status"), integer(c.getValue("duration")),
                        session.getString("sdp_type"), session.getString("sdp"), seconds(c.getValue("timestamp"))));
            }
        });
        return out;
    }

    public static List<PermissionReply> permissionReplies(JsonObject payload) {
        List<PermissionReply> out = new ArrayList<>();
        forEachValue(payload, "messages", (phone, value) -> {
            JsonArray messages = value.getJsonArray("messages");
            for (int i = 0; messages != null && i < messages.size(); i++) {
                JsonObject m = messages.getJsonObject(i);
                JsonObject interactive = m.getJsonObject("interactive");
                if (interactive == null || !"call_permission_reply".equals(interactive.getString("type"))) {
                    continue;
                }
                JsonObject reply = interactive.getJsonObject("call_permission_reply", new JsonObject());
                out.add(new PermissionReply(phone, m.getString("from"), "accept".equals(reply.getString("response")),
                        Boolean.TRUE.equals(reply.getBoolean("is_permanent")),
                        seconds(reply.getValue("expiration_timestamp")), seconds(m.getValue("timestamp"))));
            }
        });
        return out;
    }

    private interface ValueVisitor {
        void visit(String phoneNumberId, JsonObject value);
    }

    private static void forEachValue(JsonObject payload, String field, ValueVisitor visitor) {
        JsonArray entries = payload == null ? null : payload.getJsonArray("entry");
        for (int e = 0; entries != null && e < entries.size(); e++) {
            JsonArray changes = entries.getJsonObject(e).getJsonArray("changes");
            for (int c = 0; changes != null && c < changes.size(); c++) {
                JsonObject change = changes.getJsonObject(c);
                JsonObject value = change.getJsonObject("value");
                if (value == null || !field.equals(change.getString("field"))) {
                    continue;
                }
                JsonObject metadata = value.getJsonObject("metadata", new JsonObject());
                visitor.visit(metadata.getString("phone_number_id"), value);
            }
        }
    }

    private static Integer integer(Object value) {
        if (value instanceof Number n) {
            return n.intValue();
        }
        try {
            return value == null ? null : Integer.valueOf(value.toString());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    /** Meta sends Unix seconds, as a number or as a string. */
    private static Instant seconds(Object value) {
        if (value instanceof Number n) {
            return Instant.ofEpochSecond(n.longValue());
        }
        try {
            return value == null ? null : Instant.ofEpochSecond(Long.parseLong(value.toString()));
        } catch (NumberFormatException e) {
            return null;
        }
    }
}
