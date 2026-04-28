package com.microboxlabs.miot.integrations.domain;

import java.time.OffsetDateTime;
import java.util.Map;

public record CredentialProfile(
        String id,
        String tenantCode,
        String displayName,
        AuthType authType,
        Map<String, Object> publicConfig,
        String encryptedSecretJson,
        String secretPreview,
        int secretVersion,
        OffsetDateTime createdAt,
        OffsetDateTime updatedAt) {
}
