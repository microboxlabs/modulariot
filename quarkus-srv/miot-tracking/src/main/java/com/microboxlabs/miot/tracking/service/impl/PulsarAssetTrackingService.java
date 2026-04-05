package com.microboxlabs.miot.tracking.service.impl;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.core.messaging.IMessagePublisher;
import com.microboxlabs.miot.tracking.errors.PublishPulsarError;
import com.microboxlabs.miot.tracking.service.AssetTrackingService;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.enterprise.context.ApplicationScoped;
import java.time.Instant;
import java.util.concurrent.CompletionStage;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.tracking.enabled", stringValue = "true")
public class PulsarAssetTrackingService implements AssetTrackingService {

    private static final Logger logger = Logger.getLogger(PulsarAssetTrackingService.class);

    private final TenantContext tenantContext;
    private final IMessagePublisher publisher;
    private final String topic;

    PulsarAssetTrackingService(
            TenantContext tenantContext,
            IMessagePublisher publisher,
            @ConfigProperty(name = "miot.tracking.pulsar.topic",
                    defaultValue = "persistent://streamhub/tracking/asset-positions")
                    String topic) {
        this.tenantContext = tenantContext;
        this.publisher = publisher;
        this.topic = topic;
    }

    @Override
    public CompletionStage<Void> trackAsset(AssetTrackingData message, String requestId,
            Instant requestTimestamp) {
        String clientId = tenantContext.getClientId();
        if (clientId == null || clientId.isBlank()) {
            throw new PublishPulsarError("Client ID is required");
        }

        var envelope = new EnvelopedMessage();
        envelope.setRequestId(requestId);
        envelope.setTimestamp(requestTimestamp);
        envelope.setPayload(message);
        envelope.setClientId(clientId);

        return publisher.publish(topic, envelope)
                .thenAccept(v -> logger.debugf(
                        "Asset tracking sent. Request ID: %s, Client ID: %s",
                        requestId, clientId));
    }
}
