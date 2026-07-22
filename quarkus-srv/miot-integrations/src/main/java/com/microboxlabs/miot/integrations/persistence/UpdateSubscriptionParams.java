package com.microboxlabs.miot.integrations.persistence;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import java.time.OffsetDateTime;
import java.util.List;
import java.util.Map;

/** Arguments for a partial update of a GPS webhook subscription. */
public record UpdateSubscriptionParams(
        String tenantCode,
        String subscriptionId,
        String name,
        Boolean enabled,
        FilterMode filterMode,
        Map<String, Object> filterJson,
        Boolean includeAllVisible,
        OffsetDateTime compiledAt,
        List<String> assetIdsOrNull,
        String webhookUrl) {
}
