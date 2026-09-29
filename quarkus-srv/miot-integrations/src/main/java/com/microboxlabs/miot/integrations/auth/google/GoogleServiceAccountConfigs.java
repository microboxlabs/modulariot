package com.microboxlabs.miot.integrations.auth.google;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import java.net.URI;
import java.util.Map;
import java.util.Optional;

/**
 * Builds a {@link GoogleServiceAccountConfig} from a credential's two halves, the same
 * way {@code OAuth2CredentialConfigs} does for client credentials.
 *
 * <p>Public half: {@code clientEmail} (required), {@code projectId} (kept for the
 * operator, unused by the grant), {@code scope} and {@code tokenUrl} (optional).
 * Secret half: {@code privateKey}, the PEM from the account's JSON key file.
 */
public final class GoogleServiceAccountConfigs {

    public static final String DEFAULT_TOKEN_URL = "https://oauth2.googleapis.com/token";
    public static final String DEFAULT_SCOPE = "https://www.googleapis.com/auth/bigquery.readonly";

    private GoogleServiceAccountConfigs() {
    }

    public static boolean supports(CredentialType type) {
        return type == CredentialType.GOOGLE_SERVICE_ACCOUNT;
    }

    /** @throws IllegalArgumentException naming the missing or malformed field */
    public static void validatePublicConfig(Map<String, Object> publicConfig) {
        require(publicConfig, "clientEmail");
        tokenUrl(publicConfig);
    }

    /** The token endpoint, checked to be an http(s) URL. */
    public static URI tokenUrl(Map<String, Object> publicConfig) {
        String raw = optional(publicConfig, "tokenUrl").orElse(DEFAULT_TOKEN_URL);
        URI url;
        try {
            url = URI.create(raw);
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("tokenUrl is not a valid URL");
        }
        OutboundUrlGuard.requireHttpUrl(url, "tokenUrl");
        return url;
    }

    public static GoogleServiceAccountConfig toConfig(
            Map<String, Object> publicConfig, Map<String, Object> secretConfig) {
        return new GoogleServiceAccountConfig(
                require(publicConfig, "clientEmail"),
                require(secretConfig, "privateKey"),
                optional(publicConfig, "scope").orElse(DEFAULT_SCOPE),
                tokenUrl(publicConfig));
    }

    private static String require(Map<String, Object> map, String key) {
        return optional(map, key)
                .orElseThrow(() -> new IllegalArgumentException(key + " is required"));
    }

    private static Optional<String> optional(Map<String, Object> map, String key) {
        if (map == null) {
            return Optional.empty();
        }
        Object value = map.get(key);
        if (value == null) {
            return Optional.empty();
        }
        String text = value.toString().trim();
        return text.isEmpty() ? Optional.empty() : Optional.of(text);
    }
}
