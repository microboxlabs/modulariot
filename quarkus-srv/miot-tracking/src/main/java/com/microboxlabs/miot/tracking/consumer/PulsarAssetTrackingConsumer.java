package com.microboxlabs.miot.tracking.consumer;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.microboxlabs.miot.tracking.persistence.AssetTrackingProcessor;
import io.quarkus.arc.properties.IfBuildProperty;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import org.apache.pulsar.client.api.Consumer;
import org.apache.pulsar.client.api.Message;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.PulsarClientException;
import org.apache.pulsar.client.api.Schema;
import org.apache.pulsar.client.api.SubscriptionInitialPosition;
import org.apache.pulsar.client.api.SubscriptionType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Pulsar consumer for distributed mode. Receives asset tracking messages
 * from the Pulsar topic and delegates to {@link AssetTrackingProcessor}.
 *
 * <p>Activated only when {@code miot.messaging.type=pulsar}.
 * Follows the same lazy-initialization pattern as {@code PulsarMessagePublisher}.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.messaging.type", stringValue = "pulsar")
public class PulsarAssetTrackingConsumer {

    private static final Logger LOG = Logger.getLogger(PulsarAssetTrackingConsumer.class);

    private final AssetTrackingProcessor processor;
    private final String serviceUrl;
    private final String topic;
    private final String subscription;

    private final ReentrantLock clientLock = new ReentrantLock();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private PulsarClient client;
    private Consumer<String> consumer;
    private Thread consumerThread;

    PulsarAssetTrackingConsumer(
            AssetTrackingProcessor processor,
            @ConfigProperty(name = "pulsar.client.serviceUrl", defaultValue = "pulsar://localhost:6650")
                    String serviceUrl,
            @ConfigProperty(name = "miot.tracking.pulsar.topic",
                    defaultValue = "persistent://streamhub/tracking/asset-positions")
                    String topic,
            @ConfigProperty(name = "miot.tracking.pulsar.subscription",
                    defaultValue = "asset-positions-sub")
                    String subscription) {
        this.processor = processor;
        this.serviceUrl = serviceUrl;
        this.topic = topic;
        this.subscription = subscription;
    }

    /**
     * Starts the consumer loop on a daemon thread.
     * Called from {@code TrackingComponent.onStart()} when in distributed mode.
     */
    public void start() {
        if (!running.compareAndSet(false, true)) {
            LOG.warn("Pulsar consumer already running");
            return;
        }

        consumerThread = new Thread(this::consumeLoop, "pulsar-tracking-consumer");
        consumerThread.setDaemon(true);
        consumerThread.start();
        LOG.infof("Pulsar consumer started — topic: %s, subscription: %s", topic, subscription);
    }

    private void consumeLoop() {
        Consumer<String> c = initConsumer();
        if (c == null) return;

        while (running.get()) {
            receiveAndProcess(c);
        }
    }

    private Consumer<String> initConsumer() {
        try {
            return getConsumer();
        } catch (PulsarClientException e) {
            LOG.errorf(e, "Failed to create Pulsar consumer");
            return null;
        }
    }

    private void receiveAndProcess(Consumer<String> c) {
        try {
            Message<String> msg = c.receive(1, TimeUnit.SECONDS);
            if (msg == null) return;

            long startTime = System.currentTimeMillis();
            processMessage(c, msg, startTime);
        } catch (PulsarClientException e) {
            if (running.get()) {
                LOG.errorf(e, "Pulsar receive error, retrying in 5s");
                sleep(5000);
            }
        }
    }

    private void processMessage(Consumer<String> c, Message<String> msg, long startTime) {
        try {
            EnvelopedMessage envelope = EnvelopedMessage.fromJson(msg.getValue());

            processor.process(envelope)
                    .subscribe().with(
                            v -> acknowledgeMessage(c, msg, startTime),
                            e -> nackOnProcessingError(c, msg, startTime, e));
        } catch (Exception e) {
            LOG.errorf(e, "MESSAGE_PARSE_ERROR");
            nackMessage(c, msg);
        }
    }

    private void acknowledgeMessage(Consumer<String> c, Message<String> msg, long startTime) {
        try {
            c.acknowledge(msg);
            long ackTime = System.currentTimeMillis();
            LOG.infof("TOTAL_ACK_TIME: %d ms", ackTime - startTime);
        } catch (PulsarClientException e) {
            LOG.errorf(e, "Failed to ACK message");
        }
    }

    private void nackOnProcessingError(Consumer<String> c, Message<String> msg,
            long startTime, Throwable e) {
        long errorTime = System.currentTimeMillis();
        LOG.errorf(e, "PROCESSING_ERROR after %d ms. Error: %s",
                errorTime - startTime, e.getMessage());
        nackMessage(c, msg);
    }

    private void nackMessage(Consumer<String> c, Message<String> msg) {
        try {
            c.reconsumeLater(msg, 30, TimeUnit.SECONDS);
        } catch (PulsarClientException nackEx) {
            LOG.errorf(nackEx, "Failed to NACK message");
        }
    }

    private Consumer<String> getConsumer() throws PulsarClientException {
        clientLock.lock();
        try {
            if (consumer == null) {
                if (client == null) {
                    client = PulsarClient.builder()
                            .serviceUrl(serviceUrl)
                            .connectionTimeout(5, TimeUnit.SECONDS)
                            .operationTimeout(10, TimeUnit.SECONDS)
                            .build();
                    LOG.infof("Pulsar client connected to %s", serviceUrl);
                }
                consumer = client.newConsumer(Schema.STRING)
                        .topic(topic)
                        .subscriptionName(subscription)
                        .subscriptionType(SubscriptionType.Shared)
                        .subscriptionInitialPosition(SubscriptionInitialPosition.Latest)
                        .deadLetterPolicy(org.apache.pulsar.client.api.DeadLetterPolicy.builder()
                                .maxRedeliverCount(2)
                                .build())
                        .subscribe();
                LOG.infof("Pulsar consumer subscribed to %s", topic);
            }
            return consumer;
        } finally {
            clientLock.unlock();
        }
    }

    @PreDestroy
    void close() {
        running.set(false);
        if (consumerThread != null) {
            consumerThread.interrupt();
        }
        if (consumer != null) {
            try {
                consumer.close();
            } catch (PulsarClientException e) {
                LOG.warn("Error closing Pulsar consumer", e);
            }
        }
        if (client != null) {
            try {
                client.close();
            } catch (PulsarClientException e) {
                LOG.warn("Error closing Pulsar client", e);
            }
        }
    }

    private static void sleep(long millis) {
        try {
            Thread.sleep(millis);
        } catch (InterruptedException e) {
            Thread.currentThread().interrupt();
        }
    }
}
