package com.microboxlabs.miot.core.messaging;

import io.quarkus.arc.DefaultBean;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import org.jboss.logging.Logger;

/**
 * Default (standalone) message publisher that logs messages without sending them.
 * Used when no external broker is configured ({@code miot.messaging.type=log} or unset).
 */
@ApplicationScoped
@DefaultBean
public class LogMessagePublisher implements IMessagePublisher {

    private static final Logger LOG = Logger.getLogger(LogMessagePublisher.class);

    @Override
    public <T> CompletionStage<Void> publish(String topic, T message) {
        LOG.debugf("[log-publisher] topic=%s, payload=%s", topic, message);
        return CompletableFuture.completedFuture(null);
    }

    @Override
    public <T> CompletionStage<Void> publish(String topic, String key, T message) {
        LOG.debugf("[log-publisher] topic=%s, key=%s, payload=%s", topic, key, message);
        return CompletableFuture.completedFuture(null);
    }
}
