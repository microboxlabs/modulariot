package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import java.net.URI;
import java.util.Map;

/**
 * Partial update of a GPS webhook subscription and its linked connection.
 * Null fields are left unchanged.
 */
public record UpdateGpsWebhookRequest(
        String name,
        URI url,
        FilterMode filterMode,
        Map<String, Object> filter,
        Boolean enabled) {
}
