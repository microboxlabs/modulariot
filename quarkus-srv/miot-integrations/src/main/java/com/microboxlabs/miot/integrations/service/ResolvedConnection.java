package com.microboxlabs.miot.integrations.service;

import java.net.URI;
import java.util.Map;

/**
 * A ready-to-use view of an org's integration connection: the base URL and non-secret
 * metadata, plus the decrypted secret config. Returned by {@link IntegrationConnectionResolver}
 * so consuming modules (e.g. the conversational channel) can call an external provider
 * without touching the persistence or cipher internals of this module.
 *
 * <p>The {@code secret} map is the decrypted credential config (e.g. {@code {"token": "..."}});
 * treat it as sensitive and never log or serialize it.
 */
public record ResolvedConnection(
        String connectionId,
        URI baseUrl,
        Map<String, Object> metadata,
        Map<String, Object> secret) {

    public String metadataString(String key) {
        return stringValue(metadata, key);
    }

    public String secretString(String key) {
        return stringValue(secret, key);
    }

    private static String stringValue(Map<String, Object> map, String key) {
        if (map == null) {
            return null;
        }
        Object value = map.get(key);
        return value == null ? null : value.toString();
    }
}
