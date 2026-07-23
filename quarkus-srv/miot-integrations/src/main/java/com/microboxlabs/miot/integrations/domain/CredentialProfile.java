package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

/**
 * A reusable identity/secret, configured once per tenant and referenced from anywhere
 * that talks to an external system.
 *
 * <p>{@code publicConfig} holds everything non-secret the type needs (a client id, a
 * directory id, a scope); the secret half lives encrypted in
 * {@code encryptedSecretJson} and never leaves this record.
 *
 * @param credentialType   what the operator picked; {@code authType} is how it resolves
 * @param environment      free-text label, part of the credential's identity
 * @param secretPreview    a mask, never a prefix or suffix of the real secret
 */
public record CredentialProfile(
        String id,
        String tenantCode,
        String displayName,
        CredentialType credentialType,
        AuthType authType,
        String environment,
        Map<String, Object> publicConfig,
        String encryptedSecretJson,
        String secretPreview,
        int secretVersion,
        OffsetDateTime lastTestedAt,
        Boolean lastTestResult,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt,
        String createdBy,
        String updatedBy) {
}
