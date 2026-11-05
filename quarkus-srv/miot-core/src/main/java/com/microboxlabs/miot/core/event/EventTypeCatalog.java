package com.microboxlabs.miot.core.event;

import java.util.List;

/**
 * The event types a producer publishes. A producer exposes one as a CDI bean; readers take every bean of this
 * type, so nobody writes the list by hand.
 */
public interface EventTypeCatalog {

    /**
     * @param type        such as {@code symptom.case.opened}
     * @param description what it means, for the rule editor
     * @param data        the payload's class; its fields and their {@code @Schema} are the event's variables
     */
    record EventType(String type, String description, Class<?> data) {
    }

    /** The producer, as {@link OperationalEvent#source()} names it. */
    String source();

    /** The context kind of the producer's events, such as {@code symptom_case}; null when they have none. */
    default String contextKind() {
        return null;
    }

    List<EventType> types();

    /** True when the producer also publishes its events to the platform's tenant, for the platform's own rules. */
    default boolean platform() {
        return false;
    }
}
