package com.microboxlabs.miot.symptoms.signal;

import io.quarkus.arc.properties.IfBuildProperty;
import io.smallrye.mutiny.Multi;
import io.smallrye.mutiny.subscription.BackPressureStrategy;
import io.smallrye.mutiny.subscription.MultiEmitter;
import io.smallrye.reactive.messaging.pulsar.PulsarOutgoingMessageMetadata;
import jakarta.enterprise.context.ApplicationScoped;
import java.util.concurrent.CompletableFuture;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.eclipse.microprofile.reactive.messaging.Metadata;
import org.eclipse.microprofile.reactive.messaging.Outgoing;

/**
 * The {@code device-signals} channel: the GPS signals topic, written by {@link DeviceEvents}. {@link #publish} waits
 * until the broker took the message. When the channel is disabled nothing subscribes, and publishing fails.
 */
@ApplicationScoped
@IfBuildProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class DeviceSignalChannel {

    private volatile MultiEmitter<? super Message<String>> emitter;

    @Outgoing("device-signals")
    public Multi<Message<String>> signals() {
        return Multi.createFrom().emitter(e -> emitter = e, BackPressureStrategy.BUFFER);
    }

    /** Publishes the signal keyed by vehicle; throws {@link DeviceEvents.UnavailableException} when it was not taken. */
    public void publish(String assetId, String json) {
        MultiEmitter<? super Message<String>> e = emitter;
        if (e == null || e.isCancelled()) {
            throw new DeviceEvents.UnavailableException("the signals channel is not connected");
        }
        CompletableFuture<Void> taken = new CompletableFuture<>();
        e.emit(Message.of(json, Metadata.of(PulsarOutgoingMessageMetadata.builder().withKey(assetId).build()),
                () -> {
                    taken.complete(null);
                    return CompletableFuture.completedFuture(null);
                },
                failure -> {
                    taken.completeExceptionally(failure);
                    return CompletableFuture.completedFuture(null);
                }));
        try {
            // A local deadline cannot cancel an emitted message. Keep its receipt pending until the
            // connector acknowledges or rejects it; its producer send timeout bounds broker failures.
            taken.join();
        } catch (java.util.concurrent.CompletionException ex) {
            throw new DeviceEvents.UnavailableException("the signals topic did not take the event");
        }
    }
}
