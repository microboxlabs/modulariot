package com.microboxlabs.miot.integrations.api;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.microboxlabs.miot.integrations.auth.ResolvedAuth;
import com.microboxlabs.miot.integrations.dto.AppliedAuthResponse;
import java.time.Instant;
import java.util.Map;
import org.junit.jupiter.api.Test;

/** The two pieces of the credential endpoint that decide an answer. */
class DashboardCredentialsResourceTest {

    private static final String KEY = "0123456789abcdef0123456789abcdef";

    @Test
    void acceptsOnlyTheConfiguredKey() {
        assertTrue(DashboardCredentialsResource.keyAccepted(KEY, KEY));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, KEY + "x"));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, KEY.substring(1)));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, "0123456789abcdef0123456789abcdeF"));
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, ""));
    }

    @Test
    void treatsAMissingHeaderAsAWrongKey() {
        assertFalse(DashboardCredentialsResource.keyAccepted(KEY, null));
    }

    @Test
    void answersAppliedAuth() {
        Instant expiry = Instant.parse("2026-09-21T04:00:00Z");

        AppliedAuthResponse body = AppliedAuthResponse.httpAuth(new ResolvedAuth(
                Map.of("Authorization", "Bearer t"), Map.of("api_key", "k"), expiry));

        assertEquals("HTTP_AUTH", body.kind());
        assertEquals(Map.of("Authorization", "Bearer t"), body.headers());
        assertEquals(Map.of("api_key", "k"), body.queryParams());
        assertEquals("2026-09-21T04:00:00Z", body.expiresAt());
    }

    /** The dashboard server refuses an {@code expiresAt} it cannot parse. */
    @Test
    void omitsAnExpiryTheGrantDidNotState() {
        AppliedAuthResponse body =
                AppliedAuthResponse.httpAuth(ResolvedAuth.headers(Map.of("Authorization", "Bearer t"), null));

        assertNull(body.expiresAt());
        assertEquals(Map.of(), body.queryParams());
    }
}
