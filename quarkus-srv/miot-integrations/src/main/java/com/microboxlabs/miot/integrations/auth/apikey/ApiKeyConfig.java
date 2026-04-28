package com.microboxlabs.miot.integrations.auth.apikey;

import com.microboxlabs.miot.integrations.domain.ApiKeyPlacement;

public record ApiKeyConfig(
        String name,
        String value,
        ApiKeyPlacement placement) {

    @Override
    public String toString() {
        return "ApiKeyConfig[name=" + name + ", value=<redacted>, placement=" + placement + "]";
    }
}
