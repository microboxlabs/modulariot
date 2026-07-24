package com.microboxlabs.miot.integrations.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.auth.apikey.ApiKeyCredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.apikey.ApiKeyStrategy;
import com.microboxlabs.miot.integrations.auth.basic.BasicAuthStrategy;
import com.microboxlabs.miot.integrations.auth.basic.BasicCredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.bearer.BearerCredentialAuthProvider;
import com.microboxlabs.miot.integrations.auth.bearer.BearerTokenStrategy;
import com.microboxlabs.miot.integrations.auth.customheaders.CustomHeadersCredentialAuthProvider;
import com.microboxlabs.miot.integrations.domain.AuthType;
import java.util.Base64;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The credential-shape contract each provider expects, and how it fails when it isn't met. */
class CredentialAuthProvidersTest {

    private static CredentialAuthContext context(
            AuthType authType, Map<String, Object> publicConfig, Map<String, Object> secret) {
        return new CredentialAuthContext(authType, null, publicConfig, secret);
    }

    @Test
    void bearerSendsTheStoredTokenAsAnAuthorizationHeader() {
        var provider = new BearerCredentialAuthProvider(new BearerTokenStrategy());

        ResolvedAuth auth = provider.resolve(
                context(AuthType.BEARER_TOKEN, Map.of(), Map.of("token", "abc-123")));

        assertEquals("Bearer abc-123", auth.headers().get("Authorization"));
        assertTrue(auth.queryParams().isEmpty());
    }

    @Test
    void bearerNamesTheMissingKeyRatherThanFailingAsANull() {
        var provider = new BearerCredentialAuthProvider(new BearerTokenStrategy());

        AuthResolutionException failure = assertThrows(AuthResolutionException.class,
                () -> provider.resolve(context(AuthType.BEARER_TOKEN, Map.of(), Map.of())));

        assertTrue(failure.getMessage().contains("token"), failure.getMessage());
    }

    @Test
    void basicEncodesTheNonSecretUsernameWithTheSecretPassword() {
        var provider = new BasicCredentialAuthProvider(new BasicAuthStrategy());

        ResolvedAuth auth = provider.resolve(context(
                AuthType.BASIC, Map.of("username", "svc-user"), Map.of("password", "s3cret")));

        String expected = Base64.getEncoder().encodeToString("svc-user:s3cret".getBytes());
        assertEquals("Basic " + expected, auth.headers().get("Authorization"));
    }

    @Test
    void apiKeyPlacementFollowsTheAuthTypeNotTheConfig() {
        var provider = new ApiKeyCredentialAuthProvider(new ApiKeyStrategy());
        Map<String, Object> publicConfig = Map.of("name", "X-Api-Key");
        Map<String, Object> secret = Map.of("value", "key-789");

        ResolvedAuth header = provider.resolve(context(AuthType.API_KEY_HEADER, publicConfig, secret));
        assertEquals("key-789", header.headers().get("X-Api-Key"));
        assertTrue(header.queryParams().isEmpty());

        ResolvedAuth query = provider.resolve(context(AuthType.API_KEY_QUERY, publicConfig, secret));
        assertEquals("key-789", query.queryParams().get("X-Api-Key"));
        assertTrue(query.headers().isEmpty());
    }

    @Test
    void customHeadersCopiesEveryStoredHeader() {
        var provider = new CustomHeadersCredentialAuthProvider();

        ResolvedAuth auth = provider.resolve(context(AuthType.CUSTOM_HEADERS, Map.of(),
                Map.of("headers", Map.of("X-Tenant", "acme", "X-Signature", "sig-1"))));

        assertEquals("acme", auth.headers().get("X-Tenant"));
        assertEquals("sig-1", auth.headers().get("X-Signature"));
    }

    @Test
    void customHeadersRefusesAValueThatCouldInjectAnotherHeader() {
        var provider = new CustomHeadersCredentialAuthProvider();

        AuthResolutionException failure = assertThrows(AuthResolutionException.class,
                () -> provider.resolve(context(AuthType.CUSTOM_HEADERS, Map.of(),
                        Map.of("headers", Map.of("X-Evil", "ok\r\nX-Injected: yes")))));

        assertTrue(failure.getMessage().contains("X-Evil"), failure.getMessage());
    }

    @Test
    void customHeadersRequiresANonEmptyHeaderMap() {
        var provider = new CustomHeadersCredentialAuthProvider();

        assertThrows(AuthResolutionException.class,
                () -> provider.resolve(context(AuthType.CUSTOM_HEADERS, Map.of(), Map.of())));
        assertThrows(AuthResolutionException.class,
                () -> provider.resolve(context(AuthType.CUSTOM_HEADERS, Map.of(),
                        Map.of("headers", Map.of()))));
    }

    @Test
    void noAuthResolvesToNothingAtAll() {
        ResolvedAuth auth = new NoAuthProvider().resolve(context(AuthType.NONE, Map.of(), Map.of()));

        assertTrue(auth.headers().isEmpty());
        assertTrue(auth.queryParams().isEmpty());
    }

    @Test
    void theSecretHalfNeverAppearsInAContextsToString() {
        String rendered = context(AuthType.BEARER_TOKEN, Map.of("clientId", "public-id"),
                Map.of("token", "super-secret-value")).toString();

        assertFalse(rendered.contains("super-secret-value"), rendered);
        assertTrue(rendered.contains("redacted"), rendered);
    }
}
