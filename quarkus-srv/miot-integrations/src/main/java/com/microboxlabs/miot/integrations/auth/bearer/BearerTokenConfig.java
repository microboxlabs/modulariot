package com.microboxlabs.miot.integrations.auth.bearer;

public record BearerTokenConfig(String token) {

    @Override
    public String toString() {
        return "BearerTokenConfig[token=<redacted>]";
    }
}
