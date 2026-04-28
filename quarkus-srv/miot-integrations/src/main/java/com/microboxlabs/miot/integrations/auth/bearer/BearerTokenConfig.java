package com.microboxlabs.miot.integrations.auth.bearer;

import java.util.Objects;

public record BearerTokenConfig(String token) {

    public BearerTokenConfig {
        Objects.requireNonNull(token, "Bearer token must not be null");
        if (token.isBlank()) {
            throw new IllegalArgumentException("Bearer token must not be blank");
        }
    }

    @Override
    public String toString() {
        return "BearerTokenConfig[token=<redacted>]";
    }
}
