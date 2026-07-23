package com.microboxlabs.miot.integrations.auth.oauth;

import com.microboxlabs.miot.integrations.domain.CredentialType;
import com.microboxlabs.miot.integrations.domain.TokenRequestFormat;
import com.microboxlabs.miot.integrations.net.OutboundUrlGuard;
import java.net.URI;
import java.net.URISyntaxException;
import java.util.Map;
import java.util.Optional;

/**
 * Turns a stored credential's {@code publicConfig}/{@code secretConfig} into the
 * {@link OAuth2ClientCredentialsConfig} the token strategy needs, and says whether such
 * a config is complete.
 *
 * <p>Shared by the tester and, later, by whatever resolves a credential into an
 * Authorization header, so the two can never disagree about where a token comes from.
 * Pure and offline: it validates the shape of a URL but never resolves it — that check
 * belongs immediately before the fetch.
 */
public final class OAuth2CredentialConfigs {

    /** Microsoft's v2.0 token endpoint host for a directory (tenant). */
    public static final String ENTRA_LOGIN_HOST = "https://login.microsoftonline.com";

    private OAuth2CredentialConfigs() {
    }

    public static boolean supports(CredentialType type) {
        return type == CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS
                || type == CredentialType.OAUTH2_CLIENT_CREDENTIALS;
    }

    /**
     * Checks the non-secret half on its own. Editing a credential without retyping the
     * secret has to be possible, so completeness of the public config can't depend on
     * having the secret to hand.
     *
     * @throws IllegalArgumentException naming the first missing or malformed field
     */
    public static void validatePublicConfig(CredentialType type, Map<String, Object> publicConfig) {
        require(publicConfig, "clientId");
        if (type == CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS) {
            require(publicConfig, "tenantId");
            require(publicConfig, "scope");
            optional(publicConfig, "tokenUrlOverride")
                    .ifPresent(override -> OutboundUrlGuard.requireHttpUrl(uri(override, "tokenUrlOverride"),
                            "tokenUrlOverride"));
        } else {
            String tokenUrl = require(publicConfig, "tokenUrl");
            OutboundUrlGuard.requireHttpUrl(uri(tokenUrl, "tokenUrl"), "tokenUrl");
        }
        tokenRequestFormat(publicConfig);
    }

    /**
     * Where the token is requested from. Entra derives it from the directory id unless
     * the operator overrode it; a generic provider states it outright.
     */
    public static URI tokenUrl(CredentialType type, Map<String, Object> publicConfig) {
        if (type == CredentialType.AZURE_ENTRA_CLIENT_CREDENTIALS) {
            Optional<String> override = optional(publicConfig, "tokenUrlOverride");
            if (override.isPresent()) {
                return uri(override.get(), "tokenUrlOverride");
            }
            return uri(entraTokenUrl(require(publicConfig, "tenantId")), "tokenUrl");
        }
        return uri(require(publicConfig, "tokenUrl"), "tokenUrl");
    }

    /** Microsoft's v2.0 token endpoint for a directory — the server-side twin of the UI's preview. */
    public static String entraTokenUrl(String tenantId) {
        return ENTRA_LOGIN_HOST + "/" + tenantId.trim() + "/oauth2/v2.0/token";
    }

    /**
     * @throws IllegalArgumentException when a field the grant needs is missing, the
     *                                  client secret included
     */
    public static OAuth2ClientCredentialsConfig toConfig(
            CredentialType type,
            Map<String, Object> publicConfig,
            Map<String, Object> secretConfig) {
        validatePublicConfig(type, publicConfig);
        return new OAuth2ClientCredentialsConfig(
                tokenUrl(type, publicConfig),
                require(publicConfig, "clientId"),
                require(secretConfig, "clientSecret"),
                optional(publicConfig, "scope"),
                optional(publicConfig, "audience"),
                tokenRequestFormat(publicConfig));
    }

    /** The non-secret value that identifies this credential in a list. */
    public static String summary(Map<String, Object> publicConfig) {
        return optional(publicConfig, "clientId").orElse(null);
    }

    private static TokenRequestFormat tokenRequestFormat(Map<String, Object> publicConfig) {
        Optional<String> raw = optional(publicConfig, "tokenRequestFormat");
        if (raw.isEmpty()) {
            return TokenRequestFormat.FORM;
        }
        try {
            return TokenRequestFormat.valueOf(raw.get().toUpperCase());
        } catch (IllegalArgumentException e) {
            throw new IllegalArgumentException("tokenRequestFormat must be FORM or JSON");
        }
    }

    private static URI uri(String value, String field) {
        try {
            return new URI(value.trim());
        } catch (URISyntaxException e) {
            throw new IllegalArgumentException(field + " is not a valid URL");
        }
    }

    private static String require(Map<String, Object> config, String key) {
        return optional(config, key)
                .orElseThrow(() -> new IllegalArgumentException(key + " is required"));
    }

    private static Optional<String> optional(Map<String, Object> config, String key) {
        return Optional.ofNullable(string(config, key)).filter(value -> !value.isBlank());
    }

    private static String string(Map<String, Object> config, String key) {
        Object value = config == null ? null : config.get(key);
        return value == null ? null : value.toString();
    }
}
