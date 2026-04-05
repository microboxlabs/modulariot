package com.microboxlabs.miot.tracking.service.impl;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.microboxlabs.miot.core.auth.TenantContext;
import com.microboxlabs.miot.tracking.errors.PublishPulsarError;
import com.microboxlabs.miot.tracking.service.AssetTrackingService;
import io.quarkus.arc.lookup.LookupIfProperty;
import jakarta.annotation.PreDestroy;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.time.Instant;
import java.util.concurrent.TimeUnit;
import org.apache.pulsar.client.api.Producer;
import org.apache.pulsar.client.api.PulsarClient;
import org.apache.pulsar.client.api.PulsarClientException;
import org.apache.pulsar.client.api.Schema;
import org.eclipse.microprofile.config.inject.ConfigProperty;
import org.jboss.logging.Logger;

@ApplicationScoped
@LookupIfProperty(name = "miot.component.tracking.enabled", stringValue = "true")
public class PulsarAssetTrackingService implements AssetTrackingService {

    private static final Logger logger = Logger.getLogger(PulsarAssetTrackingService.class);

    @Inject
    TenantContext tenantContext;

    @Inject
    ObjectMapper objectMapper;

    @ConfigProperty(name = "pulsar.client.serviceUrl", defaultValue = "pulsar://localhost:6650")
    String pulsarServiceUrl;

    @ConfigProperty(name = "miot.tracking.pulsar.topic",
            defaultValue = "persistent://streamhub/tracking/asset-positions")
    String topic;

    private volatile PulsarClient client;
    private volatile Producer<String> producer;

    private Producer<String> getProducer() {
        if (producer == null) {
            synchronized (this) {
                if (producer == null) {
                    try {
                        client = PulsarClient.builder()
                                .serviceUrl(pulsarServiceUrl)
                                .connectionTimeout(5, TimeUnit.SECONDS)
                                .operationTimeout(10, TimeUnit.SECONDS)
                                .build();
                        producer = client.newProducer(Schema.STRING)
                                .topic(topic)
                                .create();
                        logger.infof("Pulsar producer created for topic: %s", topic);
                    } catch (PulsarClientException e) {
                        throw new PublishPulsarError("Failed to create Pulsar producer", e);
                    }
                }
            }
        }
        return producer;
    }

    @PreDestroy
    void close() {
        try {
            if (producer != null) producer.close();
            if (client != null) client.close();
        } catch (PulsarClientException e) {
            logger.warn("Error closing Pulsar client", e);
        }
    }

    @Override
    public void trackAsset(AssetTrackingData message, String requestId, Instant requestTimestamp) {
        String clientId = tenantContext.getClientId();
        if (clientId == null || clientId.isBlank()) {
            throw new PublishPulsarError("Client ID is required");
        }

        var envelopedMessage = new EnvelopedMessage();
        envelopedMessage.setRequestId(requestId);
        envelopedMessage.setTimestamp(requestTimestamp);
        envelopedMessage.setPayload(message);
        envelopedMessage.setClientId(clientId);

        try {
            String json = objectMapper.writeValueAsString(envelopedMessage);
            getProducer().sendAsync(json).whenComplete((msgId, exception) -> {
                if (exception == null) {
                    logger.debugf("Message sent successfully. Request ID: %s, Message ID: %s",
                            requestId, msgId);
                } else {
                    logger.errorf(exception, "Failed to send message. Request ID: %s", requestId);
                }
            });
        } catch (PublishPulsarError e) {
            throw e;
        } catch (Exception e) {
            logger.errorf(e, "Serialization failed for message. Request ID: %s", requestId);
            throw new PublishPulsarError("Serialization failed", e);
        }
    }
}
