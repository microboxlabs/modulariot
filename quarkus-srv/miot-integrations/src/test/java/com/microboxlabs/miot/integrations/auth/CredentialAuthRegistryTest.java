package com.microboxlabs.miot.integrations.auth;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.domain.AuthType;
import java.util.List;
import java.util.Map;
import java.util.Set;
import org.junit.jupiter.api.Test;

class CredentialAuthRegistryTest {

    /** A provider that reports which auth types it claims and tags the header it produced. */
    private record StubProvider(String id, Set<AuthType> types) implements CredentialAuthProvider {
        @Override
        public Set<AuthType> supportedTypes() {
            return types;
        }

        @Override
        public ResolvedAuth resolve(CredentialAuthContext context) {
            return ResolvedAuth.headers(Map.of("X-Handled-By", id), null);
        }
    }

    private static CredentialAuthContext context(AuthType authType) {
        return new CredentialAuthContext(authType, null, Map.of(), Map.of());
    }

    @Test
    void dispatchesToTheProviderThatClaimsTheAuthType() {
        var registry = new CredentialAuthRegistry(List.of(
                new StubProvider("bearer", Set.of(AuthType.BEARER_TOKEN)),
                new StubProvider("basic", Set.of(AuthType.BASIC))));

        assertEquals("bearer",
                registry.resolve(context(AuthType.BEARER_TOKEN)).headers().get("X-Handled-By"));
        assertEquals("basic",
                registry.resolve(context(AuthType.BASIC)).headers().get("X-Handled-By"));
    }

    @Test
    void oneProviderCanClaimSeveralAuthTypes() {
        var registry = new CredentialAuthRegistry(List.of(
                new StubProvider("apikey", Set.of(AuthType.API_KEY_HEADER, AuthType.API_KEY_QUERY))));

        assertEquals("apikey",
                registry.resolve(context(AuthType.API_KEY_HEADER)).headers().get("X-Handled-By"));
        assertEquals("apikey",
                registry.resolve(context(AuthType.API_KEY_QUERY)).headers().get("X-Handled-By"));
    }

    @Test
    void twoProvidersClaimingTheSameTypeFailFast() {
        List<CredentialAuthProvider> clashing = List.of(
                new StubProvider("first", Set.of(AuthType.BEARER_TOKEN)),
                new StubProvider("second", Set.of(AuthType.BEARER_TOKEN)));

        // A last-one-wins registry would silently authenticate with the wrong provider,
        // so the ambiguity has to surface at startup rather than at 3am.
        IllegalStateException failure =
                assertThrows(IllegalStateException.class, () -> CredentialAuthRegistry.index(clashing));

        assertTrue(failure.getMessage().contains("BEARER_TOKEN"), failure.getMessage());
    }

    @Test
    void anUnhandledAuthTypeIsRefusedRatherThanSentUnauthenticated() {
        var registry = new CredentialAuthRegistry(List.of(
                new StubProvider("bearer", Set.of(AuthType.BEARER_TOKEN))));

        AuthResolutionException failure = assertThrows(AuthResolutionException.class,
                () -> registry.resolve(context(AuthType.OAUTH2_CLIENT_CREDENTIALS)));

        assertTrue(failure.getMessage().contains("OAUTH2_CLIENT_CREDENTIALS"), failure.getMessage());
    }
}
