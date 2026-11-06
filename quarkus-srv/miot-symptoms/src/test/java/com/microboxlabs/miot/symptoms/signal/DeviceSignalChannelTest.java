package com.microboxlabs.miot.symptoms.signal;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import io.smallrye.reactive.messaging.pulsar.PulsarOutgoingMessageMetadata;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.ExecutionException;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;
import java.util.concurrent.TimeoutException;
import java.util.concurrent.atomic.AtomicReference;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.junit.jupiter.api.Test;

class DeviceSignalChannelTest {

    @Test
    void aDelayedAcknowledgementKeepsThePublicationPending() throws Exception {
        DeviceSignalChannel channel = new DeviceSignalChannel();
        CountDownLatch emitted = new CountDownLatch(1);
        AtomicReference<Message<String>> pending = new AtomicReference<>();
        var subscription = channel.signals().subscribe().with(message -> {
            pending.set(message);
            emitted.countDown();
        });
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var sent = executor.submit(() -> channel.publish("V1", "event"));
            try {
                assertTrue(emitted.await(5, TimeUnit.SECONDS));
                assertEquals("V1", pending.get().getMetadata(PulsarOutgoingMessageMetadata.class).orElseThrow().getKey());
                assertThrows(TimeoutException.class, () -> sent.get(11, TimeUnit.SECONDS),
                        "the old ten-second deadline must not release a message that can still be delivered");
                pending.get().ack().toCompletableFuture().join();
                sent.get(5, TimeUnit.SECONDS);
            } finally {
                if (pending.get() != null) {
                    pending.get().ack();
                }
            }
        } finally {
            subscription.cancel();
        }
    }

    @Test
    void aNegativeAcknowledgementFailsPublication() throws Exception {
        DeviceSignalChannel channel = new DeviceSignalChannel();
        var subscription = channel.signals().subscribe().with(message ->
                message.nack(new IllegalStateException("rejected")));
        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            var sent = executor.submit(() -> channel.publish("V1", "event"));
            ExecutionException failure = assertThrows(ExecutionException.class, () -> sent.get(5, TimeUnit.SECONDS));
            assertTrue(failure.getCause() instanceof DeviceEvents.UnavailableException);
        } finally {
            subscription.cancel();
        }
    }

    @Test
    void anUnconnectedChannelRejectsPublication() {
        assertThrows(DeviceEvents.UnavailableException.class, () -> new DeviceSignalChannel().publish("V1", "event"));
    }
}
