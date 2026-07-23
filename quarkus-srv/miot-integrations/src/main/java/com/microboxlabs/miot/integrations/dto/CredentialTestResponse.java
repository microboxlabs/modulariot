package com.microboxlabs.miot.integrations.dto;

import java.time.OffsetDateTime;

/**
 * Outcome of exercising a credential on its own.
 *
 * @param message           a short, safe reason — an OAuth error code plus the HTTP
 *                          status, never the provider's raw body and never anything
 *                          derived from the secret
 * @param expiresInSeconds  the granted token's lifetime, present only on success
 */
public record CredentialTestResponse(
        boolean success,
        OffsetDateTime testedAt,
        String message,
        Long expiresInSeconds) {

    public static CredentialTestResponse failure(String message) {
        return new CredentialTestResponse(false, OffsetDateTime.now(), message, null);
    }
}
