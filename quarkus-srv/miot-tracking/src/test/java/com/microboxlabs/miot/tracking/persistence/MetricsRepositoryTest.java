package com.microboxlabs.miot.tracking.persistence;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

import cl.streamhub.gps.model.AssetTrackingData;
import cl.streamhub.gps.model.EnvelopedMessage;
import cl.streamhub.gps.model.metrics.MetricItem;
import cl.streamhub.gps.model.metrics.MetricsEnvelope;
import com.fasterxml.jackson.databind.ObjectMapper;
import java.util.List;
import org.junit.jupiter.api.Test;

class MetricsRepositoryTest {

    private final MetricsRepository repository = new MetricsRepository(null, new ObjectMapper());

    @Test
    void hasMetricsReturnsFalseWhenMetricsEnvelopeIsNull() {
        EnvelopedMessage message = new EnvelopedMessage();
        AssetTrackingData payload = new AssetTrackingData();
        message.setPayload(payload);

        assertFalse(repository.hasMetrics(message));
    }

    @Test
    void hasMetricsReturnsFalseWhenMetricItemsAreNull() {
        EnvelopedMessage message = new EnvelopedMessage();
        AssetTrackingData payload = new AssetTrackingData();
        MetricsEnvelope metrics = new MetricsEnvelope();
        payload.setMetrics(metrics);
        message.setPayload(payload);

        assertFalse(repository.hasMetrics(message));
    }

    @Test
    void hasMetricsReturnsTrueWhenMetricItemsExist() {
        EnvelopedMessage message = new EnvelopedMessage();
        AssetTrackingData payload = new AssetTrackingData();
        MetricsEnvelope metrics = new MetricsEnvelope();
        MetricItem item = new MetricItem();
        item.setK("engine.rpm");
        item.setV(1200);
        metrics.setItems(List.of(item));
        payload.setMetrics(metrics);
        message.setPayload(payload);

        assertTrue(repository.hasMetrics(message));
    }
}
