package com.microboxlabs.miot.integrations.retransmit;

import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
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
 * Pulsar consumer for {@code asset-positions-enriched}. Enqueues retransmit
 * outbox rows then ACKs so slow HTTP destinations never block the topic.
 *
 * <p>Started from {@link com.microboxlabs.miot.integrations.IntegrationsComponent}
 * when {@code miot.integrations.retransmit.worker.enabled=true}.
 */
@ApplicationScoped
public class EnrichedPositionRetransmitConsumer {

    private static final Logger LOG = Logger.getLogger(EnrichedPositionRetransmitConsumer.class);

    private final RetransmitMatchService matchService;
    private final boolean workerEnabled;
    private final String serviceUrl;
    private final String topic;
    private final String subscription;

    private final ReentrantLock clientLock = new ReentrantLock();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private PulsarClient client;
    private Consumer<byte[]> consumer;
    private Thread consumerThread;

    EnrichedPositionRetransmitConsumer(
            RetransmitMatchService matchService,
            @ConfigProperty(name = "miot.integrations.retransmit.worker.enabled", defaultValue = "false")
                    boolean workerEnabled,
            @ConfigProperty(
                            name = "miot.integrations.retransmit.pulsar.service-url",
                            defaultValue = "pulsar://localhost:6650")
                    String serviceUrl,
            @ConfigProperty(
                            name = "miot.integrations.retransmit.pulsar.topic",
                            defaultValue = "persistent://streamhub/tracking/asset-positions-enriched")
                    String topic,
            @ConfigProperty(
                            name = "miot.integrations.retransmit.pulsar.subscription",
                            defaultValue = "miot-retransmit-worker")
                    String subscription) {
        this.matchService = matchService;
        this.workerEnabled = workerEnabled;
        this.serviceUrl = serviceUrl;
        this.topic = topic;
        this.subscription = subscription;
    }

    public boolean isEnabled() {
        return workerEnabled;
    }

    public void start() {
        if (!workerEnabled) {
            LOG.info("Retransmit worker disabled (miot.integrations.retransmit.worker.enabled=false)");
            return;
        }
        if (!running.compareAndSet(false, true)) {
            LOG.warn("Retransmit Pulsar consumer already running");
            return;
        }
        consumerThread = new Thread(this::consumeLoop, "pulsar-retransmit-consumer");
        consumerThread.setDaemon(true);
        consumerThread.start();
        LOG.infof("Retransmit Pulsar consumer starting — topic=%s subscription=%s", topic, subscription);
    }

    private void consumeLoop() {
        // Keep the worker alive across transient Pulsar outages (startup or mid-run).
        while (running.get()) {
            Consumer<byte[]> c;
            try {
                c = getConsumer();
            } catch (PulsarClientException e) {
                LOG.errorf(e, "Failed to create retransmit Pulsar consumer; retry in 5s");
                sleep(5000);
                continue;
            }

            while (running.get()) {
                receiveAndProcess(c);
            }
        }
    }

    private void receiveAndProcess(Consumer<byte[]> c) {
        try {
            Message<byte[]> msg = c.receive(1, TimeUnit.SECONDS);
            if (msg == null) {
                return;
            }
            processMessage(c, msg);
        } catch (PulsarClientException e) {
            if (running.get()) {
                LOG.errorf(e, "Retransmit Pulsar receive error, retrying in 5s");
                sleep(5000);
            }
        }
    }

    private void processMessage(Consumer<byte[]> c, Message<byte[]> msg) {
        try {
            String raw = new String(msg.getValue(), StandardCharsets.UTF_8);
            // Metadata only at INFO — full GPS body is PII / log-volume risk.
            LOG.infof(
                    "RETRANSMIT_RX topic=%s key=%s size=%d",
                    msg.getTopicName(),
                    msg.getKey(),
                    msg.getValue() == null ? 0 : msg.getValue().length);
            matchService.processEnrichedMessage(raw);
            c.acknowledge(msg);
        } catch (Exception e) {
            LOG.errorf(e, "Retransmit processing failed; will reconsume later");
            nack(c, msg);
        }
    }

    private void nack(Consumer<byte[]> c, Message<byte[]> msg) {
        try {
            c.negativeAcknowledge(msg);
        } catch (Exception e) {
            LOG.errorf(e, "Failed to NACK retransmit message");
        }
    }

    private Consumer<byte[]> getConsumer() throws PulsarClientException {
        clientLock.lock();
        try {
            if (consumer == null) {
                if (client == null) {
                    client = PulsarClient.builder()
                            .serviceUrl(serviceUrl)
                            .connectionTimeout(5, TimeUnit.SECONDS)
                            .operationTimeout(10, TimeUnit.SECONDS)
                            .build();
                    LOG.infof("Retransmit Pulsar client connected to %s", serviceUrl);
                }
                consumer = client.newConsumer(Schema.BYTES)
                        .topic(topic)
                        .subscriptionName(subscription)
                        .subscriptionType(SubscriptionType.Shared)
                        .subscriptionInitialPosition(SubscriptionInitialPosition.Latest)
                        .subscribe();
                LOG.infof("Retransmit Pulsar subscribed to %s", topic);
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
                LOG.warn("Error closing retransmit Pulsar consumer", e);
            }
        }
        if (client != null) {
            try {
                client.close();
            } catch (PulsarClientException e) {
                LOG.warn("Error closing retransmit Pulsar client", e);
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
