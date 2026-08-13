package com.microboxlabs.miot.symptoms.consumer;

import com.microboxlabs.miot.symptoms.metrics.SymptomMetrics;
import com.microboxlabs.miot.symptoms.process.ProcessOutcome;
import com.microboxlabs.miot.symptoms.process.SymptomProcessor;
import com.microboxlabs.miot.symptoms.route.RouteTableHolder;
import io.quarkus.arc.properties.UnlessBuildProperty;
import io.vertx.core.json.JsonObject;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import java.util.Locale;
import java.util.Optional;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.atomic.AtomicBoolean;
import java.util.concurrent.locks.ReentrantLock;
import org.apache.pulsar.client.api.Consumer;
import org.apache.pulsar.client.api.DeadLetterPolicy;
import org.apache.pulsar.client.api.Message;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.PulsarClientException;
import org.apache.pulsar.client.api.Schema;
import org.apache.pulsar.client.api.SubscriptionInitialPosition;
import org.apache.pulsar.client.api.SubscriptionType;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

/**
 * Shared consumer on {@code accumulated_states} CDC. Subscription is
 * {@link SubscriptionInitialPosition#Latest} and must stay that way — Earliest
 * would replay the topic through {@code process_symptoms_*}.
 *
 * <p>Omitted from native images (same reason as the retransmit worker).
 */
@ApplicationScoped
@UnlessBuildProperty(name = "quarkus.native.enabled", stringValue = "true")
public class PulsarSymptomsConsumer {

    private static final Logger LOG = Logger.getLogger(PulsarSymptomsConsumer.class);

    private final SymptomProcessor processor;
    private final RouteTableHolder routes;
    private final SymptomMetrics metrics;
    private final String serviceUrl;
    private final String topic;
    private final String subscription;
    private final String initialPosition;
    private final int receiverQueueSize;
    private final Optional<String> deadLetterTopic;

    private final ReentrantLock clientLock = new ReentrantLock();
    private final AtomicBoolean running = new AtomicBoolean(false);
    private PulsarClient client;
    private Consumer<byte[]> consumer;
    private Thread consumerThread;

    PulsarSymptomsConsumer(
            SymptomProcessor processor,
            RouteTableHolder routes,
            SymptomMetrics metrics,
            @ConfigProperty(name = "miot.symptoms.pulsar.service-url", defaultValue = "pulsar://localhost:6650")
                    String serviceUrl,
            @ConfigProperty(
                            name = "miot.symptoms.pulsar.topic",
                            defaultValue =
                                    "persistent://streamhub/debezium/streamhub-prod.public.accumulated_states")
                    String topic,
            @ConfigProperty(name = "miot.symptoms.pulsar.subscription", defaultValue = "miot-symptoms-dispatcher")
                    String subscription,
            @ConfigProperty(name = "miot.symptoms.pulsar.subscription-initial-position", defaultValue = "Latest")
                    String initialPosition,
            @ConfigProperty(name = "miot.symptoms.pulsar.receiver-queue-size", defaultValue = "32")
                    int receiverQueueSize,
            @ConfigProperty(name = "miot.symptoms.pulsar.dead-letter-topic") Optional<String> deadLetterTopic) {
        this.processor = processor;
        this.routes = routes;
        this.metrics = metrics;
        this.serviceUrl = serviceUrl;
        this.topic = topic;
        this.subscription = subscription;
        this.initialPosition = initialPosition;
        this.receiverQueueSize = receiverQueueSize;
        this.deadLetterTopic = deadLetterTopic;
    }

    public void start() {
        if (routes.get().isEmpty()) {
            LOG.info("Symptoms RouteTable is empty — Pulsar consumer not started");
            return;
        }
        if (!"Latest".equalsIgnoreCase(initialPosition)) {
            throw new IllegalStateException(
                    "miot.symptoms.pulsar.subscription-initial-position must be Latest, was "
                            + initialPosition);
        }
        if (!running.compareAndSet(false, true)) {
            LOG.warn("Symptoms Pulsar consumer already running");
            return;
        }
        consumerThread = new Thread(this::consumeLoop, "pulsar-symptoms-consumer");
        consumerThread.setDaemon(true);
        consumerThread.start();
        LOG.infof("Symptoms Pulsar consumer started — topic=%s sub=%s", topic, subscription);
    }

    public boolean isRunning() {
        return running.get();
    }

    private void consumeLoop() {
        Consumer<byte[]> c = initConsumer();
        if (c == null) {
            running.set(false);
            return;
        }
        while (running.get()) {
            receiveAndProcess(c);
        }
    }

    private Consumer<byte[]> initConsumer() {
        try {
            return getConsumer();
        } catch (PulsarClientException e) {
            LOG.errorf(e, "Failed to create symptoms Pulsar consumer");
            return null;
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
                LOG.errorf(e, "Symptoms Pulsar receive error, retrying in 5s");
                sleep(5000);
            }
        }
    }

    private void processMessage(Consumer<byte[]> c, Message<byte[]> msg) {
        JsonObject payload;
        try {
            payload = new JsonObject(new String(msg.getValue(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            LOG.errorf(e, "Symptoms MESSAGE_PARSE_ERROR");
            nack(c, msg);
            return;
        }
        processor.process(payload)
                .subscribe()
                .with(
                        outcome -> {
                            metrics.record(outcome);
                            ack(c, msg);
                        },
                        err -> {
                            metrics.recordError(null);
                            LOG.errorf(err, "Symptoms processing failed");
                            nack(c, msg);
                        });
    }

    private void ack(Consumer<byte[]> c, Message<byte[]> msg) {
        try {
            c.acknowledge(msg);
        } catch (PulsarClientException e) {
            LOG.errorf(e, "Failed to ACK symptoms message");
        }
    }

    private void nack(Consumer<byte[]> c, Message<byte[]> msg) {
        try {
            c.reconsumeLater(msg, 30, TimeUnit.SECONDS);
        } catch (PulsarClientException e) {
            LOG.errorf(e, "Failed to NACK symptoms message");
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
                }
                var dlq = DeadLetterPolicy.builder().maxRedeliverCount(2);
                deadLetterTopic.filter(t -> !t.isBlank()).ifPresent(dlq::deadLetterTopic);
                consumer = client.newConsumer(Schema.BYTES)
                        .topic(topic)
                        .subscriptionName(subscription)
                        .subscriptionType(SubscriptionType.Shared)
                        .subscriptionInitialPosition(SubscriptionInitialPosition.Latest)
                        .receiverQueueSize(receiverQueueSize)
                        .deadLetterPolicy(dlq.build())
                        .subscribe();
                LOG.infof(
                        "Symptoms subscribed %s as %s (%s)",
                        topic, subscription, initialPosition.toUpperCase(Locale.ROOT));
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
                LOG.warn("Error closing symptoms Pulsar consumer", e);
            }
        }
        if (client != null) {
            try {
                client.close();
            } catch (PulsarClientException e) {
                LOG.warn("Error closing symptoms Pulsar client", e);
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
