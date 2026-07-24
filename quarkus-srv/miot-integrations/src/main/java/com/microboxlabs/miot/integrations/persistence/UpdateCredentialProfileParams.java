package com.microboxlabs.miot.integrations.persistence;

import java.util.Map;

/**
 * Arguments for a partial update of a credential profile. Every field beyond the
 * identifiers is optional: null leaves the stored value alone.
 *
 * @param encryptedSecretJson non-null only when the secret is actually being rotated —
 *                            it is what bumps {@code secret_version}
 * @param secretPreview       the mask for the new secret, ignored unless the secret rotates
 */
public record UpdateCredentialProfileParams(
        String tenantCode,
        String id,
        String displayName,
        String environment,
        Map<String, Object> publicConfig,
        String encryptedSecretJson,
        String secretPreview,
        String updatedBy) {
}
