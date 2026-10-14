package com.microboxlabs.miot.integrations.service;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

class CredentialTokenIssuerTest {

    @Test
    void takesTheBearerTokenAndItsExpiry() {
        Instant expiry = Instant.parse("2026-10-06T12:00:00Z");
        var token = CredentialTokenIssuer.token(
                ResolvedAuth.headers(Map.of("Authorization", "Bearer abc.def.ghi"), expiry));
        assertEquals("abc.def.ghi", token.accessToken());
        assertEquals(expiry, token.expiresAt());
    }

    @Test
    void anUnknownExpiryIsTreatedAsShort() {
        var token = CredentialTokenIssuer.token(ResolvedAuth.headers(Map.of("Authorization", "Bearer t"), null));
        assertTrue(token.expiresAt().isBefore(Instant.now().plusSeconds(301)));
    }

    @Test
    void aCredentialWithoutABearerTokenIsRejected() {
        ResolvedAuth basic = ResolvedAuth.headers(Map.of("Authorization", "Basic dXNlcjpwYXNz"), null);
        assertThrows(IllegalStateException.class, () -> CredentialTokenIssuer.token(basic));
    }
}
