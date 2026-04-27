package com.microboxlabs.miot.integrations.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;

import com.microboxlabs.miot.integrations.auth.apikey.ApiKeyConfig;
import com.microboxlabs.miot.integrations.auth.apikey.ApiKeyStrategy;
import com.microboxlabs.miot.integrations.auth.basic.BasicAuthConfig;
import com.microboxlabs.miot.integrations.auth.basic.BasicAuthStrategy;
import com.microboxlabs.miot.integrations.auth.bearer.BearerTokenConfig;
import com.microboxlabs.miot.integrations.auth.bearer.BearerTokenStrategy;
import com.microboxlabs.miot.integrations.domain.ApiKeyPlacement;
import org.junit.jupiter.api.Test;

class SimpleAuthStrategyTest {

    @Test
    void resolvesBearerTokenHeader() {
        ResolvedAuth auth = new BearerTokenStrategy().resolve(new BearerTokenConfig("token-123"));

        assertEquals("Bearer token-123", auth.headers().get("Authorization"));
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
        IllegalArgumentException exception = assertThrows(IllegalArgumentException.class, () ->
                new ApiKeyStrategy().resolve(new ApiKeyConfig("api_key", "secret", null)));

        assertEquals("Unsupported API key placement for credential 'api_key': null", exception.getMessage());
    }
}
