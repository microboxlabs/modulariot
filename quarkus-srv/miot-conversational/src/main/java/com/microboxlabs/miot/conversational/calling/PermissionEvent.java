package com.microboxlabs.miot.conversational.calling;

import com.microboxlabs.miot.conversational.service.CallEvent;
import com.microboxlabs.miot.conversational.service.CallPermissionReply;
import io.vertx.core.json.JsonObject;
import java.time.Instant;
import java.time.OffsetDateTime;

/** Minimal durable journal entry. Never stores call media, connection secrets or SDP. */
public record PermissionEvent(String id, Instant occurredAt, CallEvent call, CallPermissionReply reply) {
    private static final String EXPIRES = "expires";

    static PermissionEvent call(CallEvent call, Instant fallback) {
        return new PermissionEvent("call:" + call.callId(), instant(call.timestamp(), fallback), call, null);
    }

    static PermissionEvent reply(CallPermissionReply reply, Instant fallback) {
        return new PermissionEvent("reply:" + reply.wamid(), instant(reply.timestamp(), fallback), null, reply);
    }

    public String number() { return call != null ? call.phoneNumberId() : reply.phoneNumberId(); }
    public String contact() { return call != null ? call.contactE164() : reply.contactE164(); }

    // At equal timestamps, replay calls before grants/revocations; a rejection wins a grant tie.
    int order() {
        if (call != null) return 0;
        return reply.accepted() ? 1 : 2;
    }

    CallPermission apply(CallPermission state) {
        return call != null ? CallPermissionPolicy.onCall(state, call, occurredAt)
                : CallPermissionPolicy.onReply(state, reply, occurredAt);
    }

    String json() {
        JsonObject out = new JsonObject().put("number", number()).put("contact", contact());
        if (call != null) {
            out.put("callId", call.callId()).put("event", call.event()).put("direction", call.direction())
                    .put("status", call.status()).put("connected", call.connected());
        } else {
            out.put("wamid", reply.wamid()).put("context", reply.contextMessageId()).put("accepted", reply.accepted())
                    .put("permanent", reply.permanent()).put(EXPIRES, text(reply.expiresAt()))
                    .put("source", reply.responseSource());
        }
        return out.encode();
    }

    static PermissionEvent read(String id, Instant at, String data) {
        JsonObject j = new JsonObject(data);
        String number = j.getString("number");
        String contact = j.getString("contact");
        OffsetDateTime timestamp = at.atOffset(java.time.ZoneOffset.UTC);
        if (id.startsWith("call:")) {
            return call(new CallEvent(number, j.getString("callId"), contact, j.getString("event"),
                    j.getString("direction"), j.getString("status"), j.getBoolean("connected"), timestamp), at);
        }
        OffsetDateTime expires = j.getString(EXPIRES) == null ? null : OffsetDateTime.parse(j.getString(EXPIRES));
        return reply(new CallPermissionReply(number, contact, j.getString("wamid"), j.getString("context"),
                j.getBoolean("accepted"), j.getBoolean("permanent"), expires, j.getString("source"), timestamp), at);
    }

    private static String text(OffsetDateTime time) { return time == null ? null : time.toString(); }
    private static Instant instant(OffsetDateTime time, Instant fallback) { return time == null ? fallback : time.toInstant(); }
}
