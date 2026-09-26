package com.microboxlabs.miot.integrations.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/** Request and response shapes for the platform's model providers. */
public final class ModelProviderDtos {

    private ModelProviderDtos() {
    }

    /** A model a provider offers, with its price per million tokens. */
    public record ModelEntry(
            String id,
            BigDecimal inputPerMtok,
            BigDecimal outputPerMtok,
            @JsonProperty("default") Boolean isDefault) {
    }

    /** Create or replace a provider. A blank {@code apiKey} keeps the stored one. */
    public record SetModelProviderRequest(
            String apiKey,
            String baseUrl,
            List<ModelEntry> models,
            Boolean enabled) {
    }

    /** What the settings page shows. The key itself is never returned. */
    public record ModelProviderResponse(
            String provider,
            String baseUrl,
            String keyPreview,
            List<ModelEntry> models,
            boolean enabled,
            String updatedBy,
            OffsetDateTime updatedAt) {
    }

    /** What the harness needs to call a provider, key included. */
    public record HarnessModelProvider(
            String provider,
            String baseUrl,
            String apiKey,
            List<ModelEntry> models) {
    }
}
