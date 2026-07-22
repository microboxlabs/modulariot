package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Arguments for inserting a GPS webhook subscription row (+ assets). */
public record CreateSubscriptionParams(
        String id,
        String tenantCode,
        String connectionId,
        String name,
        boolean enabled,
        FilterMode filterMode,
        Map<String, Object> filterJson,
        boolean includeAllVisible,
        OffsetDateTime compiledAt,
        List<String> assetIds,
        String webhookUrl) {
}
