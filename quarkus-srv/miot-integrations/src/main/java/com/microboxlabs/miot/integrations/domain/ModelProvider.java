package com.microboxlabs.miot.integrations.domain;

import java.math.BigDecimal;
import java.time.OffsetDateTime;
import java.util.List;

/**
 * An AI model provider the harness may call, with the models it offers.
 * {@code encryptedKey} is the API key sealed by {@code IntegrationSecretCipher}.
 */
public record ModelProvider(
        String provider,
        String baseUrl,
        String encryptedKey,
        String keyPreview,
        List<Model> models,
        boolean enabled,
        String updatedBy,
        OffsetDateTime updatedAt) {

    /**
     * One model and its price per million tokens; prices may be unset.
     * {@code multiplier} is how many pool tokens each of its tokens uses; null means 1.
     */
    public record Model(
            String id,
            BigDecimal inputPerMtok,
            BigDecimal outputPerMtok,
            boolean isDefault,
            BigDecimal multiplier) {

        public BigDecimal poolMultiplier() {
            return multiplier == null ? BigDecimal.ONE : multiplier;
        }

        public Model withDefault(boolean value) {
            return new Model(id, inputPerMtok, outputPerMtok, value, multiplier);
        }
    }

    public ModelProvider withModels(List<Model> next) {
        return new ModelProvider(provider, baseUrl, encryptedKey, keyPreview, next, enabled, updatedBy, updatedAt);
    }
}
