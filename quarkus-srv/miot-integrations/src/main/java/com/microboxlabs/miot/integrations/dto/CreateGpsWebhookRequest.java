package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.domain.FilterMode;
import java.net.URI;
import java.util.Map;

/**
 * Creates a GPS_WEBHOOK connection plus a subscription in one call.
 *
 * @param name display name (unique per tenant among active subscriptions)
 * @param url customer webhook URL
 * @param credentialProfileId optional existing credential profile for outbound auth
 * @param filterMode {@link FilterMode#ALL_VISIBLE} or {@link FilterMode#RULES}
 * @param filter filter document ({@code scopes} + {@code match}); optional for ALL_VISIBLE
 * @param enabled whether the subscription is active for delivery (default true)
 */
public record CreateGpsWebhookRequest(
        String name,
        URI url,
        String credentialProfileId,
        FilterMode filterMode,
        Map<String, Object> filter,
        Boolean enabled) {
}
