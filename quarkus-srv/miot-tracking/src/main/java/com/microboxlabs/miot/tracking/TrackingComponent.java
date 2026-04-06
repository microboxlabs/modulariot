package com.microboxlabs.miot.tracking;

import cl.streamhub.gps.model.EnvelopedMessage;
import com.microboxlabs.miot.core.config.IMiotComponent;
import com.microboxlabs.miot.core.messaging.IComponentBus;
import com.microboxlabs.miot.tracking.consumer.PulsarAssetTrackingConsumer;
import com.microboxlabs.miot.tracking.persistence.AssetTrackingProcessor;
import com.microboxlabs.miot.tracking.service.impl.PulsarAssetTrackingService;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.enterprise.inject.Instance;
import org.eclipse.microprofile.health.HealthCheck;
import org.eclipse.microprofile.health.HealthCheckResponse;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.tracking.enabled", stringValue = "true")
public class TrackingComponent implements IMiotComponent {

    private static final Logger LOG = Logger.getLogger(TrackingComponent.class);

    private final IComponentBus componentBus;
    private final AssetTrackingProcessor processor;
    private final Instance<PulsarAssetTrackingConsumer> pulsarConsumer;

    TrackingComponent(IComponentBus componentBus, AssetTrackingProcessor processor,
            Instance<PulsarAssetTrackingConsumer> pulsarConsumer) {
        this.componentBus = componentBus;
        this.processor = processor;
        this.pulsarConsumer = pulsarConsumer;
    }

    @Override
    public String name() {
        return "tracking";
    }

    @Override
    public int priority() {
        return 200;
    }

    @Override
    public void onStart() {
        if (pulsarConsumer.isResolvable()) {
            // Distributed mode: Pulsar consumer is the sole processor
            pulsarConsumer.get().start();
            LOG.info("Tracking component started — Pulsar consumer active");
        } else {
            // Standalone mode: subscribe to in-process bus for persistence
            componentBus.subscribe(PulsarAssetTrackingService.BUS_CHANNEL, EnvelopedMessage.class,
                    msg -> processor.process(msg)
                            .subscribe().with(
                                    v -> LOG.debugf("Persisted asset tracking for %s",
                                            msg.getPayload().getAssetId()),
                                    e -> LOG.errorf(e, "Failed to persist asset tracking for %s",
                                            msg.getPayload().getAssetId())));
            LOG.info("Tracking component started — bus subscriber active");
        }
    }

    @Override
    public void onStop() {
        LOG.info("Tracking component stopped");
    }

    @Override
    public HealthCheck healthCheck() {
        return () -> HealthCheckResponse.named("tracking").up().build();
    }
}
