package com.microboxlabs.miot.integrations.service;

import com.microboxlabs.miot.integrations.auth.CredentialAuthContext;
import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
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
 *
 * <p>{@code authType} / {@code credentialType} / {@code publicConfig} describe <i>how</i> to
 * authenticate, instead of leaving each caller to infer it from the secret's shape; together
 * they feed {@link #authContext()}. They are absent on a connection with no credential
 * attached, and on the back-compat constructor below.
 */
public record ResolvedConnection(
        String connectionId,
        URI baseUrl,
        Map<String, Object> metadata,
        Map<String, Object> secret,
        AuthType authType,
        CredentialType credentialType,
        Map<String, Object> publicConfig) {

    /**
     * Back-compat view for callers that hand-build their own auth from the secret map
     * (the WhatsApp channel predates the generic invoker). Leaves the auth description
     * empty, so {@link #authContext()} is unavailable — use the canonical constructor
     * when the credential is known.
     */
    public ResolvedConnection(
            String connectionId, URI baseUrl, Map<String, Object> metadata, Map<String, Object> secret) {
        this(connectionId, baseUrl, metadata, secret, null, null, Map.of());
    }

    public String metadataString(String key) {
        return stringValue(metadata, key);
    }

    public String secretString(String key) {
        return stringValue(secret, key);
    }

    /** Whether this connection carries enough to authenticate a request generically. */
    public boolean hasAuth() {
        return authType != null;
    }

    /**
     * The input {@link com.microboxlabs.miot.integrations.auth.CredentialAuthRegistry}
     * needs to produce request auth.
     *
     * @throws IllegalStateException when no credential is attached to the connection
     */
    public CredentialAuthContext authContext() {
        if (!hasAuth()) {
            throw new IllegalStateException(
                    "Connection " + connectionId + " has no credential profile to authenticate with");
        }
        return new CredentialAuthContext(authType, credentialType, publicConfig, secret);
    }

    private static String stringValue(Map<String, Object> map, String key) {
        if (map == null) {
            return null;
        }
        Object value = map.get(key);
        return value == null ? null : value.toString();
    }
}
