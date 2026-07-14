package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

public record RetransmitDelivery(
        String id,
        String configId,
        String assetId,
        String dedupeKey,
        String destinationUrl,
        Map<String, Object> payload,
        WebhookDeliveryState state,
        int attempts,
        int maxAttempts,
        OffsetDateTime nextRetryAt,
        Integer lastStatusCode,
        String lastError,
        String lockedBy,
        OffsetDateTime lockedUntil,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
