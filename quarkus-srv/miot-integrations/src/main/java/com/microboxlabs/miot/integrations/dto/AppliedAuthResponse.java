package com.microboxlabs.miot.integrations.dto;

import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import java.util.Map;

/**
 * What to send with a request, never the secret behind it. The shape the
 * dashboard server accepts; it refuses a service account, so only
 * {@code HTTP_AUTH} is produced here.
 *
 * @param expiresAt ISO-8601, or null when the grant states no expiry
 */
public record AppliedAuthResponse(
        String kind,
        Map<String, String> headers,
        Map<String, String> queryParams,
        String expiresAt) {

    public static AppliedAuthResponse httpAuth(ResolvedAuth auth) {
        return new AppliedAuthResponse(
                "HTTP_AUTH",
                auth.headers() == null ? Map.of() : Map.copyOf(auth.headers()),
                auth.queryParams() == null ? Map.of() : Map.copyOf(auth.queryParams()),
                auth.expiresAt() == null ? null : auth.expiresAt().toString());
    }
}
