package com.microboxlabs.miot.symptoms.consumer;

import com.microboxlabs.miot.symptoms.metrics.SymptomMetrics;
import com.microboxlabs.miot.symptoms.process.SymptomProcessor;
import io.quarkus.arc.lookup.LookupIfProperty;
import io.smallrye.mutiny.Uni;
import io.vertx.core.json.JsonObject;
import jakarta.enterprise.context.ApplicationScoped;
import java.nio.charset.StandardCharsets;
import org.eclipse.microprofile.reactive.messaging.Incoming;
import org.eclipse.microprofile.reactive.messaging.Message;
import org.jboss.logging.Logger;

/**
 * SmallRye Pulsar incoming channel for {@code accumulated_states} CDC.
 *
 * <p>Subscription, Latest, Shared, DLQ and receiver queue are connector
 * config ({@code mp.messaging.incoming.symptoms-cdc.*}), not a hand-rolled
 * client/thread. Unowned {@code rule_id}s are skipped (acked) so this
 * subscription can exist while old Helm pods still own those rules.
 *
 * <p>Present only when {@code miot.component.symptoms.enabled=true}.
 */
@ApplicationScoped
@LookupIfProperty(name = "miot.component.symptoms.enabled", stringValue = "true")
public class SymptomsCdcConsumer {

    private static final Logger LOG = Logger.getLogger(SymptomsCdcConsumer.class);

    private final SymptomProcessor processor;
    private final SymptomMetrics metrics;

    SymptomsCdcConsumer(SymptomProcessor processor, SymptomMetrics metrics) {
        this.processor = processor;
        this.metrics = metrics;
    }

    @Incoming("symptoms-cdc")
    public Uni<Void> onMessage(Message<byte[]> message) {
        JsonObject payload;
        try {
            payload = new JsonObject(new String(message.getPayload(), StandardCharsets.UTF_8));
        } catch (Exception e) {
            LOG.errorf(e, "Symptoms MESSAGE_PARSE_ERROR");
            return Uni.createFrom().failure(e);
        }
        return processor
                .process(payload)
                .onItem()
                .invoke(metrics::record)
                .onFailure()
                .invoke(err -> {
                    metrics.recordError(null);
                    LOG.errorf(err, "Symptoms processing failed");
                })
                .replaceWithVoid();
    }
}
