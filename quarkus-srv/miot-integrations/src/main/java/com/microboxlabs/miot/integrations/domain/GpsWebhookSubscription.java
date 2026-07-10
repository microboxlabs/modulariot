package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record GpsWebhookSubscription(
        String id,
        String tenantCode,
        String connectionId,
        String name,
        boolean enabled,
        FilterMode filterMode,
        Map<String, Object> filterJson,
        boolean includeAllVisible,
        OffsetDateTime compiledAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        /** Compiled membership; empty when {@link #includeAllVisible} or not yet compiled. */
        List<String> compiledAssetIds,
        /** Denormalized from the linked connection for API responses. */
        String webhookUrl) {
}
