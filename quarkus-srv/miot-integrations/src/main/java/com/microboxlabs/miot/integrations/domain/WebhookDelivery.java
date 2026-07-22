package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

public record WebhookDelivery(
        String id,
        String subscriptionId,
        String tenantCode,
        String dedupeKey,
        Map<String, Object> payload,
        WebhookDeliveryState state,
        int attempts,
        int maxAttempts,
        OffsetDateTime nextRetryAt,
        Integer lastStatusCode,
        String lastError,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
