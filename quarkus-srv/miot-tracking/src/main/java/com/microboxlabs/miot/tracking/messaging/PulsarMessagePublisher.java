package com.microboxlabs.miot.tracking.messaging;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.concurrent.CompletableFuture;
import java.util.concurrent.CompletionStage;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.TimeUnit;
import org.apache.pulsar.client.api.Producer;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.PulsarClientException;
import org.apache.pulsar.client.api.Schema;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Pulsar-backed message publisher. Lazily creates client and producers
 * on first publish — no connection is attempted at startup.
 *
 * <p>Activated when {@code miot.messaging.type=pulsar}.
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.messaging.type", stringValue = "pulsar")
public class PulsarMessagePublisher implements IMessagePublisher {

    private static final Logger LOG = Logger.getLogger(PulsarMessagePublisher.class);

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "pulsar.client.serviceUrl", defaultValue = "pulsar://localhost:6650")
    String serviceUrl;

    private volatile PulsarClient client;
    private final ConcurrentHashMap<String, Producer<String>> producers = new ConcurrentHashMap<>();

    private PulsarClient getClient() throws PulsarClientException {
        if (client == null) {
            synchronized (this) {
                if (client == null) {
                    client = PulsarClient.builder()
                            .serviceUrl(serviceUrl)
                            .connectionTimeout(5, TimeUnit.SECONDS)
                            .operationTimeout(10, TimeUnit.SECONDS)
                            .build();
                    LOG.infof("Pulsar client connected to %s", serviceUrl);
                }
            }
        }
        return client;
    }

    private Producer<String> getProducer(String topic) throws PulsarClientException {
        Producer<String> producer = producers.get(topic);
        if (producer == null) {
            producer = getClient().newProducer(Schema.STRING)
                    .topic(topic)
                    .create();
            Producer<String> existing = producers.putIfAbsent(topic, producer);
            if (existing != null) {
                producer.close();
                producer = existing;
            } else {
                LOG.infof("Pulsar producer created for topic: %s", topic);
            }
        }
        return producer;
    }

    @PreDestroy
    void close() {
        producers.values().forEach(p -> {
            try {
                p.close();
            } catch (PulsarClientException e) {
                LOG.warn("Error closing Pulsar producer", e);
            }
        });
        if (client != null) {
            try {
                client.close();
            } catch (PulsarClientException e) {
                LOG.warn("Error closing Pulsar client", e);
            }
        }
    }

    @Override
    public <T> CompletionStage<Void> publish(String topic, T message) {
        return doPublish(topic, null, message);
    }

    @Override
    public <T> CompletionStage<Void> publish(String topic, String key, T message) {
        return doPublish(topic, key, message);
    }

    private <T> CompletionStage<Void> doPublish(String topic, String key, T message) {
        try {
            String json = objectMapper.writeValueAsString(message);
            var msgBuilder = getProducer(topic).newMessage().value(json);
            if (key != null) {
                msgBuilder.key(key);
            }
            return msgBuilder.sendAsync()
                    .thenAccept(msgId ->
                            LOG.debugf("Published to %s, msgId=%s", topic, msgId))
                    .exceptionally(ex -> {
                        LOG.errorf(ex, "Failed to publish to %s", topic);
                        return null;
                    });
        } catch (Exception e) {
            LOG.errorf(e, "Failed to serialize/publish to %s", topic);
            return CompletableFuture.failedFuture(e);
        }
    }
}
