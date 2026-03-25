package com.microboxlabs.miot.core.messaging;

import java.util.function.Consumer;

/**
 * Abstract messaging contract for inter-component communication.
 * Two implementations: in-process (Vert.x EventBus) and distributed (NATS/Kafka).
 */
public interface IComponentBus {

    <T> void publish(String channel, T event);

    <T> void subscribe(String channel, Class<T> type, Consumer<T> handler);
}
