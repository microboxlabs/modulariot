package com.microboxlabs.miot.core.event;

import java.time.Instant;
import java.util.Objects;

/**
 * A fact a producer publishes in-process (CDI), such as {@code symptom.case.opened}. Producers fire it with
 * {@code Event.fireAsync}; observers use {@code @ObservesAsync}.
 *
 * @param type       what happened, one of the types the producer's {@link EventTypeCatalog} declares
 * @param source     the producer, such as {@code miot-symptoms}
 * @param tenantCode the organization it happened in
 * @param at         when it happened
 * @param context    what it is about
 * @param data       the payload, of the class the catalog declares for {@code type}
 * @param test       raised by something in test (such as a TEST symptom); rules in force ignore it
 */
public record OperationalEvent(String type, String source, String tenantCode, Instant at, EventContext context,
        Object data, boolean test) {

    public OperationalEvent {
        Objects.requireNonNull(type, "type");
        Objects.requireNonNull(source, "source");
        Objects.requireNonNull(tenantCode, "tenantCode");
        Objects.requireNonNull(at, "at");
        Objects.requireNonNull(context, "context");
    }
}
