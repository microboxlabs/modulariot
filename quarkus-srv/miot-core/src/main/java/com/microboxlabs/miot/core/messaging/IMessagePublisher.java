package com.microboxlabs.miot.core.messaging;

import java.util.concurrent.CompletionStage;

/**
 * Abstraction for publishing messages to external systems (Pulsar, Kafka, etc.).
 *
 * <p>Unlike {@link IComponentBus} (which is for in-process, component-to-component events),
 * this interface targets external message brokers consumed by downstream services.
 *
 * <p>The default implementation ({@link LogMessagePublisher}) logs messages without sending
 * them, allowing standalone operation without a broker. Production deployments provide a
 * concrete implementation (e.g. Pulsar) selected via {@code miot.messaging.type}.
 */
public interface IMessagePublisher {

    /**
     * Publish a message to a named topic.
     *
     * @param topic the destination topic (e.g. "streamhub/tracking/asset-positions")
     * @param message the payload object (serialized to JSON by the implementation)
     * @return a stage that completes when the broker acknowledges the message
     */
    <T> CompletionStage<Void> publish(String topic, T message);

    /**
     * Publish a message with a routing key for partitioned topics.
     *
     * @param topic the destination topic
     * @param key routing key (used for partition assignment)
     * @param message the payload object
     * @return a stage that completes when the broker acknowledges the message
     */
    <T> CompletionStage<Void> publish(String topic, String key, T message);
}
