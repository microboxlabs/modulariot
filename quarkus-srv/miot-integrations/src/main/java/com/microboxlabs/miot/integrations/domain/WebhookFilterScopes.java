package com.microboxlabs.miot.integrations.domain;

import java.util.List;

/**
 * Filter dimensions for a GPS webhook subscription.
 *
 * <p>With {@code match = ALL}, every non-empty dimension must match (intersection).
 * Empty lists mean "dimension not used".
 */
public record WebhookFilterScopes(
        boolean allVisible,
        List<String> assetIds,
        List<String> carrierIds,
        List<String> ingestClientIds,
        List<String> gpsProviders,
        List<String> owners) {

    public static WebhookFilterScopes empty() {
        return new WebhookFilterScopes(false, List.of(), List.of(), List.of(), List.of(), List.of());
    }

    public WebhookFilterScopes {
        assetIds = normalize(assetIds);
        carrierIds = normalize(carrierIds);
        ingestClientIds = normalize(ingestClientIds);
        gpsProviders = normalize(gpsProviders);
        owners = normalize(owners);
    }

    public boolean hasAnyRuleDimension() {
        return allVisible
                || !assetIds.isEmpty()
                || !carrierIds.isEmpty()
                || !ingestClientIds.isEmpty()
                || !gpsProviders.isEmpty()
                || !owners.isEmpty();
    }

    private static List<String> normalize(List<String> values) {
        if (values == null || values.isEmpty()) {
            return List.of();
        }
        return values.stream()
                .filter(v -> v != null && !v.isBlank())
                .map(String::trim)
                .distinct()
                .toList();
    }
}
