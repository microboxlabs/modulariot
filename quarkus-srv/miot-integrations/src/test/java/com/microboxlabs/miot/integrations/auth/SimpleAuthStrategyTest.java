package com.microboxlabs.miot.integrations.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.auth.apikey.ApiKeyConfig;
import com.microboxlabs.miot.integrations.auth.apikey.ApiKeyStrategy;
import com.microboxlabs.miot.integrations.auth.basic.BasicAuthConfig;
import com.microboxlabs.miot.integrations.auth.basic.BasicAuthStrategy;
import com.microboxlabs.miot.integrations.auth.bearer.BearerTokenConfig;
import com.microboxlabs.miot.integrations.auth.bearer.BearerTokenStrategy;
import com.microboxlabs.miot.integrations.auth.oauth.OAuth2ClientCredentialsConfig;
import com.microboxlabs.miot.integrations.domain.ApiKeyPlacement;
import com.microboxlabs.miot.integrations.domain.TokenRequestFormat;
import java.net.URI;
import org.junit.jupiter.api.Test;

class SimpleAuthStrategyTest {

    @Test
    void resolvesBearerTokenHeader() {
        ResolvedAuth auth = new BearerTokenStrategy().resolve(new BearerTokenConfig("token-123"));

        assertEquals("Bearer token-123", auth.headers().get("Authorization"));
    }

    @Test
    void rejectsInvalidBearerTokens() {
        NullPointerException nullException = assertThrows(
                NullPointerException.class,
                () -> new BearerTokenConfig(null));
        IllegalArgumentException blankException = assertThrows(
                IllegalArgumentException.class,
                () -> new BearerTokenConfig(" "));

        assertEquals("Bearer token must not be null", nullException.getMessage());
        assertEquals("Bearer token must not be blank", blankException.getMessage());
    }

    @Test
    void resolvesBasicAuthHeader() {
        ResolvedAuth auth = new BasicAuthStrategy().resolve(new BasicAuthConfig("user", "pass"));

        assertEquals("Basic dXNlcjpwYXNz", auth.headers().get("Authorization"));
    }

    @Test
    void resolvesApiKeyAsQueryParameter() {
        ResolvedAuth auth = new ApiKeyStrategy().resolve(
                new ApiKeyConfig("api_key", "secret", ApiKeyPlacement.QUERY));

        assertEquals("secret", auth.queryParams().get("api_key"));
    }

    @Test
    void rejectsApiKeyWithoutPlacement() {
        ApiKeyStrategy strategy = new ApiKeyStrategy();
        ApiKeyConfig config = new ApiKeyConfig("api_key", "secret", null);

        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                strategy.resolve(config));

        assertEquals("Unsupported API key placement for credential 'api_key': null", exception.getMessage());
    }

    @Test
    void authConfigToStringRedactsSecrets() {
        assertFalse(new BasicAuthConfig("user", "raw-basic-secret").toString().contains("raw-basic-secret"));
        assertFalse(new BearerTokenConfig("token-123").toString().contains("token-123"));
        assertFalse(new ApiKeyConfig("api_key", "secret", ApiKeyPlacement.HEADER).toString().contains("secret"));
        assertFalse(OAuth2ClientCredentialsConfig.withoutOptionalClaims(
                        URI.create("https://auth.example/token"),
                        "client-id",
                        "client-secret",
                        TokenRequestFormat.FORM)
                .toString()
                .contains("client-secret"));
    }
}
