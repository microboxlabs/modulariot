package com.microboxlabs.miot.integrations.auth;

import java.time.Instant;
import java.util.Map;

public record ResolvedAuth(
        Map<String, String> headers,
        Map<String, String> queryParams,
        Instant expiresAt) {

    public static ResolvedAuth headers(Map<String, String> headers, Instant expiresAt) {
        return new ResolvedAuth(Map.copyOf(headers), Map.of(), expiresAt);
    }
}
