package com.microboxlabs.miot.conversational.rules;

import java.time.Instant;
import java.util.List;

/**
 * An event type a system outside the modulith publishes to an organization's rules, through the
 * {@code conversation.event} job. The system declares its types first ({@code conversation.events.declare}); the
 * rule editor lists them with the in-process ones, and only declared types are accepted.
 *
 * @param source      the producer, such as {@code erp}; every type it declares starts with {@code source.}
 * @param contextKind what its events are about, such as {@code service}; null when they have no context
 * @param fields      the fields of its payload, which are the template variables
 */
public record ExternalEventType(String tenantCode, String source, String type, String contextKind,
        String description, List<EventCatalog.Field> fields, Instant updatedAt) {

    public ExternalEventType {
        fields = fields == null ? List.of() : List.copyOf(fields);
    }

    /** The type as the event catalog lists it. */
    public EventCatalog.EventTypeView view() {
        return new EventCatalog.EventTypeView(type, source, description, contextKind, fields,
                EventCatalog.variables(fields));
    }
}
