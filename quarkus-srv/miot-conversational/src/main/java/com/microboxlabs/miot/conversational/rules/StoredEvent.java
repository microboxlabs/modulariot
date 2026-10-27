package com.microboxlabs.miot.conversational.rules;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;

/** An operational event as the component stored it ({@code conv_event}); {@code data} is the payload as a map. */
public record StoredEvent(String id, String tenantCode, String type, String source, String contextKind,
        String contextKey, Map<String, Object> data, boolean test, Instant at, Instant receivedAt) {

    public StoredEvent {
        data = data == null ? Map.of() : data;
    }

    /** The {@code event} a rule's {@code when} reads: type, context, data, test and at (ISO). */
    public Map<String, Object> asCelEvent() {
        Map<String, Object> context = new LinkedHashMap<>();
        if (contextKind != null) {
            context.put("kind", contextKind);
        }
        if (contextKey != null) {
            context.put("key", contextKey);
        }
        Map<String, Object> event = new LinkedHashMap<>();
        event.put("type", type);
        event.put("context", context);
        event.put("data", data);
        event.put("test", test);
        event.put("at", at == null ? null : at.toString());
        return event;
    }
}
