package com.microboxlabs.miot.resource.metrics;

import io.micrometer.core.instrument.MeterRegistry;
import jakarta.enterprise.context.ApplicationScoped;
import jakarta.inject.Inject;
import java.util.concurrent.TimeUnit;

@ApplicationScoped
public class ResourceMetrics {

    @Inject
    MeterRegistry registry;

    public void recordApiCall(String clientId, String endpoint, long durationMs, int status) {
        registry.timer("http_server_requests",
                "client_id", clientId,
                "uri", endpoint,
                "status", String.valueOf(status))
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    public void recordDbQuery(String clientId, String queryType, long durationMs) {
        registry.timer("db_query_duration",
                "client_id", clientId,
                "query_type", queryType)
                .record(durationMs, TimeUnit.MILLISECONDS);
    }

    public void recordEntityCount(String clientId, String entityType, String status, long count) {
        registry.gauge("entity_count",
                io.micrometer.core.instrument.Tags.of(
                        "client_id", clientId,
                        "entity_type", entityType,
                        "status", status),
                count);
    }

    public void incrementEventsProcessed(String clientId, String eventType) {
        registry.counter("events_processed",
                "client_id", clientId,
                "event_type", eventType)
                .increment();
    }
}
