package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

public record GpsWebhookResponse(
        String id,
        String tenantCode,
        String connectionId,
        String name,
        String url,
        boolean enabled,
        FilterMode filterMode,
        Map<String, Object> filter,
        boolean includeAllVisible,
        List<String> compiledAssetIds,
        OffsetDateTime compiledAt,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
