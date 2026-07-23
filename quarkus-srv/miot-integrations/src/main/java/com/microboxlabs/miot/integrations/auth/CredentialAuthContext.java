package com.microboxlabs.miot.integrations.auth;

import com.microboxlabs.miot.integrations.domain.AuthType;
import com.microboxlabs.miot.integrations.domain.CredentialType;
import java.util.Map;
import java.util.Optional;

/**
 * Everything a {@link CredentialAuthProvider} needs to turn a stored credential into
 * request auth: which grant to run ({@code authType}), which flavour of it
 * ({@code credentialType} — e.g. Entra vs a generic OAuth2 provider), the non-secret
 * half, and the decrypted secret half.
 *
 * <p>Deliberately not the {@code CredentialProfile} record: the invoker works from a
 * {@link com.microboxlabs.miot.integrations.service.ResolvedConnection}, which already
 * dropped the persistence fields, and providers have no business seeing them.
 *
 * <p>The {@code secret} map is sensitive — never log or serialize it. {@link #toString()}
 * is overridden to keep it out of stack traces and debug output.
 */
public record CredentialAuthContext(
        AuthType authType,
        CredentialType credentialType,
        Map<String, Object> publicConfig,
        Map<String, Object> secret) {

    public CredentialAuthContext {
        publicConfig = publicConfig == null ? Map.of() : Map.copyOf(publicConfig);
        secret = secret == null ? Map.of() : Map.copyOf(secret);
    }

    /** A non-blank value from the non-secret half, or empty. */
    public Optional<String> publicValue(String key) {
        return value(publicConfig, key);
    }

    /** A non-blank value from the decrypted half, or empty. */
    public Optional<String> secretValue(String key) {
        return value(secret, key);
    }

    /**
     * @throws AuthResolutionException naming the field, so a misconfigured credential
     *         reports which key it is missing rather than failing as a null downstream
     */
    public String requirePublic(String key) {
        return publicValue(key).orElseThrow(() -> missing(key, "public config"));
    }

    /** @throws AuthResolutionException naming the field (never its value) */
    public String requireSecret(String key) {
        return secretValue(key).orElseThrow(() -> missing(key, "secret config"));
    }

    private AuthResolutionException missing(String key, String half) {
        return new AuthResolutionException(
                authType + " credential is missing '" + key + "' in its " + half);
    }

    private static Optional<String> value(Map<String, Object> map, String key) {
        Object raw = map == null ? null : map.get(key);
        return Optional.ofNullable(raw).map(Object::toString).filter(text -> !text.isBlank());
    }

    @Override
    public String toString() {
        return "CredentialAuthContext[authType=" + authType
                + ", credentialType=" + credentialType
                + ", publicConfig=" + publicConfig.keySet()
                + ", secret=<redacted>]";
    }
}
